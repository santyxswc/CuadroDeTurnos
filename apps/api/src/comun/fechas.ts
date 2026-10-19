const OFFSET_BOGOTA_MS = -5 * 3600 * 1000;

/** Fecha de hoy en Bogotá, "YYYY-MM-DD". */
export const hoyBogota = (ahora = new Date()) => new Date(ahora.getTime() + OFFSET_BOGOTA_MS).toISOString().slice(0, 10);

export const diaAnterior = (fecha: string) => new Date(Date.parse(`${fecha}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);

/** Valida "YYYY-MM-DD" y que la fecha exista (rechaza 2026-02-30). */
export function esFechaValida(fecha: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
  return new Date(`${fecha}T00:00:00Z`).toISOString().slice(0, 10) === fecha;
}

export const sumarDias = (fecha: string, dias: number) => new Date(Date.parse(`${fecha}T00:00:00Z`) + dias * 86_400_000).toISOString().slice(0, 10);

export const diasEntre = (desde: string, hasta: string) => Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000);

/** Lunes de la semana que contiene la fecha (RN-02: semana de lunes a domingo). */
export const lunesDe = (fecha: string) => sumarDias(fecha, -((new Date(`${fecha}T00:00:00Z`).getUTCDay() + 6) % 7));

/** Instante UTC de una hora local de Bogotá: aInstante('2026-10-06', '07:00'). */
export const aInstante = (fecha: string, hora: string) => new Date(`${fecha}T${hora}:00-05:00`);

/** Inicio y fin de un turno que empieza en `fecha`; si la hora de fin es menor o igual, termina al día siguiente. */
export function intervaloTurno(fecha: string, horaInicio: string, horaFin: string) {
  const inicio = aInstante(fecha, horaInicio);
  const fin = aInstante(horaFin > horaInicio ? fecha : sumarDias(fecha, 1), horaFin);
  return { inicio, fin };
}

/** "2026-10-20" → "20/10", para mensajes. */
export const diaMes = (fecha: string) => `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}`;
