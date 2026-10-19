// Estado en memoria del prototipo. Simula lo que en el Sprint 1+ vendrá de la API y de los eventos WebSocket.
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import {
  AHORA,
  crearAsignacion,
  cuadroOctubre,
  generarCuadro,
  marcacionesIniciales,
  MENSAJES_INICIALES,
  persona,
  SOLICITUDES_INICIALES,
  type Asignacion,
  type Marcacion,
  type MensajeChat,
  type Solicitud,
} from './datos/mock';
import { diaMes, horaLocal } from './datos/fechas';

export type EstadoBorrador = 'BORRADOR' | 'PUBLICADO';

interface Estado {
  usuarioId: string | null;
  asignaciones: Asignacion[];
  borrador: Asignacion[];
  estadoBorrador: EstadoBorrador;
  versionCuadro: number;
  marcaciones: Record<string, Marcacion>;
  mensajes: MensajeChat[];
  solicitudes: Solicitud[];
  auditoria: string[];
}

function estadoInicial(): Estado {
  const asignaciones = cuadroOctubre();
  const marcaciones = marcacionesIniciales(asignaciones);
  return {
    usuarioId: null,
    asignaciones,
    // Borrador de noviembre como punto de partida para el editor.
    borrador: generarCuadro('2026-11-02', '2026-11-29'),
    estadoBorrador: 'BORRADOR',
    versionCuadro: 3,
    marcaciones,
    mensajes: MENSAJES_INICIALES,
    solicitudes: SOLICITUDES_INICIALES,
    auditoria: [],
  };
}

/** RF-VAC-04: al aprobar vacaciones o permisos, los turnos del rango quedan "requiere cobertura". */
function liberarTurnos(asignaciones: Asignacion[], s: Solicitud) {
  const avisos: string[] = [];
  const nuevas = asignaciones.map((a) => {
    if (a.usuarioId !== s.solicitanteId || a.estado !== 'ACTIVA' || !s.desde || !s.hasta || a.fecha < s.desde || a.fecha > s.hasta) return a;
    avisos.push(`El turno ${a.codigo} del ${diaMes(a.fecha)} de ${persona(a.usuarioId).nombres} requiere cobertura.`);
    return { ...a, estado: 'LIBERADA' as const };
  });
  return { asignaciones: avisos.length ? nuevas : asignaciones, avisos };
}

