import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { evaluarAptitud, type Intervalo } from '@sgt/rules-engine';
import {
  EventoTiempoReal,
  type AdvertenciaAsignacionDto,
  type AsignacionDto,
  type CambioCeldaDto,
  type CambioVersionDto,
  type CuadroDto,
  type EventoCuadroDto,
  type HorasSemanaDto,
  type ResumenCuadroDto,
  type Rol,
} from '@sgt/shared-types';
import { randomUUID } from 'node:crypto';
import { AlmacenService } from '../almacen/almacen.service';
import type { AsignacionGuardada, CuadroGuardado } from '../almacen/modelos';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { ChatService } from '../chat/chat.service';
import { diaMes, diasEntre, esFechaValida, hoyBogota, intervaloTurno, lunesDe } from '../comun/fechas';
import { ParametrosService } from '../parametros/parametros.service';
import { EventosGateway } from '../tiempo-real/eventos.gateway';

/** Un cuadro cubre como máximo dos meses. */
const MAX_DIAS_PERIODO = 62;
const HORA_MS = 3_600_000;

const aResumen = (c: CuadroGuardado): ResumenCuadroDto => ({
  id: c.id,
  periodoInicio: c.periodoInicio,
  periodoFin: c.periodoFin,
  estado: c.estado,
  versionActual: c.versionActual,
  creadoEn: c.creadoEn,
  publicadoEn: c.publicadoEn,
  cerradoEn: c.cerradoEn,
});

const aAsignacionDto = (cuadroId: string, a: AsignacionGuardada): AsignacionDto => ({ cuadroId, ...a });

const vigentes = (c: CuadroGuardado) => c.asignaciones.filter((a) => a.estado !== 'REEMPLAZADA');

const intervalo = (a: AsignacionGuardada) => ({ id: a.id, inicio: new Date(a.inicio), fin: new Date(a.fin) });

/** Cuadro de turnos por período: borrador → publicado (con versiones) → cerrado (RF-CUA-02 a 06, RN-06). */
@Injectable()
export class CuadrosService {
  constructor(
    private readonly almacen: AlmacenService,
    private readonly auditoria: AuditoriaService,
    private readonly parametros: ParametrosService,
    private readonly eventos: EventosGateway,
    private readonly chat: ChatService,
  ) {}

  /** Los enfermeros no ven borradores. */
  listar(rol: Rol): ResumenCuadroDto[] {
    return this.almacen.cuadros
      .filtrar((c) => rol === 'COORDINADOR' || c.estado !== 'BORRADOR')
      .sort((a, b) => b.periodoInicio.localeCompare(a.periodoInicio))
      .map(aResumen);
  }

  obtener(id: string, rol: Rol): CuadroDto {
    const c = this.almacen.cuadros.obtener(id);
    if (!c || (rol !== 'COORDINADOR' && c.estado === 'BORRADOR')) throw new NotFoundException('El cuadro no existe.');
    const coordinador = rol === 'COORDINADOR';
    return {
      ...aResumen(c),
      asignaciones: vigentes(c).map((a) => aAsignacionDto(c.id, a)),
      advertencias: coordinador ? this.advertencias(c) : [],
      semanas: coordinador ? this.semanas(c) : [],
      versiones: c.versiones.map((v) => ({ ...v, autorNombre: this.almacen.usuarios.obtener(v.autorId)?.nombres ?? null })),
    };
  }

  /** Asignaciones de cuadros publicados o cerrados en un rango de fechas: lo que ve todo el equipo. */
  asignacionesPublicadas(desde: string, hasta: string): AsignacionDto[] {
    this.validarRango(desde, hasta);
    return this.almacen.cuadros
      .filtrar((c) => c.estado !== 'BORRADOR' && c.periodoInicio <= hasta && c.periodoFin >= desde)
      .flatMap((c) => vigentes(c).filter((a) => a.fecha >= desde && a.fecha <= hasta).map((a) => aAsignacionDto(c.id, a)))
      .sort((a, b) => a.inicio.localeCompare(b.inicio));
  }

  async crear(periodoInicio: string, periodoFin: string, actorId: string): Promise<CuadroDto> {
    this.validarRango(periodoInicio, periodoFin);
    const cruce = this.almacen.cuadros.buscar((c) => c.periodoInicio <= periodoFin && c.periodoFin >= periodoInicio);
    if (cruce) throw new ConflictException(`Ya hay un cuadro del ${cruce.periodoInicio} al ${cruce.periodoFin} que cubre parte de ese período.`);
    const c = await this.almacen.cuadros.insertar({
      id: randomUUID(),
      periodoInicio,
      periodoFin,
      estado: 'BORRADOR',
      versionActual: 0,
      asignaciones: [],
      versiones: [],
      creadoPor: actorId,
      creadoEn: new Date().toISOString(),
      publicadoEn: null,
      cerradoEn: null,
    });
    await this.auditoria.registrar({ actorId, accion: 'CUADRO_CREADO', entidad: 'cuadro', entidadId: c.id, despues: aResumen(c) });
    this.notificar(c);
    return this.obtener(c.id, 'COORDINADOR');
  }

