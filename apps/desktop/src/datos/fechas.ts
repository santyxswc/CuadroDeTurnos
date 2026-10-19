import { ZONA_HORARIA } from '@sgt/shared-types';

/** Crea una fecha a partir de una hora local de Bogotá: bog('2026-10-06T07:20'). */
export const bog = (fechaHora: string) => new Date(`${fechaHora}:00-05:00`);

const OFFSET = -5 * 3600 * 1000;
const DIA = 24 * 3600 * 1000;

/** "YYYY-MM-DD" local de Bogotá. */
export const fechaLocal = (d: Date) => new Date(d.getTime() + OFFSET).toISOString().slice(0, 10);
/** "HH:mm" local de Bogotá. */
export const horaLocal = (d: Date) => new Date(d.getTime() + OFFSET).toISOString().slice(11, 16);

export function sumarDias(fecha: string, dias: number): string {
  return new Date(Date.parse(`${fecha}T00:00:00Z`) + dias * DIA).toISOString().slice(0, 10);
}

/** 0 = domingo … 6 = sábado. */
export const diaSemana = (fecha: string) => new Date(`${fecha}T00:00:00Z`).getUTCDay();

export function rangoFechas(desde: string, hasta: string): string[] {
  const r: string[] = [];
  for (let f = desde; f <= hasta; f = sumarDias(f, 1)) r.push(f);
  return r;
}

/** Lunes de la semana que contiene la fecha. */
export const lunesDe = (fecha: string) => sumarDias(fecha, -((diaSemana(fecha) + 6) % 7));

const fmtLargo = new Intl.DateTimeFormat('es-CO', {
  timeZone: ZONA_HORARIA, weekday: 'long', day: 'numeric', month: 'long',
});
const fmtCorto = new Intl.DateTimeFormat('es-CO', { timeZone: 'UTC', weekday: 'short', day: 'numeric' });
const fmtDiaMes = new Intl.DateTimeFormat('es-CO', { timeZone: 'UTC', day: 'numeric', month: 'short' });

export const fechaLarga = (d: Date) => fmtLargo.format(d);
export const encabezadoDia = (fecha: string) => fmtCorto.format(new Date(`${fecha}T00:00:00Z`));
export const diaMes = (fecha: string) => fmtDiaMes.format(new Date(`${fecha}T00:00:00Z`));

export const pesos = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

export const horas = (n: number) => (Math.round(n * 10) / 10).toLocaleString('es-CO');

const fmtFechaHora = new Intl.DateTimeFormat('es-CO', { timeZone: ZONA_HORARIA, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** "19 oct, 14:05" en hora de Bogotá, para fechas ISO que vienen de la API. */
export const fechaHora = (iso: string) => fmtFechaHora.format(new Date(iso));

/** Último día del mes de la fecha. */
export const finDeMes = (fecha: string) => {
  const [a, m] = fecha.split('-').map(Number);
  return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
};
