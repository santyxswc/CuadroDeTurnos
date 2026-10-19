// Exportación a Excel como CSV: separador «;» y BOM para que Excel en español lo abra con tildes y columnas correctas.
type Celda = string | number | null | undefined;

const texto = (v: Celda) => {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'number' ? String(Math.round(v * 100) / 100).replace('.', ',') : v;
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function descargarCsv(nombre: string, filas: Celda[][]) {
  const contenido = '﻿' + filas.map((f) => f.map(texto).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob([contenido], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${nombre}.csv`;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