function useAlmacen() {
  const [e, setE] = useState<Estado>(estadoInicial);
  const set = (cambio: (e: Estado) => Partial<Estado>) => setE((prev) => ({ ...prev, ...cambio(prev) }));

  const auditar = (texto: string) => (prev: Estado) => [
    `${horaLocal(AHORA)} · ${prev.usuarioId ? persona(prev.usuarioId).nombres : 'sistema'} · ${texto}`,
    ...prev.auditoria,
  ];

  const mensajeSistema = (contenido: string): MensajeChat => ({
    id: crypto.randomUUID(), autorId: null, contenido, esNovedad: true, hora: AHORA,
  });

  return {
    ...e,
    iniciarSesion: (usuarioId: string) => set(() => ({ usuarioId })),
    cerrarSesion: () => set(() => ({ usuarioId: null })),

    marcar: (asignacionId: string) =>
      set((prev) => {
        const actual = prev.marcaciones[asignacionId] ?? {};
        const nueva = actual.entrada ? { ...actual, salida: AHORA } : { entrada: AHORA };
        return {
          marcaciones: { ...prev.marcaciones, [asignacionId]: nueva },
          auditoria: auditar(actual.entrada ? 'marcó salida' : 'marcó entrada')(prev),
        };
      }),

    enviarMensaje: (contenido: string, esNovedad: boolean) =>
      set((prev) => ({
        mensajes: [...prev.mensajes, { id: crypto.randomUUID(), autorId: prev.usuarioId, contenido, esNovedad, hora: AHORA }],
      })),

    cambiarCeldaBorrador: (usuarioId: string, fecha: string, codigo: string) =>
      set((prev) => {
        const resto = prev.borrador.filter((a) => !(a.usuarioId === usuarioId && a.fecha === fecha));
        return { borrador: codigo ? [...resto, crearAsignacion(usuarioId, fecha, codigo)] : resto };
      }),

    publicarBorrador: () =>
      set((prev) => ({
        estadoBorrador: 'PUBLICADO',
        mensajes: [...prev.mensajes, mensajeSistema('Se publicó el cuadro de turnos de noviembre. Ya lo pueden consultar.')],
        auditoria: auditar('publicó el cuadro de noviembre')(prev),
      })),

    crearSolicitud: (s: Omit<Solicitud, 'id' | 'estado' | 'creada'>) =>
      set((prev) => {
        const esCoordinador = persona(s.solicitanteId).rol === 'COORDINADOR';
        const conCompanero = s.tipo === 'INTERCAMBIO' || s.tipo === 'CESION';
        // RF-SOL-08: el coordinador no necesita aprobación, pero queda constancia.
        const estado = esCoordinador && !conCompanero ? 'APLICADA' : conCompanero ? 'PENDIENTE_COMPANERO' : 'PENDIENTE_COORDINADOR';
        const nueva: Solicitud = { ...s, id: crypto.randomUUID(), estado, creada: AHORA, autoaprobada: esCoordinador && !conCompanero };
        const r = nueva.autoaprobada ? liberarTurnos(prev.asignaciones, nueva) : { asignaciones: prev.asignaciones, avisos: [] };
        return {
          solicitudes: [nueva, ...prev.solicitudes],
          asignaciones: r.asignaciones,
          mensajes: [...prev.mensajes, ...r.avisos.map(mensajeSistema)],
          auditoria: auditar(`creó solicitud de ${s.tipo.toLowerCase()}${nueva.autoaprobada ? ' (anotación del coordinador)' : ''}`)(prev),
        };
      }),

    responderCompanero: (id: string, acepta: boolean) =>
      set((prev) => ({
        solicitudes: prev.solicitudes.map((s) =>
          s.id === id ? { ...s, estado: acepta ? 'PENDIENTE_COORDINADOR' : 'RECHAZADA_COMPANERO' } : s,
        ),
      })),

    resolverSolicitud: (id: string, aprueba: boolean, comentario: string) =>
      set((prev) => {
        const s = prev.solicitudes.find((x) => x.id === id)!;
        let asignaciones = prev.asignaciones;
        const mensajes = [...prev.mensajes];
        if (aprueba && s.asignacionId && s.companeroId) {
          // Al aprobar, el cuadro se actualiza solo (nueva versión) y se avisa a todos.
          asignaciones = asignaciones.map((a) =>
            a.id === s.asignacionId ? { ...a, usuarioId: s.companeroId! } : a.id === s.asignacionDestinoId ? { ...a, usuarioId: s.solicitanteId } : a,
          );
          const a = prev.asignaciones.find((x) => x.id === s.asignacionId)!;
          mensajes.push(
            mensajeSistema(`Cambio aprobado: ${persona(s.companeroId).nombres} toma el turno ${a.codigo} del ${diaMes(a.fecha)} de ${persona(s.solicitanteId).nombres}.`),
          );
        }
        if (aprueba && (s.tipo === 'VACACIONES' || s.tipo === 'PERMISO')) {
          const r = liberarTurnos(asignaciones, s);
          asignaciones = r.asignaciones;
          mensajes.push(...r.avisos.map(mensajeSistema));
        }
        return {
          asignaciones,
          mensajes,
          versionCuadro: aprueba && asignaciones !== prev.asignaciones ? prev.versionCuadro + 1 : prev.versionCuadro,
          solicitudes: prev.solicitudes.map((x) =>
            x.id === id ? { ...x, estado: aprueba ? 'APLICADA' : 'RECHAZADA', resolucion: comentario } : x,
          ),
          auditoria: auditar(`${aprueba ? 'aprobó' : 'rechazó'} la solicitud de ${persona(s.solicitanteId).nombres}`)(prev),
        };
      }),

    cancelarSolicitud: (id: string) =>
      set((prev) => ({ solicitudes: prev.solicitudes.map((s) => (s.id === id ? { ...s, estado: 'CANCELADA' } : s)) })),
  };
}

type Almacen = ReturnType<typeof useAlmacen>;
const Contexto = createContext<Almacen | null>(null);

export function ProveedorEstado({ children }: { children: ReactNode }) {
  const almacen = useAlmacen();
  return <Contexto.Provider value={almacen}>{children}</Contexto.Provider>;
}

export function useEstado() {
  const c = useContext(Contexto);
  if (!c) throw new Error('useEstado debe usarse dentro de ProveedorEstado');
  return c;
}

export function useUsuario() {
  const { usuarioId } = useEstado();
  return useMemo(() => (usuarioId ? persona(usuarioId) : null), [usuarioId]);
}
