import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { evaluarAptitud } from '@sgt/rules-engine';
import { EventoTiempoReal, type AsignacionDto, type CambioCeldaDto, type NuevaSolicitudDto, type SolicitudDto } from '@sgt/shared-types';
import { randomUUID } from 'node:crypto';
import { AlmacenService } from '../almacen/almacen.service';
import { Cola } from '../almacen/archivo-json';
import type { AsignacionGuardada, SolicitudGuardada, UsuarioGuardado } from '../almacen/modelos';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { aInstante, diasEntre, esFechaValida, hoyBogota, sumarDias } from '../comun/fechas';
import { CuadrosService } from '../cuadros/cuadros.service';
import { ParametrosService } from '../parametros/parametros.service';
import { EventosGateway } from '../tiempo-real/eventos.gateway';

const NOMBRE_TIPO = { INTERCAMBIO: 'intercambio', CESION: 'cesión', PERMISO: 'permiso', VACACIONES: 'vacaciones' } as const;

/**
 * Solicitudes (RF-SOL-01 a 08). Flujo sencillo:
 * - Intercambio y cesión: el compañero acepta → el coordinador aprueba → el cuadro cambia solo.
 * - Permiso y vacaciones: el coordinador aprueba → los turnos de esas fechas quedan "requiere cobertura".
 */
@Injectable()
export class SolicitudesService {
  /** Los cambios de estado van en orden: así no se cruzan, por ejemplo, una aprobación y una cancelación. */
  private readonly cola = new Cola();

  constructor(
    private readonly almacen: AlmacenService,
    private readonly auditoria: AuditoriaService,
    private readonly parametros: ParametrosService,
    private readonly cuadros: CuadrosService,
    private readonly eventos: EventosGateway,
  ) {}

  listar(usuario: UsuarioGuardado): SolicitudDto[] {
    return this.almacen.solicitudes
      .filtrar((s) => usuario.rol === 'COORDINADOR' || s.solicitanteId === usuario.id || s.companeroId === usuario.id)
      .sort((a, b) => b.creadaEn.localeCompare(a.creadaEn))
      .map((s) => this.aDto(s));
  }

  async crear(dto: NuevaSolicitudDto, usuario: UsuarioGuardado): Promise<SolicitudDto> {
    const conCompanero = dto.tipo === 'INTERCAMBIO' || dto.tipo === 'CESION';
    const base = {
      id: randomUUID(),
      tipo: dto.tipo,
      solicitanteId: usuario.id,
      companeroId: null,
      asignacionId: null,
      asignacionDestinoId: null,
      desde: null,
      hasta: null,
      categoria: null,
      comentario: dto.comentario?.trim() ?? '',
      respuesta: null,
      autoaprobada: false,
      resueltaPor: null,
      creadaEn: new Date().toISOString(),
      resueltaEn: null,
    } satisfies Omit<SolicitudGuardada, 'estado'>;

    let s: SolicitudGuardada;
    if (conCompanero) {
      if (!dto.asignacionId || !dto.companeroId) throw new BadRequestException('Elige tu turno y el compañero.');
      if (dto.tipo === 'INTERCAMBIO' && !dto.asignacionDestinoId) throw new BadRequestException('Elige el turno del compañero que tomas a cambio.');
      s = { ...base, estado: 'PENDIENTE_COMPANERO', companeroId: dto.companeroId, asignacionId: dto.asignacionId, asignacionDestinoId: dto.asignacionDestinoId ?? null };
      this.validarCambio(s);
      if (this.almacen.solicitudes.buscar((x) => x.asignacionId === s.asignacionId && x.estado.startsWith('PENDIENTE'))) {
        throw new ConflictException('Ya hay una solicitud pendiente para ese turno.');
      }
    } else {
      if (!dto.desde || !dto.hasta || !esFechaValida(dto.desde) || !esFechaValida(dto.hasta)) throw new BadRequestException('Indica las fechas desde y hasta.');
      if (dto.hasta < dto.desde) throw new BadRequestException('La fecha final debe ser igual o posterior a la inicial.');
      if (diasEntre(dto.desde, dto.hasta) > 60) throw new BadRequestException('El rango no puede superar 60 días.');
      if (dto.desde < hoyBogota()) throw new BadRequestException('No se pueden pedir días que ya pasaron.');
      if (dto.tipo === 'PERMISO' && !dto.categoria) throw new BadRequestException('Elige el motivo del permiso.');
      const anticipacion = this.parametros.valor('vacaciones.anticipacion_min_dias');
      if (dto.tipo === 'VACACIONES' && usuario.rol !== 'COORDINADOR' && dto.desde < sumarDias(hoyBogota(), anticipacion)) {
        throw new BadRequestException(`Las vacaciones se piden con al menos ${anticipacion} días de anticipación.`);
      }
      // El coordinador no necesita aprobación de nadie: queda aplicada como constancia (RF-SOL-08).
      const propia = usuario.rol === 'COORDINADOR';
      s = { ...base, estado: propia ? 'APLICADA' : 'PENDIENTE_COORDINADOR', desde: dto.desde, hasta: dto.hasta, categoria: dto.categoria ?? null, autoaprobada: propia };
    }

    await this.almacen.solicitudes.insertar(s);
    if (s.autoaprobada) await this.aplicar(s, usuario.id);
    await this.auditoria.registrar({ actorId: usuario.id, accion: 'SOLICITUD_CREADA', entidad: 'solicitud', entidadId: s.id, despues: s });
    this.notificar();
    return this.aDto(s);
  }

