// Datos de ejemplo del prototipo (Sprint 0). No hay API todavía: todo vive en memoria.
import type { Cargo, CategoriaPermiso, EstadoSolicitud, Rol, TipoSolicitud } from '@sgt/shared-types';
import { bog, diaSemana, rangoFechas, sumarDias } from './fechas';

/** Hora simulada del prototipo: martes 6 de octubre de 2026, 07:20. */
export const AHORA = bog('2026-10-06T07:20');

export interface Persona {
  id: string;
  nombres: string;
  documento: string;
  rol: Rol;
  cargo: Cargo;
  salario: number;
  fechaIngreso: string;
  activo: boolean;
  /** Días de vacaciones ya disfrutados (carga inicial RF-VAC-06). */
  diasDisfrutados: number;
}

export const PERSONAS: Persona[] = [
  { id: 'u0', nombres: 'Laura Méndez', documento: '52123456', rol: 'COORDINADOR', cargo: 'JEFE', salario: 3_400_000, fechaIngreso: '2019-03-04', activo: true, diasDisfrutados: 90 },
  { id: 'u1', nombres: 'Andrés Rojas', documento: '80234567', rol: 'ENFERMERO', cargo: 'PROFESIONAL', salario: 2_500_000, fechaIngreso: '2022-02-14', activo: true, diasDisfrutados: 30 },
  { id: 'u2', nombres: 'Camila Torres', documento: '1020345678', rol: 'ENFERMERO', cargo: 'AUXILIAR', salario: 1_150_000, fechaIngreso: '2024-06-03', activo: true, diasDisfrutados: 15 },
  { id: 'u3', nombres: 'Julián Pardo', documento: '1015456789', rol: 'ENFERMERO', cargo: 'AUXILIAR', salario: 1_800_000, fechaIngreso: '2021-09-20', activo: true, diasDisfrutados: 60 },
  { id: 'u4', nombres: 'Diana Castillo', documento: '52567890', rol: 'ENFERMERO', cargo: 'ESPECIALISTA', salario: 3_390_000, fechaIngreso: '2020-01-13', activo: true, diasDisfrutados: 75 },
  { id: 'u5', nombres: 'Sofía Herrera', documento: '1032678901', rol: 'ENFERMERO', cargo: 'PROFESIONAL', salario: 2_260_000, fechaIngreso: '2023-10-02', activo: true, diasDisfrutados: 24 },
  { id: 'u6', nombres: 'Mateo Gómez', documento: '1019789012', rol: 'ENFERMERO', cargo: 'AUXILIAR', salario: 1_800_000, fechaIngreso: '2026-01-19', activo: true, diasDisfrutados: 0 },
  { id: 'u7', nombres: 'Valentina Ruiz', documento: '1026890123', rol: 'ENFERMERO', cargo: 'PROFESIONAL', salario: 2_600_000, fechaIngreso: '2022-11-28', activo: true, diasDisfrutados: 30 },
  { id: 'u8', nombres: 'Santiago Vargas', documento: '1014901234', rol: 'ENFERMERO', cargo: 'AUXILIAR', salario: 1_900_000, fechaIngreso: '2023-04-17', activo: true, diasDisfrutados: 15 },
  { id: 'u9', nombres: 'Paula Moreno', documento: '1030012345', rol: 'ENFERMERO', cargo: 'JEFE', salario: 2_900_000, fechaIngreso: '2021-05-10', activo: true, diasDisfrutados: 60 },
];

export const persona = (id: string) => PERSONAS.find((p) => p.id === id)!;

/**
 * Persona del prototipo que corresponde a un usuario real (mismo documento). Si no hay, se usa
 * la coordinadora o un enfermero de ejemplo según el rol. Temporal hasta conectar esas pantallas a la API.
 */
export function idPrototipo(documento: string, rol: Rol): string {
  return PERSONAS.find((p) => p.documento === documento)?.id ?? (rol === 'COORDINADOR' ? 'u0' : 'u1');
}

export interface TipoTurno {
  codigo: string;
  nombre: string;
  horaInicio: string;
  horaFin: string;
  color: string;
}

