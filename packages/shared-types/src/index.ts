// Tipos compartidos entre la API (NestJS) y la app de escritorio (React).
// Los enums se declaran como objetos `as const` para que sirvan como valores y como tipos.

export const Rol = {
  ENFERMERO: 'ENFERMERO',
  COORDINADOR: 'COORDINADOR',
} as const;
export type Rol = (typeof Rol)[keyof typeof Rol];

/** Cargo laboral (ADR-008). Es independiente del rol dentro de la app. */
export const Cargo = {
  AUXILIAR: 'AUXILIAR',
  PROFESIONAL: 'PROFESIONAL',
  JEFE: 'JEFE',
  ESPECIALISTA: 'ESPECIALISTA',
} as const;
export type Cargo = (typeof Cargo)[keyof typeof Cargo];

export const NOMBRE_CARGO: Record<Cargo, string> = {
  AUXILIAR: 'Auxiliar de enfermería',
  PROFESIONAL: 'Enfermero/a profesional',
  JEFE: 'Enfermero/a jefe',
  ESPECIALISTA: 'Enfermero/a especialista',
};

export const EstadoCuadro = {
  BORRADOR: 'BORRADOR',
  PUBLICADO: 'PUBLICADO',
  CERRADO: 'CERRADO',
} as const;
export type EstadoCuadro = (typeof EstadoCuadro)[keyof typeof EstadoCuadro];

export const EstadoAsignacion = {
  ACTIVA: 'ACTIVA',
  LIBERADA: 'LIBERADA',
  REEMPLAZADA: 'REEMPLAZADA',
} as const;
export type EstadoAsignacion = (typeof EstadoAsignacion)[keyof typeof EstadoAsignacion];

export const TipoMarcacion = {
  ENTRADA: 'ENTRADA',
  SALIDA: 'SALIDA',
} as const;
export type TipoMarcacion = (typeof TipoMarcacion)[keyof typeof TipoMarcacion];

/** Indicadores de la página principal (RF-MAIN-02). */
export const EstadoTurno = {
  PROGRAMADO: 'PROGRAMADO',
  EN_TURNO: 'EN_TURNO',
  RETRASADO: 'RETRASADO',
  AUSENTE: 'AUSENTE',
  SALIDA_PENDIENTE: 'SALIDA_PENDIENTE',
  FINALIZADO: 'FINALIZADO',
} as const;
export type EstadoTurno = (typeof EstadoTurno)[keyof typeof EstadoTurno];

export const TipoSolicitud = {
  INTERCAMBIO: 'INTERCAMBIO',
  CESION: 'CESION',
  PERMISO: 'PERMISO',
  VACACIONES: 'VACACIONES',
} as const;
export type TipoSolicitud = (typeof TipoSolicitud)[keyof typeof TipoSolicitud];

/** Máquina de estados de §9.7 del plan técnico. */
export const EstadoSolicitud = {
  BORRADOR: 'BORRADOR',
  PENDIENTE_COMPANERO: 'PENDIENTE_COMPANERO',
  RECHAZADA_COMPANERO: 'RECHAZADA_COMPANERO',
  PENDIENTE_COORDINADOR: 'PENDIENTE_COORDINADOR',
  APROBADA: 'APROBADA',
  RECHAZADA: 'RECHAZADA',
  CANCELADA: 'CANCELADA',
  APLICADA: 'APLICADA',
} as const;
export type EstadoSolicitud = (typeof EstadoSolicitud)[keyof typeof EstadoSolicitud];

export const CategoriaPermiso = {
  PERSONAL: 'PERSONAL',
  CALAMIDAD: 'CALAMIDAD',
  CITA_MEDICA: 'CITA_MEDICA',
  ACADEMICO: 'ACADEMICO',
  OTRO: 'OTRO',
} as const;
export type CategoriaPermiso = (typeof CategoriaPermiso)[keyof typeof CategoriaPermiso];

export const NOMBRE_CATEGORIA_PERMISO: Record<CategoriaPermiso, string> = {
  PERSONAL: 'Personal',
  CALAMIDAD: 'Calamidad doméstica',
  CITA_MEDICA: 'Cita médica',
  ACADEMICO: 'Académico',
  OTRO: 'Otro',
};

/** Estado de egreso del paciente (RF-PAC-05). */
export const EstadoEgreso = {
  CONTINUA_HOSPITALIZADO: 'CONTINUA_HOSPITALIZADO',
  ALTA_MEJORADO: 'ALTA_MEJORADO',
  REMITIDO: 'REMITIDO',
  ALTA_VOLUNTARIA: 'ALTA_VOLUNTARIA',
  FALLECIDO: 'FALLECIDO',
  OTRO: 'OTRO',
} as const;
export type EstadoEgreso = (typeof EstadoEgreso)[keyof typeof EstadoEgreso];

export const TipoDocumento = {
  CC: 'CC',
  TI: 'TI',
  RC: 'RC',
  CE: 'CE',
  PA: 'PA',
  PPT: 'PPT',
} as const;
export type TipoDocumento = (typeof TipoDocumento)[keyof typeof TipoDocumento];

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export interface UsuarioResumenDto {
  id: string;
  nombres: string;
  rol: Rol;
  cargo: Cargo;
  activo: boolean;
}

