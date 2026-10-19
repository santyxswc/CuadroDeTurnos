// Conexión de tiempo real con la API (Socket.IO, RF-MAIN-05). El servidor solo avisa qué cambió;
// cada pantalla vuelve a pedir sus datos por HTTP, así hay una sola fuente de verdad.
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { EventoTiempoReal } from '@sgt/shared-types';
import { useSesion } from '../sesion';
import { refrescar, tokenAcceso, URL_API } from './cliente';

const Contexto = createContext<{ socket: Socket | null; conectado: boolean }>({ socket: null, conectado: false });

/** Espera antes de reintentar si el servidor rechazó la conexión (token vencido). */
const REINTENTO_MS = 3_000;

export function ProveedorTiempoReal({ children }: { children: ReactNode }) {
  const { usuario } = useSesion();
  const activo = !!usuario && !usuario.debeCambiarPassword;
  const [socket, setSocket] = useState<Socket | null>(null);
  const [conectado, setConectado] = useState(false);

  useEffect(() => {
    if (!activo) return;
    const s = io(URL_API.replace(/\/api\/?$/, ''), {
      // Se lee en cada intento, así una reconexión usa el token renovado.
      auth: (cb) => cb({ token: tokenAcceso() }),
      transports: ['websocket'],
    });
    let reintento: number | undefined;
    s.on('connect', () => setConectado(true));
    s.on('disconnect', (motivo) => {
      setConectado(false);
      // El servidor cierra la conexión si el token venció: se renueva y se vuelve a intentar.
      if (motivo === 'io server disconnect') {
        reintento = window.setTimeout(() => {
          refrescar()
            .then(() => s.connect())
            .catch(() => undefined);
        }, REINTENTO_MS);
      }
    });
    setSocket(s);
    return () => {
      window.clearTimeout(reintento);
      s.disconnect();
      setSocket(null);
      setConectado(false);
    };
  }, [activo, usuario?.id]);

  return <Contexto.Provider value={{ socket, conectado }}>{children}</Contexto.Provider>;
}

export const useConectado = () => useContext(Contexto).conectado;

/**
 * Ejecuta `alCambiar` cuando llega alguno de los eventos y también al reconectar,
 * porque mientras no hubo conexión se pudieron perder avisos.
 */
export function useTiempoReal<T = unknown>(eventos: EventoTiempoReal[], alCambiar: (datos?: T) => void) {
  const { socket } = useContext(Contexto);
  const ref = useRef(alCambiar);
  ref.current = alCambiar;
  const clave = eventos.join('|');

  useEffect(() => {
    if (!socket) return;
    const manejar = (datos?: T) => ref.current(datos);
    let primeraConexion = socket.connected;
    const alConectar = () => {
      if (primeraConexion) manejar();
      primeraConexion = true;
    };
    const lista = clave.split('|');
    lista.forEach((e) => socket.on(e, manejar));
    socket.on('connect', alConectar);
    return () => {
      lista.forEach((e) => socket.off(e, manejar));
      socket.off('connect', alConectar);
    };
  }, [socket, clave]);
}