export const TIPOS_TURNO: TipoTurno[] = [
  { codigo: 'M', nombre: 'Mañana', horaInicio: '07:00', horaFin: '13:00', color: '#f5c451' },
  { codigo: 'T', nombre: 'Tarde', horaInicio: '13:00', horaFin: '19:00', color: '#f08a5d' },
  { codigo: 'N', nombre: 'Noche', horaInicio: '19:00', horaFin: '07:00', color: '#5d6cc0' },
  { codigo: 'D', nombre: 'Día largo', horaInicio: '07:00', horaFin: '19:00', color: '#3fa796' },
];

export const tipoTurno = (codigo: string) => TIPOS_TURNO.find((t) => t.codigo === codigo)!;

/** Festivos de Colombia 2026 (RF-ADM-02). */
export const FESTIVOS: Record<string, string> = {
  '2026-01-01': 'Año Nuevo',
  '2026-01-12': 'Reyes Magos',
  '2026-03-23': 'San José',
  '2026-04-02': 'Jueves Santo',
  '2026-04-03': 'Viernes Santo',
  '2026-05-01': 'Día del Trabajo',
  '2026-05-18': 'Ascensión del Señor',
  '2026-06-08': 'Corpus Christi',
  '2026-06-15': 'Sagrado Corazón',
  '2026-06-29': 'San Pedro y San Pablo',
  '2026-07-20': 'Independencia',
  '2026-08-07': 'Batalla de Boyacá',
  '2026-08-17': 'Asunción de la Virgen',
  '2026-10-12': 'Día de la Raza',
  '2026-11-02': 'Todos los Santos',
  '2026-11-16': 'Independencia de Cartagena',
  '2026-12-08': 'Inmaculada Concepción',
  '2026-12-25': 'Navidad',
};

export type EstadoAsignacion = 'ACTIVA' | 'LIBERADA';

export interface Asignacion {
  id: string;
  usuarioId: string;
  fecha: string;
  codigo: string;
  inicio: Date;
  fin: Date;
  estado: EstadoAsignacion;
}

let secuencia = 0;

export function crearAsignacion(usuarioId: string, fecha: string, codigo: string): Asignacion {
  const t = tipoTurno(codigo);
  const inicio = bog(`${fecha}T${t.horaInicio}`);
  const finMismoDia = t.horaFin > t.horaInicio;
  const fin = bog(`${finMismoDia ? fecha : sumarDias(fecha, 1)}T${t.horaFin}`);
  return { id: `a${++secuencia}`, usuarioId, fecha, codigo, inicio, fin, estado: 'ACTIVA' };
}

/**
 * Rotación de ejemplo para los 9 enfermeros: M, T, N, N, descanso, descanso (42 h promedio por semana).
 * La coordinadora hace D lunes y miércoles y M martes, jueves y viernes (42 h).
 */
const ROTACION = ['M', 'T', 'N', 'N', '', ''];
const COORDINACION: Record<number, string> = { 1: 'D', 2: 'M', 3: 'D', 4: 'M', 5: 'M' };

export function generarCuadro(desde: string, hasta: string): Asignacion[] {
  const base = Date.parse('2026-09-28T00:00:00Z') / 86_400_000;
  const r: Asignacion[] = [];
  for (const fecha of rangoFechas(desde, hasta)) {
    const n = Date.parse(`${fecha}T00:00:00Z`) / 86_400_000 - base;
    PERSONAS.forEach((p, i) => {
      const codigo = p.rol === 'COORDINADOR' ? COORDINACION[diaSemana(fecha)] : ROTACION[(n + i) % ROTACION.length];
      if (codigo) r.push(crearAsignacion(p.id, fecha, codigo));
    });
  }
  return r;
}

/** Cuadro publicado de octubre (incluye la semana que empieza el 28-sep para tener continuidad). */
export function cuadroOctubre(): Asignacion[] {
  const cuadro = generarCuadro('2026-09-28', '2026-11-01');
  // Sofía Herrera tiene vacaciones aprobadas del 19 al 25 de octubre: sus turnos quedan por cubrir (RF-VAC-04).
  for (const a of cuadro) {
    if (a.usuarioId === 'u5' && a.fecha >= '2026-10-19' && a.fecha <= '2026-10-25') a.estado = 'LIBERADA';
  }
  return cuadro;
}

export interface Marcacion {
  entrada?: Date;
  salida?: Date;
}

