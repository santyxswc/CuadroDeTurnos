import type { ReactNode } from 'react';
import type { TipoTurnoDto } from '@sgt/shared-types';

export function Tarjeta({ titulo, acciones, children, className = '' }: { titulo?: ReactNode; acciones?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`tarjeta ${className}`}>
      {(titulo || acciones) && (
        <header>
          <h3>{titulo}</h3>
          <div className="acciones">{acciones}</div>
        </header>
      )}
      {children}
    </section>
  );
}

/** Turno con el color de su tipo; sin `tipo` se muestra en gris. */
export function Chip({ codigo, tachado, tipo }: { codigo: string; tachado?: boolean; tipo?: Pick<TipoTurnoDto, 'nombre' | 'color' | 'horaInicio' | 'horaFin'> }) {
  const t = tipo;
  return (
    <span className={`chip ${tachado ? 'tachado' : ''}`} style={{ background: t?.color ?? '#8a97a0' }} title={t ? `${t.nombre} ${t.horaInicio}–${t.horaFin}` : codigo}>
      {codigo}
    </span>
  );
}

const ETIQUETAS: Record<string, [string, string]> = {
  PROGRAMADO: ['Programado', 'gris'],
  EN_TURNO: ['En turno', 'verde'],
  RETRASADO: ['Retrasado', 'amarillo'],
  AUSENTE: ['Ausente', 'rojo'],
  SALIDA_PENDIENTE: ['Salida pendiente', 'naranja'],
  FINALIZADO: ['Finalizado', 'azul'],
  BORRADOR: ['Borrador', 'gris'],
  PENDIENTE_COMPANERO: ['Pendiente de compañero', 'amarillo'],
  RECHAZADA_COMPANERO: ['Rechazada por compañero', 'rojo'],
  PENDIENTE_COORDINADOR: ['Pendiente de coordinador', 'amarillo'],
  APROBADA: ['Aprobada', 'verde'],
  APLICADA: ['Aprobada y aplicada', 'verde'],
  RECHAZADA: ['Rechazada', 'rojo'],
  CANCELADA: ['Cancelada', 'gris'],
  APTO: ['Apto', 'verde'],
  APTO_CON_ADVERTENCIA: ['Apto con advertencia', 'amarillo'],
  NO_APTO: ['No apto', 'rojo'],
  PUBLICADO: ['Publicado', 'verde'],
  CERRADO: ['Cerrado', 'azul'],
};

export function Estado({ valor }: { valor: string }) {
  const [texto, color] = ETIQUETAS[valor] ?? [valor, 'gris'];
  return <span className={`pill ${color}`}>{texto}</span>;
}

export function Dato({ etiqueta, valor, nota }: { etiqueta: string; valor: ReactNode; nota?: ReactNode }) {
  return (
    <div className="dato">
      <small>{etiqueta}</small>
      <b>{valor}</b>
      {nota && <span>{nota}</span>}
    </div>
  );
}
