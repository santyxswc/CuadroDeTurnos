import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { estadoTurno } from '@sgt/rules-engine';
import {
  EventoTiempoReal,
  type EventoMarcacionDto,
  type IndicadorTurnoDto,
  type MarcacionDto,
  type MiTurnoDto,
  type TipoMarcacion,
} from '@sgt/shared-types';
import { randomUUID } from 'node:crypto';
import { AlmacenService } from '../almacen/almacen.service';
import type { AsignacionGuardada, MarcacionGuardada, UsuarioGuardado } from '../almacen/modelos';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { hoyBogota } from '../comun/fechas';
import { ParametrosService } from '../parametros/parametros.service';
import { EventosGateway } from '../tiempo-real/eventos.gateway';

const MIN_MS = 60_000;
const HORA_MS = 60 * MIN_MS;
/** Evita marcaciones dobles por un clic repetido. */
const SEGUNDOS_ENTRE_MARCACIONES = 60;

const aDto = ({ id, usuarioId, asignacionId, tipo, hora, equipo, corregida, motivoCorreccion, corregidaPor }: MarcacionGuardada): MarcacionDto => ({
  id,
  usuarioId,
  asignacionId,
  tipo,
  hora,
  equipo,
  corregida,
  motivoCorreccion,
  corregidaPor,
});

export interface Correccion {
  usuarioId: string;
  asignacionId: string | null;
  tipo: TipoMarcacion;
  hora: string;
  motivo: string;
}

/** Marcación de entrada y salida con la hora del servidor (RF-ASI-01 a 04) e indicadores del turno (RF-MAIN-02). */
@Injectable()
export class MarcacionesService {
  constructor(
    private readonly almacen: AlmacenService,
    private readonly auditoria: AuditoriaService,
    private readonly parametros: ParametrosService,
    private readonly eventos: EventosGateway,
  ) {}

  /** Indicadores de estado de los turnos alrededor de este momento, para toda la página principal. */
  estadoActual(ahora = new Date()): IndicadorTurnoDto[] {
    const ventanaMs = this.parametros.valor('asistencia.ventana_asociacion_h') * HORA_MS;
    return this.asignacionesPublicadas()
      .filter((a) => {
        if (Date.parse(a.inicio) - ventanaMs > ahora.getTime()) return false;
        if (Date.parse(a.fin) + ventanaMs >= ahora.getTime()) return true;
        // Ya terminó: se sigue mostrando mientras falte la salida, hasta un día después.
        const m = this.marcacionesDe(a.id);
        return !!m.entrada && !m.salida && Date.parse(a.fin) + 24 * HORA_MS > ahora.getTime();
      })
      .sort((a, b) => a.inicio.localeCompare(b.inicio))
      .map((a) => this.indicador(a, ahora));
  }

  /** Qué pasaría si la persona presiona "Marcar" ahora (RF-MAIN-04). */
  miTurno(usuario: UsuarioGuardado, ahora = new Date()): MiTurnoDto {
    const abierta = this.entradaAbierta(usuario.id, ahora);
    if (abierta) {
      const a = abierta.asignacionId ? this.asignacion(abierta.asignacionId) : undefined;
      return { ahora: ahora.toISOString(), turno: a ? this.indicador(a, ahora) : null, siguiente: 'SALIDA' };
    }
    const a = this.turnoParaEntrada(usuario.id, ahora);
    return { ahora: ahora.toISOString(), turno: a ? this.indicador(a, ahora) : null, siguiente: 'ENTRADA' };
  }

  /** La persona marca entrada o salida; el servidor decide cuál según su última marcación. */
  async marcar(usuario: UsuarioGuardado, equipo: string | null, ip: string | null, ahora = new Date()): Promise<MarcacionDto> {
    const ultima = this.almacen.marcaciones
      .filtrar((m) => m.usuarioId === usuario.id && !m.corregida)
      .sort((a, b) => b.creadaEn.localeCompare(a.creadaEn))[0];
    if (ultima && ahora.getTime() - Date.parse(ultima.creadaEn) < SEGUNDOS_ENTRE_MARCACIONES * 1000) {
      throw new ConflictException(`Ya registraste tu ${ultima.tipo === 'ENTRADA' ? 'entrada' : 'salida'} hace un momento.`);
    }

    const abierta = this.entradaAbierta(usuario.id, ahora);
    const tipo: TipoMarcacion = abierta ? 'SALIDA' : 'ENTRADA';
    const asignacionId = abierta ? abierta.asignacionId : (this.turnoParaEntrada(usuario.id, ahora)?.id ?? null);
    const m = await this.almacen.marcaciones.insertar({
      id: randomUUID(),
      usuarioId: usuario.id,
      asignacionId,
      tipo,
      hora: ahora.toISOString(),
      equipo,
      ip,
      corregida: false,
      motivoCorreccion: null,
      corregidaPor: null,
      creadaEn: ahora.toISOString(),
    });
    this.notificar(m);
    return aDto(m);
  }

  listar(filtro: { desde: string; hasta: string; usuarioId?: string }): MarcacionDto[] {
    const desde = Date.parse(`${filtro.desde}T00:00:00-05:00`);
    const hasta = Date.parse(`${filtro.hasta}T23:59:59.999-05:00`);
    return this.almacen.marcaciones
      .filtrar((m) => (!filtro.usuarioId || m.usuarioId === filtro.usuarioId) && Date.parse(m.hora) >= desde && Date.parse(m.hora) <= hasta)
      .sort((a, b) => a.hora.localeCompare(b.hora))
      .map(aDto);
  }