  /**
   * Cambia celdas de la grilla. En borrador se aplica directo; en un cuadro publicado exige motivo
   * y crea una nueva versión con autor, fecha y el detalle de lo que cambió (RF-CUA-05).
   */
  async cambiarCeldas(id: string, cambios: CambioCeldaDto[], motivo: string | undefined, actorId: string): Promise<CuadroDto> {
    this.existente(id);
    const claves = new Set(cambios.map((x) => `${x.usuarioId}|${x.fecha}`));
    if (claves.size !== cambios.length) throw new BadRequestException('Hay celdas repetidas en el mismo cambio.');
    for (const x of cambios) {
      if (!esFechaValida(x.fecha)) throw new BadRequestException(`La fecha ${x.fecha} no existe.`);
      const u = this.almacen.usuarios.obtener(x.usuarioId);
      if (!u) throw new BadRequestException('Una de las personas no existe.');
      if (x.tipoTurnoId !== null && !u.activo) throw new BadRequestException(`${u.nombres} está inactivo/a y no puede recibir turnos.`);
      if (x.tipoTurnoId !== null && !this.almacen.tiposTurno.obtener(x.tipoTurnoId)?.activo) {
        throw new BadRequestException('El tipo de turno no existe o está inactivo.');
      }
    }

    let registro: CambioVersionDto[] = [];
    // Las reglas de estado se revisan dentro de la escritura, con la última versión guardada del cuadro.
    const despues = await this.almacen.cuadros.actualizar(id, (c) => {
      if (c.estado === 'CERRADO') throw new BadRequestException('El cuadro está cerrado y ya no se puede modificar.');
      const publicado = c.estado === 'PUBLICADO';
      if (publicado && !motivo?.trim()) throw new BadRequestException('Escribe el motivo del cambio: queda en el historial del cuadro.');
      if (cambios.some((x) => x.fecha < c.periodoInicio || x.fecha > c.periodoFin)) {
        throw new BadRequestException(`Las fechas deben estar entre el ${c.periodoInicio} y el ${c.periodoFin}.`);
      }

      registro = [];
      for (const x of cambios) {
        const actual = c.asignaciones.find((a) => a.usuarioId === x.usuarioId && a.fecha === x.fecha && a.estado !== 'REEMPLAZADA');
        if ((actual?.tipoTurnoId ?? null) === x.tipoTurnoId) continue;
        if (actual) {
          // En un cuadro publicado nada se borra: la asignación anterior queda como reemplazada.
          if (publicado) actual.estado = 'REEMPLAZADA';
          else c.asignaciones = c.asignaciones.filter((a) => a !== actual);
        }
        const tipo = x.tipoTurnoId ? this.almacen.tiposTurno.obtener(x.tipoTurnoId)! : null;
        if (tipo) {
          const { inicio, fin } = intervaloTurno(x.fecha, tipo.horaInicio, tipo.horaFin);
          c.asignaciones.push({
            id: randomUUID(),
            usuarioId: x.usuarioId,
            tipoTurnoId: tipo.id,
            codigo: tipo.codigo,
            fecha: x.fecha,
            inicio: inicio.toISOString(),
            fin: fin.toISOString(),
            estado: 'ACTIVA',
          });
        }
        registro.push({ usuarioId: x.usuarioId, fecha: x.fecha, antes: actual?.codigo ?? null, despues: tipo?.codigo ?? null });
      }

      if (publicado && registro.length) {
        c.versionActual += 1;
        c.versiones.push({ numero: c.versionActual, autorId: actorId, motivo: motivo!.trim(), creadoEn: new Date().toISOString(), cambios: registro });
      }
      return c;
    });

    if (registro.length) {
      if (despues!.estado === 'PUBLICADO') {
        await this.auditoria.registrar({
          actorId,
          accion: 'CUADRO_MODIFICADO',
          entidad: 'cuadro',
          entidadId: id,
          despues: { version: despues!.versionActual, motivo, cambios: registro },
        });
      }
      this.notificar(despues!);
    }
    return this.obtener(id, 'COORDINADOR');
  }

