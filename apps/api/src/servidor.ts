// Punto de entrada para la app de escritorio instalada: la API corre dentro de Electron,
// sin consola ni comandos. La primera vez crea los usuarios de ejemplo para que se pueda entrar de una.
import 'reflect-metadata';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { crearApp } from './app';
import { crearUsuariosDemo } from './almacen/usuarios-demo';

export async function iniciarServidor(directorioDatos: string): Promise<{ url: string; app: INestApplication }> {
  if (!existsSync(join(directorioDatos, 'usuarios.json'))) await crearUsuariosDemo(directorioDatos);
  const app = await crearApp(
    {
      directorioDatos,
      // La sesión vive en la ventana: al cerrar la app se cierra, así que basta un secreto por arranque.
      secretoJwt: randomBytes(32).toString('hex'),
      minutosTokenAcceso: 10,
      horasMaximasSesion: 12,
      documentoAdmin: 'admin',
    },
    { logs: false },
  );
  // Puerto libre que elija el sistema: así no choca con otros programas del equipo.
  await app.listen(0, '127.0.0.1');
  return { url: `${(await app.getUrl()).replace('[::1]', '127.0.0.1')}/api`, app };
}
