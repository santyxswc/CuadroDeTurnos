// Forma de los documentos guardados en cada archivo JSON de la carpeta de datos.
import type { CambioVersionDto, Cargo, EstadoAsignacion, EstadoCuadro, Rol, SalarioDto, TipoMarcacion, ValorParametro } from '@sgt/shared-types';

export interface UsuarioGuardado {
  id: string;
  documento: string;
  nombres: string;
  /** En minúsculas. */
  email: string | null;
  rol: Rol;
  cargo: Cargo;
  fechaIngreso: string;
  activo: boolean;
  /** Argon2id. Nunca sale de la API. */
  hashPassword: string;
  debeCambiarPassword: boolean;
  salarios: SalarioDto[];
  creadoEn: string;
}

export interface SesionGuardada {
  id: string;
  usuarioId: string;
  /** SHA-256 del token de refresco; el token en claro solo lo tiene el cliente. */
  hashRefresco: string;
  equipo: string | null;
  creadaEn: string;
  ultimoUso: string;
  expiraEn: string;
  revocadaEn: string | null;
}

export interface TipoTurnoGuardado {
  id: string;
  codigo: string;
  nombre: string;
  horaInicio: string;
  horaFin: string;
  color: string;
  activo: boolean;
}

export interface ParametroGuardado {
  /** `${clave}@${vigenteDesde}` */
  id: string;
  clave: string;
  valor: ValorParametro;
  vigenteDesde: string;
  vigenteHasta: string | null;
}

export interface FestivoGuardado {
  /** Igual a la fecha. */
  id: string;
  fecha: string;
  nombre: string;
}

export interface EventoAuditoria {
  fecha: string;
  actorId: string | null;
  accion: string;
  entidad: string;
  entidadId: string | null;
  antes?: unknown;
  despues?: unknown;
}

export interface AsignacionGuardada {
  id: string;
  usuarioId: string;
  tipoTurnoId: string;
  /** Copia del código para que el historial no cambie si se edita el tipo de turno. */
  codigo: string;
  /** Día local en que empieza, "YYYY-MM-DD". */
  fecha: string;
  /** ISO 8601 en UTC, calculados al asignar con las horas del tipo de turno. */
  inicio: string;
  fin: string;
  estado: EstadoAsignacion;
}

export interface VersionCuadroGuardada {
  numero: number;
  autorId: string;
  motivo: string;
  creadoEn: string;
  cambios: CambioVersionDto[];
}

/** Un cuadro por período, con sus asignaciones y su historial de versiones (RN-06). */
export interface CuadroGuardado {
  id: string;
  periodoInicio: string;
  periodoFin: string;
  estado: EstadoCuadro;
  versionActual: number;
  asignaciones: AsignacionGuardada[];
  versiones: VersionCuadroGuardada[];
  creadoPor: string;
  creadoEn: string;
  publicadoEn: string | null;
  cerradoEn: string | null;
}

export interface MarcacionGuardada {
  id: string;
  usuarioId: string;
  asignacionId: string | null;
  tipo: TipoMarcacion;
  /** Hora del servidor (RF-ASI-01). */
  hora: string;
  equipo: string | null;
  ip: string | null;
  corregida: boolean;
  motivoCorreccion: string | null;
  corregidaPor: string | null;
  creadaEn: string;
}