  /** RF-SOL-02: el compañero acepta o rechaza antes de que llegue al coordinador. */
  responder(id: string, acepta: boolean, usuario: UsuarioGuardado) {
    return this.cola.ejecutar(() => this.responderEnOrden(id, acepta, usuario));
  }

  private async responderEnOrden(id: string, acepta: boolean, usuario: UsuarioGuardado) {
    const s = this.existente(id);
    if (s.companeroId !== usuario.id) throw new ForbiddenException('Esta solicitud no está dirigida a ti.');
    if (s.estado !== 'PENDIENTE_COMPANERO') throw new BadRequestException('La solicitud ya no espera tu respuesta.');
    if (acepta) this.validarCambio(s);
    return this.cambiarEstado(s, acepta ? 'PENDIENTE_COORDINADOR' : 'RECHAZADA_COMPANERO', usuario.id, acepta ? null : 'El compañero no aceptó.');
  }

  /** RF-SOL-04: el coordinador aprueba (y el cuadro se actualiza solo) o rechaza con comentario. */
  resolver(id: string, aprueba: boolean, respuesta: string | undefined, actor: UsuarioGuardado) {
    return this.cola.ejecutar(() => this.resolverEnOrden(id, aprueba, respuesta, actor));
  }

  private async resolverEnOrden(id: string, aprueba: boolean, respuesta: string | undefined, actor: UsuarioGuardado) {
    const s = this.existente(id);
    if (s.estado !== 'PENDIENTE_COORDINADOR') throw new BadRequestException('La solicitud no está pendiente de aprobación.');
    if (aprueba) {
      if (s.asignacionId) this.validarCambio(s);
      await this.aplicar(s, actor.id);
    }
    return this.cambiarEstado(s, aprueba ? 'APLICADA' : 'RECHAZADA', actor.id, respuesta?.trim() || (aprueba ? 'Aprobada' : 'Rechazada'));
  }

  /** RF-SOL-05: quien la pidió puede cancelarla mientras no esté aprobada. */
  cancelar(id: string, usuario: UsuarioGuardado) {
    return this.cola.ejecutar(() => this.cancelarEnOrden(id, usuario));
  }

  private async cancelarEnOrden(id: string, usuario: UsuarioGuardado) {
    const s = this.existente(id);
    if (s.solicitanteId !== usuario.id) throw new ForbiddenException('Solo quien hizo la solicitud puede cancelarla.');
    if (!s.estado.startsWith('PENDIENTE')) throw new BadRequestException('Solo se pueden cancelar solicitudes pendientes.');
    return this.cambiarEstado(s, 'CANCELADA', usuario.id, null);
  }

  private async cambiarEstado(s: SolicitudGuardada, estado: SolicitudGuardada['estado'], actorId: string, respuesta: string | null) {
    const final = estado === 'APLICADA' || estado.startsWith('RECHAZADA') || estado === 'CANCELADA';
    const nueva = await this.almacen.solicitudes.actualizar(s.id, (x) => ({
      ...x,
      estado,
      respuesta: respuesta ?? x.respuesta,
      ...(final && { resueltaPor: actorId, resueltaEn: new Date().toISOString() }),
    }));
    await this.auditoria.registrar({ actorId, accion: `SOLICITUD_${estado}`, entidad: 'solicitud', entidadId: s.id, antes: { estado: s.estado }, despues: { estado, respuesta } });
    this.notificar();
    return this.aDto(nueva!);
  }

  /** Lleva la solicitud al cuadro (nueva versión con motivo). */
  private async aplicar(s: SolicitudGuardada, actorId: string) {
    const nombre = this.almacen.usuarios.obtener(s.solicitanteId)?.nombres ?? 'Persona';
    const motivo = `Solicitud de ${NOMBRE_TIPO[s.tipo]} de ${nombre}${s.comentario ? `: ${s.comentario}` : ''}`.slice(0, 300);
    if (s.tipo === 'PERMISO' || s.tipo === 'VACACIONES') {
      await this.cuadros.liberarTurnos(s.solicitanteId, s.desde!, s.hasta!, motivo, actorId);
      return;
    }
    const origen = this.turno(s.asignacionId!)!;
    const destino = s.asignacionDestinoId ? this.turno(s.asignacionDestinoId)! : null;
    // Una celda por persona y día: se arma el estado final de cada celda afectada.
    const celdas = new Map<string, CambioCeldaDto>();
    const poner = (usuarioId: string, fecha: string, tipoTurnoId: string | null) => celdas.set(`${usuarioId}|${fecha}`, { usuarioId, fecha, tipoTurnoId });
    poner(origen.usuarioId, origen.fecha, null);
    if (destino) poner(destino.usuarioId, destino.fecha, null);
    poner(s.companeroId!, origen.fecha, origen.tipoTurnoId);
    if (destino) poner(s.solicitanteId, destino.fecha, destino.tipoTurnoId);
    await this.cuadros.cambiarCeldasEnFechas([...celdas.values()], motivo, actorId);
  }

