// Clasificación de horas del período para el reporte de horas y el valor estimado de recargos (RF-HOR-07).
// Trabaja con los turnos publicados y las marcaciones que vienen de la API.
import { aHoras, calcularMinutos, horaAMinutos, type HorasClasificadas, type PorcentajesRecargo } from '@sgt/rules-engine';
import { PARAMETROS_DEFECTO, type AsignacionDto, type ClaveParametro, type MarcacionDto, type ParametroDto } from '@sgt/shared-types';
import { lunesDe } from './fechas';

export type Fuente = 'reales' | 'programadas';

export interface FilaHoras {
  a: AsignacionDto;
  inicio: Date;
  fin: Date;
  total: number;
  diurnas: number;
  nocturnas: number;
  dominicalesDiurnas: number;
  dominicalesNocturnas: number;
  /** Horas de esta fila que se pagan como extra por superar la jornada semanal. */
  extra: number;
}

/** Parámetros vigentes que trae `GET /parametros`, con el valor por defecto si falta alguno. */
export function parametro<K extends ClaveParametro>(lista: ParametroDto[] | null, clave: K): (typeof PARAMETROS_DEFECTO)[K] {
  return (lista?.find((p) => p.clave === clave)?.valor ?? PARAMETROS_DEFECTO[clave]) as (typeof PARAMETROS_DEFECTO)[K];
}

export function porcentajes(ps: ParametroDto[] | null): PorcentajesRecargo {
  return {
    nocturnoPct: parametro(ps, 'recargo.nocturno_pct'),
    extraDiurnaPct: parametro(ps, 'recargo.extra_diurna_pct'),
    extraNocturnaPct: parametro(ps, 'recargo.extra_nocturna_pct'),
    dominicalPct: parametro(ps, 'recargo.dominical_pct'),
  };
}

/**
 * Una fila por turno de la persona. Con fuente "reales" se usan la entrada y la salida marcadas
 * (respuesta 5 del cliente: son las oficiales); los turnos sin las dos marcaciones no cuentan.
 */
export function filasHoras(
  turnos: AsignacionDto[],
  marcaciones: MarcacionDto[],
  fuente: Fuente,
  ps: ParametroDto[] | null,
  festivos: Set<string>,
): FilaHoras[] {
  const franja = { inicioMin: horaAMinutos(parametro(ps, 'jornada.inicio_nocturna')), finMin: horaAMinutos(parametro(ps, 'jornada.fin_nocturna')) };
  const marca = (asignacionId: string, tipo: 'ENTRADA' | 'SALIDA') => marcaciones.find((m) => m.asignacionId === asignacionId && m.tipo === tipo)?.hora;

  const filas: FilaHoras[] = [];
  for (const a of turnos) {
    if (a.estado !== 'ACTIVA') continue;
    const [i, f] = fuente === 'reales' ? [marca(a.id, 'ENTRADA'), marca(a.id, 'SALIDA')] : [a.inicio, a.fin];
    if (!i || !f) continue;
    const inicio = new Date(i);
    const fin = new Date(f);
    const d = aHoras(calcularMinutos(inicio, fin, { franjaNocturna: () => franja, esFestivo: (fecha) => festivos.has(fecha) }));
    filas.push({
      a,
      inicio,
      fin,
      total: d.diurnasOrdinarias + d.nocturnasOrdinarias + d.diurnasDominicales + d.nocturnasDominicales,
      diurnas: d.diurnasOrdinarias,
      nocturnas: d.nocturnasOrdinarias,
      dominicalesDiurnas: d.diurnasDominicales,
      dominicalesNocturnas: d.nocturnasDominicales,
      extra: 0,
    });
  }
  filas.sort((x, y) => x.inicio.getTime() - y.inicio.getTime());

  // RN-02: lo que pasa de la jornada máxima semanal es exceso. Se toma de los últimos turnos de la semana.
  const maxima = parametro(ps, 'jornada.maxima_semanal_h');
  const semanas = new Map<string, FilaHoras[]>();
  for (const f of filas) semanas.set(lunesDe(f.a.fecha), [...(semanas.get(lunesDe(f.a.fecha)) ?? []), f]);
  for (const lista of semanas.values()) {
    let restante = lista.reduce((s, f) => s + f.total, 0) - maxima;
    for (const f of [...lista].reverse()) {
      if (restante <= 0) break;
      f.extra = Math.min(restante, f.total);
      restante -= f.extra;
    }
  }
  return filas;
}

/**
 * Agrupa las filas en los conceptos de la tabla de recargos. La parte extra de cada turno se reparte
 * proporcionalmente entre sus franjas (estimación preliminar, a validar con nómina).
 */
export function clasificar(filas: FilaHoras[]): HorasClasificadas {
  const h: HorasClasificadas = {
    nocturnasOrdinarias: 0, diurnasDominicales: 0, nocturnasDominicales: 0,
    extraDiurnas: 0, extraNocturnas: 0, extraDiurnasDominicales: 0, extraNocturnasDominicales: 0,
  };
  for (const f of filas) {
    const pe = f.total ? f.extra / f.total : 0;
    h.nocturnasOrdinarias += f.nocturnas * (1 - pe);
    h.diurnasDominicales += f.dominicalesDiurnas * (1 - pe);
    h.nocturnasDominicales += f.dominicalesNocturnas * (1 - pe);
    h.extraDiurnas += f.diurnas * pe;
    h.extraNocturnas += f.nocturnas * pe;
    h.extraDiurnasDominicales += f.dominicalesDiurnas * pe;
    h.extraNocturnasDominicales += f.dominicalesNocturnas * pe;
  }
  return h;
}