  /** Aplica cambios de celdas que pueden caer en distintos cuadros (p. ej. un intercambio entre meses). */
  async cambiarCeldasEnFechas(cambios: CambioCeldaDto[], motivo: string, actorId: string) {
    const porCuadro = new Map<string, CambioCeldaDto[]>();
    for (const x of cambios) {
      const c = this.almacen.cuadros.buscar((k) => k.estado !== 'BORRADOR' && k.periodoInicio <= x.fecha && k.periodoFin >= x.fecha);
      if (!c) throw new BadRequestException(`No hay un cuadro publicado para el ${x.fecha}.`);
      porCuadro.set(c.id, [...(porCuadro.get(c.id) ?? []), x]);
    }
    for (const [id, lista] of porCuadro) await this.cambiarCeldas(id, lista, motivo, actorId);
  }

  /**
   * RF-VAC-04: los turnos de la persona en el rango quedan liberados ("requiere cobertura")
   * en una nueva versión de cada cuadro publicado afectado.
   */
  async liberarTurnos(usuarioId: string, desde: string, hasta: string, motivo: string, actorId: string) {
    const afectados = this.almacen.cuadros.filtrar((c) => c.estado === 'PUBLICADO' && c.periodoInicio <= hasta && c.periodoFin >= desde);
    for (const { id } of afectados) {
      const registro: CambioVersionDto[] = [];
      const c = await this.almacen.cuadros.actualizar(id, (x) => {
        for (const a of x.asignaciones) {
          if (a.usuarioId !== usuarioId || a.estado !== 'ACTIVA' || a.fecha < desde || a.fecha > hasta) continue;
          a.estado = 'LIBERADA';
          registro.push({ usuarioId, fecha: a.fecha, antes: a.codigo, despues: null });
        }
        if (registro.length) {
          x.versionActual += 1;
          x.versiones.push({ numero: x.versionActual, autorId: actorId, motivo, creadoEn: new Date().toISOString(), cambios: registro });
        }
        return x;
      });
      if (!registro.length) continue;
      this.notificar(c!);
      const nombre = this.almacen.usuarios.obtener(usuarioId)?.nombres ?? 'una persona';
      for (const r of registro) await this.chat.sistema(`El turno ${r.antes} del ${diaMes(r.fecha)} de ${nombre} requiere cobertura.`);
    }
  }

  async publicar(id: string, actorId: string): Promise<CuadroDto> {
    this.existente(id);
    const ahora = new Date().toISOString();
    const c = await this.almacen.cuadros.actualizar(id, (x) => {
      if (x.estado !== 'BORRADOR') throw new BadRequestException('El cuadro ya fue publicado.');
      if (!x.asignaciones.length) throw new BadRequestException('El cuadro no tiene turnos asignados.');
      return {
        ...x,
        estado: 'PUBLICADO',
        versionActual: 1,
        publicadoEn: ahora,
        versiones: [{ numero: 1, autorId: actorId, motivo: 'Publicación del cuadro', creadoEn: ahora, cambios: [] }],
      };
    });
    const advertencias = this.advertencias(c!).length;
    await this.auditoria.registrar({ actorId, accion: 'CUADRO_PUBLICADO', entidad: 'cuadro', entidadId: id, despues: { ...aResumen(c!), advertencias } });
    this.notificar(c!);
    await this.chat.sistema(`Se publicó el cuadro de turnos del ${diaMes(c!.periodoInicio)} al ${diaMes(c!.periodoFin)}. Ya lo pueden consultar.`);
    return this.obtener(id, 'COORDINADOR');
  }

  /** RF-CUA-06: cierra el período cuando ya terminó; después no admite cambios. */
  async cerrar(id: string, actorId: string): Promise<CuadroDto> {
    this.existente(id);
    const hoy = hoyBogota();
    const c = await this.almacen.cuadros.actualizar(id, (x) => {
      if (x.estado !== 'PUBLICADO') throw new BadRequestException('Solo se puede cerrar un cuadro publicado.');
      if (x.periodoFin >= hoy) throw new BadRequestException('Solo se puede cerrar un cuadro cuyo período ya terminó.');
      return { ...x, estado: 'CERRADO', cerradoEn: new Date().toISOString() };
    });
    await this.auditoria.registrar({ actorId, accion: 'CUADRO_CERRADO', entidad: 'cuadro', entidadId: id, despues: aResumen(c!) });
    this.notificar(c!);
    return this.obtener(id, 'COORDINADOR');
  }

  /** Solo se pueden descartar borradores: lo publicado es historia. */
  async eliminar(id: string, actorId: string) {
    const c = this.existente(id);
    if (c.estado !== 'BORRADOR') throw new BadRequestException('Solo se puede descartar un cuadro en borrador.');
    await this.almacen.cuadros.eliminar(id);
    await this.auditoria.registrar({ actorId, accion: 'CUADRO_DESCARTADO', entidad: 'cuadro', entidadId: id, antes: aResumen(c) });
    this.eventos.aCoordinadores(EventoTiempoReal.CUADRO_ACTUALIZADO, { cuadroId: id, estado: 'BORRADOR', versionActual: 0 } satisfies EventoCuadroDto);
  }