export interface SalarioDto {
  salarioBase: number;
  /** "YYYY-MM-DD" */
  vigenteDesde: string;
}

/** Usuario completo: lo ve el coordinador y cada persona sobre sí misma. */
export interface UsuarioDto extends UsuarioResumenDto {
  documento: string;
  email: string | null;
  /** "YYYY-MM-DD" */
  fechaIngreso: string;
  debeCambiarPassword: boolean;
  salarios: SalarioDto[];
}

export interface RespuestaLoginDto {
  tokenAcceso: string;
  tokenRefresco: string;
  /** Segundos de vida del token de acceso. */
  expiraEn: number;
  usuario: UsuarioDto;
}

/** Respuesta al crear un usuario o restablecer su contraseña. */
export interface UsuarioConPasswordTemporalDto {
  usuario: UsuarioDto;
  passwordTemporal: string;
  advertencias: string[];
}

/** Código de error cuando la persona debe cambiar la contraseña temporal antes de seguir (RF-AUT-04). */
export const CODIGO_DEBE_CAMBIAR_PASSWORD = 'DEBE_CAMBIAR_PASSWORD';

export interface TipoTurnoDto {
  id: string;
  codigo: string;
  nombre: string;
  /** Hora local "HH:mm". */
  horaInicio: string;
  /** Hora local "HH:mm". Si es menor o igual a horaInicio, el turno termina al día siguiente. */
  horaFin: string;
  color: string;
  activo: boolean;
}

export type ValorParametro = string | number | boolean;

export interface ParametroDto {
  clave: string;
  valor: ValorParametro;
  /** "YYYY-MM-DD" */
  vigenteDesde: string;
  /** "YYYY-MM-DD" o null si sigue vigente. */
  vigenteHasta: string | null;
}

export interface FestivoDto {
  /** "YYYY-MM-DD" */
  fecha: string;
  nombre: string;
}

export interface EventoAuditoriaDto {
  fecha: string;
  actorId: string | null;
  actorNombre: string | null;
  accion: string;
  entidad: string;
  entidadId: string | null;
  antes?: unknown;
  despues?: unknown;
}

export interface AsignacionDto {
  id: string;
  cuadroId: string;
  usuarioId: string;
  tipoTurnoId: string;
  /** Código del tipo de turno cuando se asignó (M, T, N…). */
  codigo: string;
  /** Día local en que empieza el turno, "YYYY-MM-DD". */
  fecha: string;
  /** ISO 8601 en UTC. */
  inicio: string;
  fin: string;
  estado: EstadoAsignacion;
}

export interface ResumenCuadroDto {
  id: string;
  /** "YYYY-MM-DD" */
  periodoInicio: string;
  periodoFin: string;
  estado: EstadoCuadro;
  /** 0 mientras es borrador; 1 al publicar y +1 por cada cambio posterior (RF-CUA-05). */
  versionActual: number;
  creadoEn: string;
  publicadoEn: string | null;
  cerradoEn: string | null;
}

/** Cambio de una celda de la grilla: una persona, un día. `tipoTurnoId: null` deja el día libre. */
export interface CambioCeldaDto {
  usuarioId: string;
  fecha: string;
  tipoTurnoId: string | null;
}

export interface CambioVersionDto {
  usuarioId: string;
  fecha: string;
  /** Código del turno antes y después; null = día libre. */
  antes: string | null;
  despues: string | null;
}

export interface VersionCuadroDto {
  numero: number;
  autorId: string;
  autorNombre: string | null;
  motivo: string;
  creadoEn: string;
  cambios: CambioVersionDto[];
}

/** Advertencias de reglas de una asignación (RF-CUA-03). No bloquean: el coordinador decide. */
export interface AdvertenciaAsignacionDto {
  asignacionId: string;
  clasificacion: 'NO_APTO' | 'APTO_CON_ADVERTENCIA';
  motivos: string[];
}

/** Horas programadas de una persona en una semana (lunes a domingo, RN-02). */
export interface HorasSemanaDto {
  usuarioId: string;
  /** Lunes de la semana, "YYYY-MM-DD". */
  lunes: string;
  horas: number;
  maximaH: number;
  /** Jornada máxima + tope de horas extra. */
  topeH: number;
}

export interface CuadroDto extends ResumenCuadroDto {
  /** Asignaciones vigentes (activas o liberadas). Las reemplazadas solo quedan en el historial. */
  asignaciones: AsignacionDto[];
  /** Solo para el coordinador. */
  advertencias: AdvertenciaAsignacionDto[];
  semanas: HorasSemanaDto[];
  versiones: VersionCuadroDto[];
}

export interface MarcacionDto {
  id: string;
  usuarioId: string;
  /** null = marcación sin turno, queda para revisión del coordinador (RF-ASI-02). */
  asignacionId: string | null;
  tipo: TipoMarcacion;
  /** Hora del servidor, ISO 8601 en UTC (RF-ASI-01). */
  hora: string;
  equipo: string | null;
  corregida: boolean;
  motivoCorreccion: string | null;
  corregidaPor: string | null;
}