  /**
   * RF-ASI-04: el coordinador crea o corrige una marcación con motivo obligatorio.
   * Si ya existe la marcación de ese tipo para ese turno, se corrige su hora; si no, se crea. Queda auditado.
   */
  async corregir(c: Correccion, actorId: string): Promise<MarcacionDto> {
    if (!this.almacen.usuarios.obtener(c.usuarioId)) throw new NotFoundException('La persona no existe.');
    if (Number.isNaN(Date.parse(c.hora))) throw new BadRequestException('La hora no es válida.');
    if (Date.parse(c.hora) > Date.now()) throw new BadRequestException('No se puede registrar una marcación en el futuro.');
    if (c.asignacionId) {
      const a = this.asignacion(c.asignacionId);
      if (!a || a.usuarioId !== c.usuarioId) throw new BadRequestException('El turno no corresponde a esa persona.');
    }
    const hora = new Date(c.hora).toISOString();
    const existente = c.asignacionId
      ? this.almacen.marcaciones.buscar((m) => m.asignacionId === c.asignacionId && m.tipo === c.tipo)
      : undefined;
    const datosCorreccion = { corregida: true, motivoCorreccion: c.motivo.trim(), corregidaPor: actorId };

    let m: MarcacionGuardada;
    if (existente) {
      m = (await this.almacen.marcaciones.actualizar(existente.id, (x) => ({ ...x, hora, ...datosCorreccion })))!;
    } else {
      m = await this.almacen.marcaciones.insertar({
        id: randomUUID(),
        usuarioId: c.usuarioId,
        asignacionId: c.asignacionId,
        tipo: c.tipo,
        hora,
        equipo: null,
        ip: null,
        ...datosCorreccion,
        creadaEn: new Date().toISOString(),
      });
    }
    await this.auditoria.registrar({
      actorId,
      accion: existente ? 'MARCACION_CORREGIDA' : 'MARCACION_CREADA_POR_COORDINADOR',
      entidad: 'marcacion',
      entidadId: m.id,
      antes: existente && aDto(existente),
      despues: aDto(m),
    });
    this.notificar(m);
    return aDto(m);
  }

  private notificar(m: MarcacionGuardada) {
    this.eventos.aTodos(EventoTiempoReal.MARCACION_REGISTRADA, { usuarioId: m.usuarioId, tipo: m.tipo, hora: m.hora } satisfies EventoMarcacionDto);
  }

  private asignacionesPublicadas(): AsignacionGuardada[] {
    return this.almacen.cuadros.filtrar((c) => c.estado !== 'BORRADOR').flatMap((c) => c.asignaciones.filter((a) => a.estado === 'ACTIVA'));
  }

  private asignacion(id: string) {
    return this.asignacionesPublicadas().find((a) => a.id === id);
  }

  private marcacionesDe(asignacionId: string) {
    const ms = this.almacen.marcaciones.filtrar((m) => m.asignacionId === asignacionId);
    return { entrada: ms.find((m) => m.tipo === 'ENTRADA'), salida: ms.find((m) => m.tipo === 'SALIDA') };
  }

  /**
   * Entrada sin salida que todavía se puede cerrar. Si el turno terminó hace más de la ventana
   * (la persona olvidó marcar), ya no se cierra sola: queda como "salida pendiente" para el coordinador.
   */
  private entradaAbierta(usuarioId: string, ahora: Date): MarcacionGuardada | undefined {
    const ultima = this.almacen.marcaciones.filtrar((m) => m.usuarioId === usuarioId).sort((a, b) => b.hora.localeCompare(a.hora))[0];
    if (!ultima || ultima.tipo !== 'ENTRADA') return undefined;
    const ventanaMs = this.parametros.valor('asistencia.ventana_asociacion_h') * HORA_MS;
    const a = ultima.asignacionId ? this.asignacion(ultima.asignacionId) : undefined;
    const limite = a
      ? Date.parse(a.fin) + ventanaMs
      : Date.parse(ultima.hora) + this.parametros.valor('aptitud.max_horas_continuas') * HORA_MS + ventanaMs;
    return ahora.getTime() <= limite ? ultima : undefined;
  }

  /** RF-ASI-02: turno programado más cercano, sin entrada, dentro de la ventana configurable. */
  private turnoParaEntrada(usuarioId: string, ahora: Date): AsignacionGuardada | undefined {
    const ventanaMs = this.parametros.valor('asistencia.ventana_asociacion_h') * HORA_MS;
    const t = ahora.getTime();
    return this.asignacionesPublicadas()
      .filter((a) => a.usuarioId === usuarioId && Date.parse(a.inicio) - ventanaMs <= t && t < Date.parse(a.fin) && !this.marcacionesDe(a.id).entrada)
      .sort((a, b) => Math.abs(Date.parse(a.inicio) - t) - Math.abs(Date.parse(b.inicio) - t))[0];
  }

  private indicador(a: AsignacionGuardada, ahora: Date): IndicadorTurnoDto {
    const { entrada, salida } = this.marcacionesDe(a.id);
    const fecha = hoyBogota(new Date(a.inicio));
    const estado = estadoTurno(
      {
        inicio: new Date(a.inicio),
        fin: new Date(a.fin),
        entrada: entrada && new Date(entrada.hora),
        salida: salida && new Date(salida.hora),
      },
      ahora,
      {
        toleranciaRetrasoMin: this.parametros.valor('asistencia.tolerancia_retraso_min', fecha),
        minutosAusente: this.parametros.valor('asistencia.minutos_ausente', fecha),
        alertaSalidaMin: this.parametros.valor('asistencia.alerta_salida_min', fecha),
      },
    );
    return {
      usuarioId: a.usuarioId,
      asignacionId: a.id,
      codigo: a.codigo,
      inicio: a.inicio,
      fin: a.fin,
      estado,
      ...(entrada && { entrada: entrada.hora }),
      ...(salida && { salida: salida.hora }),
    };
  }
}