  /**
   * Revisa que los turnos sigan igual y que cada persona pueda tomar el turno que recibe (RF-SOL-03, RN-03).
   * Se usa al crear, al aceptar y al aprobar, porque el cuadro puede cambiar en el medio.
   */
  private validarCambio(s: SolicitudGuardada) {
    const origen = this.turno(s.asignacionId!);
    if (!origen || origen.usuarioId !== s.solicitanteId) throw new ConflictException('Tu turno ya no está en el cuadro publicado.');
    if (Date.parse(origen.inicio) <= Date.now()) throw new BadRequestException('Solo se pueden cambiar turnos que aún no empiezan.');
    const companero = this.almacen.usuarios.obtener(s.companeroId!);
    if (!companero?.activo || companero.id === s.solicitanteId) throw new BadRequestException('Elige un compañero activo.');
    const destino = s.asignacionDestinoId ? this.turno(s.asignacionDestinoId) : null;
    if (s.asignacionDestinoId) {
      if (!destino || destino.usuarioId !== companero.id) throw new ConflictException('El turno del compañero ya no está en el cuadro publicado.');
      if (Date.parse(destino.inicio) <= Date.now()) throw new BadRequestException('Solo se pueden cambiar turnos que aún no empiezan.');
    }
    const excluir = [origen.id, destino?.id].filter(Boolean) as string[];
    this.exigirApto(companero, origen, excluir);
    if (destino) this.exigirApto(this.almacen.usuarios.obtener(s.solicitanteId)!, destino, excluir);
  }

  private exigirApto(persona: UsuarioGuardado, turno: AsignacionGuardada, excluir: string[]) {
    const propias = this.publicadas().filter((a) => a.usuarioId === persona.id && !excluir.includes(a.id));
    if (propias.some((a) => a.fecha === turno.fecha)) throw new BadRequestException(`${persona.nombres} ya tiene un turno el ${turno.fecha}.`);
    const ausencias = this.almacen.solicitudes
      .filtrar((x) => x.solicitanteId === persona.id && x.estado === 'APLICADA' && !!x.desde && !!x.hasta)
      .map((x) => ({ inicio: aInstante(x.desde!, '00:00'), fin: aInstante(sumarDias(x.hasta!, 1), '00:00') }));
    const maxima = this.parametros.valor('jornada.maxima_semanal_h', turno.fecha);
    const r = evaluarAptitud(
      { activo: persona.activo, asignaciones: propias.map((a) => ({ inicio: new Date(a.inicio), fin: new Date(a.fin) })), ausencias },
      { inicio: new Date(turno.inicio), fin: new Date(turno.fin) },
      {
        descansoMinimoH: this.parametros.valor('aptitud.descanso_minimo_h', turno.fecha),
        maximaSemanalH: maxima,
        maxExtraSemanalH: this.parametros.valor('extra.max_semanales_h', turno.fecha),
        umbralAlertaPct: this.parametros.valor('aptitud.umbral_alerta_pct', turno.fecha),
        maxNochesConsecutivas: this.parametros.valor('aptitud.max_noches_consecutivas', turno.fecha),
      },
    );
    if (r.clasificacion === 'NO_APTO') throw new BadRequestException(`${persona.nombres} no puede tomar ese turno: ${r.motivos.join('; ')}.`);
  }

  private publicadas(): AsignacionGuardada[] {
    return this.almacen.cuadros.filtrar((c) => c.estado !== 'BORRADOR').flatMap((c) => c.asignaciones.filter((a) => a.estado === 'ACTIVA'));
  }

  private turno(id: string) {
    return this.publicadas().find((a) => a.id === id);
  }

  /** Busca el turno aunque ya no esté activo, para mostrar el detalle de solicitudes viejas. */
  private turnoDto(id: string | null): AsignacionDto | null {
    if (!id) return null;
    for (const c of this.almacen.cuadros.todos()) {
      const a = c.asignaciones.find((x) => x.id === id);
      if (a) return { cuadroId: c.id, ...a };
    }
    return null;
  }

  private existente(id: string) {
    const s = this.almacen.solicitudes.obtener(id);
    if (!s) throw new NotFoundException('La solicitud no existe.');
    return s;
  }

  private aDto(s: SolicitudGuardada): SolicitudDto {
    const { asignacionId, asignacionDestinoId, resueltaPor: _, ...resto } = s;
    return { ...resto, asignacion: this.turnoDto(asignacionId), asignacionDestino: this.turnoDto(asignacionDestinoId) };
  }

  private notificar() {
    this.eventos.aTodos(EventoTiempoReal.SOLICITUD_ACTUALIZADA, {});
  }
}