/** Marcaciones simuladas de los turnos ya pasados, con pequeñas variaciones de minutos. */
export function marcacionesIniciales(asignaciones: Asignacion[]): Record<string, Marcacion> {
  const r: Record<string, Marcacion> = {};
  const min = 60_000;
  asignaciones.forEach((a, i) => {
    if (a.estado !== 'ACTIVA') return;
    const variacion = ((i * 7919) % 15) - 8; // -8 … +6 minutos
    if (a.fin <= AHORA) {
      r[a.id] = {
        entrada: new Date(a.inicio.getTime() + variacion * min),
        salida: new Date(a.fin.getTime() + (((i * 104729) % 14) + 1) * min),
      };
    } else if (a.inicio <= AHORA) {
      // Turnos en curso: todos marcaron entrada menos Diana Castillo (para mostrar el estado Retrasado).
      if (a.usuarioId !== 'u4') r[a.id] = { entrada: new Date(a.inicio.getTime() + Math.min(variacion, 4) * min) };
    }
  });
  return r;
}

export interface MensajeChat {
  id: string;
  autorId: string | null;
  contenido: string;
  esNovedad: boolean;
  hora: Date;
}

export const MENSAJES_INICIALES: MensajeChat[] = [
  { id: 'm1', autorId: 'u3', contenido: 'Buenas noches equipo, recibo el turno N con 12 pacientes en el servicio.', esNovedad: false, hora: bog('2026-10-05T19:05') },
  { id: 'm2', autorId: 'u9', contenido: 'Paciente de la cama 8 quedó pendiente de interconsulta con medicina interna.', esNovedad: true, hora: bog('2026-10-05T23:40') },
  { id: 'm3', autorId: null, contenido: 'El turno N del 19-oct de Sofía Herrera requiere cobertura (vacaciones aprobadas).', esNovedad: true, hora: bog('2026-10-06T06:30') },
  { id: 'm4', autorId: 'u1', contenido: '¿Alguien me puede cambiar el turno T del jueves? Tengo cita médica.', esNovedad: false, hora: bog('2026-10-06T07:02') },
  { id: 'm5', autorId: 'u0', contenido: 'Buen día. Recuerden registrar pacientes atendidos al cerrar el turno.', esNovedad: false, hora: bog('2026-10-06T07:10') },
];

export interface Solicitud {
  id: string;
  tipo: TipoSolicitud;
  estado: EstadoSolicitud;
  solicitanteId: string;
  companeroId?: string;
  asignacionId?: string;
  /** En un intercambio, el turno del compañero que el solicitante toma a cambio. */
  asignacionDestinoId?: string;
  desde?: string;
  hasta?: string;
  categoria?: CategoriaPermiso;
  comentario: string;
  autoaprobada?: boolean;
  resolucion?: string;
  creada: Date;
}

export const SOLICITUDES_INICIALES: Solicitud[] = [
  { id: 's1', tipo: 'PERMISO', estado: 'PENDIENTE_COORDINADOR', solicitanteId: 'u1', desde: '2026-10-08', hasta: '2026-10-08', categoria: 'CITA_MEDICA', comentario: 'Control médico a las 3 p. m.', creada: bog('2026-10-05T10:15') },
  { id: 's2', tipo: 'VACACIONES', estado: 'APLICADA', solicitanteId: 'u5', desde: '2026-10-19', hasta: '2026-10-25', comentario: 'Vacaciones del periodo 2023-2024', resolucion: 'Aprobado. Se libera la semana para cobertura.', creada: bog('2026-09-15T09:00') },
  { id: 's3', tipo: 'PERMISO', estado: 'RECHAZADA', solicitanteId: 'u6', desde: '2026-10-03', hasta: '2026-10-03', categoria: 'PERSONAL', comentario: 'Diligencia personal', resolucion: 'No hay cobertura ese día.', creada: bog('2026-09-30T16:20') },
];

export const CATEGORIAS_PERMISO: Record<CategoriaPermiso, string> = {
  PERSONAL: 'Personal',
  CALAMIDAD: 'Calamidad doméstica',
  CITA_MEDICA: 'Cita médica',
  ACADEMICO: 'Académico',
  OTRO: 'Otro',
};