  private existente(id: string) {
    const c = this.almacen.cuadros.obtener(id);
    if (!c) throw new NotFoundException('El cuadro no existe.');
    return c;
  }

  private validarRango(desde: string, hasta: string) {
    if (!esFechaValida(desde) || !esFechaValida(hasta)) throw new BadRequestException('Las fechas deben tener el formato YYYY-MM-DD.');
    if (hasta < desde) throw new BadRequestException('La fecha final debe ser posterior a la inicial.');
    if (diasEntre(desde, hasta) + 1 > MAX_DIAS_PERIODO) throw new BadRequestException(`El período no puede superar ${MAX_DIAS_PERIODO} días.`);
  }

  private notificar(c: CuadroGuardado) {
    const evento: EventoCuadroDto = { cuadroId: c.id, estado: c.estado, versionActual: c.versionActual };
    if (c.estado === 'BORRADOR') this.eventos.aCoordinadores(EventoTiempoReal.CUADRO_ACTUALIZADO, evento);
    else this.eventos.aTodos(EventoTiempoReal.CUADRO_ACTUALIZADO, evento);
  }

  /** Asignaciones activas por persona en todos los cuadros, para evaluar reglas que cruzan de un período a otro. */
  private activasPorPersona(): Map<string, (Intervalo & { id: string })[]> {
    const r = new Map<string, (Intervalo & { id: string })[]>();
    for (const c of this.almacen.cuadros.todos()) {
      for (const a of c.asignaciones) {
        if (a.estado !== 'ACTIVA') continue;
        r.set(a.usuarioId, [...(r.get(a.usuarioId) ?? []), intervalo(a)]);
      }
    }
    return r;
  }

  /**
   * RF-CUA-03: cruces, descanso insuficiente y noches seguidas por asignación, con el mismo motor de reglas
   * del filtro de aptos (RN-03). El exceso semanal se muestra aparte, en las horas por semana.
   */
  private advertencias(c: CuadroGuardado): AdvertenciaAsignacionDto[] {
    const porPersona = this.activasPorPersona();
    const r: AdvertenciaAsignacionDto[] = [];
    for (const a of c.asignaciones) {
      if (a.estado !== 'ACTIVA') continue;
      const p = (clave: Parameters<ParametrosService['valor']>[0]) => this.parametros.valor(clave, a.fecha) as number;
      const resultado = evaluarAptitud(
        {
          activo: this.almacen.usuarios.obtener(a.usuarioId)?.activo ?? false,
          asignaciones: (porPersona.get(a.usuarioId) ?? []).filter((x) => x.id !== a.id),
          ausencias: [],
        },
        intervalo(a),
        {
          descansoMinimoH: p('aptitud.descanso_minimo_h'),
          maxNochesConsecutivas: p('aptitud.max_noches_consecutivas'),
          // Sin límite semanal aquí: se evalúa en `semanas`.
          maximaSemanalH: Number.POSITIVE_INFINITY,
          maxExtraSemanalH: 0,
          umbralAlertaPct: 100,
        },
      );
      if (resultado.clasificacion !== 'APTO') r.push({ asignacionId: a.id, clasificacion: resultado.clasificacion, motivos: resultado.motivos });
    }
    return r;
  }

  /** RN-02: horas programadas por persona y semana (lunes a domingo), incluidas las de cuadros vecinos. */
  private semanas(c: CuadroGuardado): HorasSemanaDto[] {
    const primerLunes = lunesDe(c.periodoInicio);
    const totales = new Map<string, number>();
    for (const otro of this.almacen.cuadros.todos()) {
      for (const a of otro.asignaciones) {
        if (a.estado !== 'ACTIVA' || a.fecha < primerLunes || lunesDe(a.fecha) > c.periodoFin) continue;
        const clave = `${a.usuarioId}|${lunesDe(a.fecha)}`;
        totales.set(clave, (totales.get(clave) ?? 0) + (Date.parse(a.fin) - Date.parse(a.inicio)) / HORA_MS);
      }
    }
    return [...totales].map(([clave, horas]) => {
      const [usuarioId, lunes] = clave.split('|');
      const maximaH = this.parametros.valor('jornada.maxima_semanal_h', lunes);
      return { usuarioId, lunes, horas, maximaH, topeH: maximaH + this.parametros.valor('extra.max_semanales_h', lunes) };
    });
  }
}
