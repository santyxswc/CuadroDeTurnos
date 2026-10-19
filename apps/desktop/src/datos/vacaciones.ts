// RN-04 · Vacaciones: 15 días hábiles por año de servicio (CST art. 186).
// Versión simple: no hay carga inicial de días ya disfrutados antes del sistema; cuentan las vacaciones aprobadas en la app.
import type { SolicitudDto } from '@sgt/shared-types';
import { diaSemana, rangoFechas, sumarDias } from './fechas';

/** Día hábil: lunes a sábado sin festivos. */
export const esHabil = (fecha: string, festivos: Set<string>) => diaSemana(fecha) !== 0 && !festivos.has(fecha);

export const diasHabiles = (desde: string, hasta: string, festivos: Set<string>) => rangoFechas(desde, hasta).filter((f) => esHabil(f, festivos)).length;

export function fechaReintegro(hasta: string, festivos: Set<string>): string {
  let f = sumarDias(hasta, 1);
  while (!esHabil(f, festivos)) f = sumarDias(f, 1);
  return f;
}

function aniosCumplidos(desde: string, hasta: string): number {
  const [a1, m1, d1] = desde.split('-').map(Number);
  const [a2, m2, d2] = hasta.split('-').map(Number);
  return Math.max(0, a2 - a1 - (m2 < m1 || (m2 === m1 && d2 < d1) ? 1 : 0));
}

export interface SaldoVacaciones {
  aniosServicio: number;
  diasCausados: number;
  diasAprobados: number;
  disponibles: number;
  /** Fecha desde la que puede pedir vacaciones (al cumplir el primer año). */
  puedeSolicitarDesde: string;
}

export function saldoVacaciones(
  persona: { id: string; fechaIngreso: string },
  solicitudes: SolicitudDto[],
  festivos: Set<string>,
  hoy: string,
  diasPorAnio: number,
): SaldoVacaciones {
  const anios = aniosCumplidos(persona.fechaIngreso, hoy);
  const aprobados = solicitudes
    .filter((s) => s.solicitanteId === persona.id && s.tipo === 'VACACIONES' && s.estado === 'APLICADA' && s.desde && s.hasta)
    .reduce((t, s) => t + diasHabiles(s.desde!, s.hasta!, festivos), 0);
  const diasCausados = anios * diasPorAnio;
  return {
    aniosServicio: anios,
    diasCausados,
    diasAprobados: aprobados,
    disponibles: diasCausados - aprobados,
    puedeSolicitarDesde: `${Number(persona.fechaIngreso.slice(0, 4)) + 1}${persona.fechaIngreso.slice(4)}`,
  };
}
