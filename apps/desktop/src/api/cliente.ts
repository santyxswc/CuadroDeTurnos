// Cliente HTTP de la API. Los tokens viven solo en memoria: al cerrar la app se cierra la sesión.
import type { RespuestaLoginDto } from '@sgt/shared-types';

// La app instalada arranca su propia API en un puerto libre y lo pasa en la dirección (?api=...).
export const URL_API: string =
  new URLSearchParams(location.search).get('api') ?? import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

export class ErrorApi extends Error {
  constructor(
    readonly estado: number,
    mensaje: string,
    readonly codigo?: string,
  ) {
    super(mensaje);
  }
}

interface Tokens {
  acceso: string;
  refresco: string;
  obtenidoEn: number;
}

let tokens: Tokens | null = null;
let alExpirar: (motivo: string) => void = () => {};
let refrescoEnCurso: Promise<void> | null = null;

export function configurarSesion(respuesta: RespuestaLoginDto | null) {
  tokens = respuesta && { acceso: respuesta.tokenAcceso, refresco: respuesta.tokenRefresco, obtenidoEn: Date.now() };
}

export function alExpirarSesion(fn: (motivo: string) => void) {
  alExpirar = fn;
}

export const edadTokenMs = () => (tokens ? Date.now() - tokens.obtenidoEn : 0);

/** Token vigente, para autenticar la conexión de tiempo real. */
export const tokenAcceso = () => tokens?.acceso ?? null;

async function leerError(r: Response): Promise<ErrorApi> {
  try {
    const cuerpo = (await r.json()) as { message?: string | string[]; codigo?: string };
    const mensaje = Array.isArray(cuerpo.message) ? cuerpo.message.join(' ') : (cuerpo.message ?? r.statusText);
    return new ErrorApi(r.status, mensaje, cuerpo.codigo);
  } catch {
    return new ErrorApi(r.status, r.statusText);
  }
}

async function enviar(metodo: string, ruta: string, cuerpo?: unknown): Promise<Response> {
  try {
    return await fetch(`${URL_API}${ruta}`, {
      method: metodo,
      headers: {
        'content-type': 'application/json',
        ...(tokens && { authorization: `Bearer ${tokens.acceso}` }),
      },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
  } catch {
    throw new ErrorApi(0, 'No hay conexión con el servidor. Verifica que la API esté encendida.');
  }
}

/** Cambia el token de refresco por uno nuevo. Varias llamadas simultáneas comparten el mismo refresco. */
export function refrescar(): Promise<void> {
  refrescoEnCurso ??= (async () => {
    try {
      if (!tokens) throw new ErrorApi(401, 'Sin sesión');
      const r = await enviar('POST', '/auth/refrescar', { tokenRefresco: tokens.refresco });
      if (!r.ok) throw await leerError(r);
      configurarSesion((await r.json()) as RespuestaLoginDto);
    } finally {
      refrescoEnCurso = null;
    }
  })();
  return refrescoEnCurso;
}

export async function api<T>(metodo: string, ruta: string, cuerpo?: unknown): Promise<T> {
  let r = await enviar(metodo, ruta, cuerpo);
  // Token de acceso vencido: se intenta renovar una vez.
  if (r.status === 401 && tokens && !ruta.startsWith('/auth/login')) {
    try {
      await refrescar();
    } catch {
      configurarSesion(null);
      alExpirar('Tu sesión expiró. Vuelve a iniciar sesión.');
      throw new ErrorApi(401, 'Tu sesión expiró.');
    }
    r = await enviar(metodo, ruta, cuerpo);
  }
  if (!r.ok) throw await leerError(r);
  return (r.status === 204 ? undefined : await r.json()) as T;
}