export interface IndicadorTurnoDto {
  usuarioId: string;
  asignacionId: string;
  codigo: string;
  inicio: string;
  fin: string;
  estado: EstadoTurno;
  entrada?: string;
  salida?: string;
}

/** Lo que necesita la página principal para el botón de marcar (RF-MAIN-04). */
export interface MiTurnoDto {
  /** Hora del servidor, para que la app no dependa del reloj del equipo. */
  ahora: string;
  /** Turno con el que se asociaría la próxima marcación, si hay uno dentro de la ventana. */
  turno: IndicadorTurnoDto | null;
  /** Próxima acción al presionar el botón. */
  siguiente: TipoMarcacion;
}

/** Pacientes atendidos en un turno (RF-PAC-01). Solo la cantidad: no se guardan datos de pacientes. */
export interface AtencionDto {
  asignacionId: string;
  usuarioId: string;
  fecha: string;
  codigo: string;
  cantidad: number;
}

export interface SolicitudDto {
  id: string;
  tipo: TipoSolicitud;
  estado: EstadoSolicitud;
  solicitanteId: string;
  /** Intercambio y cesión: quien toma el turno. */
  companeroId: string | null;
  /** Turno del solicitante que se cede o intercambia. */
  asignacion: AsignacionDto | null;
  /** Intercambio: turno del compañero que el solicitante toma a cambio. */
  asignacionDestino: AsignacionDto | null;
  /** Permiso y vacaciones: rango de días "YYYY-MM-DD". */
  desde: string | null;
  hasta: string | null;
  categoria: CategoriaPermiso | null;
  comentario: string;
  /** Comentario del coordinador (o del compañero si rechazó). */
  respuesta: string | null;
  /** Solicitud del propio coordinador: queda aplicada sin aprobación (RF-SOL-08). */
  autoaprobada: boolean;
  creadaEn: string;
  resueltaEn: string | null;
}

export interface NuevaSolicitudDto {
  tipo: TipoSolicitud;
  companeroId?: string;
  asignacionId?: string;
  asignacionDestinoId?: string;
  desde?: string;
  hasta?: string;
  categoria?: CategoriaPermiso;
  comentario?: string;
}

/** Eventos en tiempo real (Socket.IO, RF-MAIN-05). */
export const EventoTiempoReal = {
  CUADRO_ACTUALIZADO: 'cuadro.actualizado',
  MARCACION_REGISTRADA: 'marcacion.registrada',
  SOLICITUD_ACTUALIZADA: 'solicitud.actualizada',
  CHAT_ACTUALIZADO: 'chat.actualizado',
} as const;
export type EventoTiempoReal = (typeof EventoTiempoReal)[keyof typeof EventoTiempoReal];

export interface EventoCuadroDto {
  cuadroId: string;
  estado: EstadoCuadro;
  versionActual: number;
}

export interface EventoMarcacionDto {
  usuarioId: string;
  tipo: TipoMarcacion;
  hora: string;
}

export interface MensajeChatDto {
  id: string;
  /** null en los mensajes automáticos del sistema. */
  autorId: string | null;
  contenido: string;
  esNovedad: boolean;
  creadoEn: string;
}

export interface NuevoMensajeDto {
  contenido: string;
  esNovedad?: boolean;
}

// ---------------------------------------------------------------------------
// Parámetros laborales por defecto (docs/02_Decisiones_Respuestas_Cliente.md §2)
// ---------------------------------------------------------------------------

export const PARAMETROS_DEFECTO = {
  'jornada.inicio_nocturna': '19:00',
  'jornada.fin_nocturna': '06:00',
  'jornada.maxima_semanal_h': 42,
  'jornada.divisor_mensual_h': 210,
  'extra.max_diarias_h': 2,
  'extra.max_semanales_h': 12,
  'aptitud.umbral_alerta_pct': 90,
  'aptitud.descanso_minimo_h': 12,
  'aptitud.max_noches_consecutivas': 3,
  'aptitud.max_horas_continuas': 12,
  'aptitud.dias_descanso_semana': 1,
  'asistencia.tolerancia_retraso_min': 10,
  'asistencia.minutos_ausente': 60,
  'asistencia.ventana_asociacion_h': 2,
  'asistencia.alerta_salida_min': 30,
  'vacaciones.dias_por_anio': 15,
  'vacaciones.anticipacion_min_dias': 15,
  'vacaciones.permitir_anticipadas': false,
  'seguridad.inactividad_min': 15,
  'chat.minutos_edicion': 10,
  'recargo.nocturno_pct': 35,
  'recargo.extra_diurna_pct': 25,
  'recargo.extra_nocturna_pct': 75,
  'recargo.dominical_pct': 90,
  /** SMMLV de referencia para validar salarios. Valor 2025: actualizar con el decreto vigente. */
  'nomina.smmlv': 1_423_500,
} as const;

export type ClaveParametro = keyof typeof PARAMETROS_DEFECTO;

export const ZONA_HORARIA = 'America/Bogota';
