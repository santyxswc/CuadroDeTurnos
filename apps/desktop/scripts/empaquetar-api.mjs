// Junta la API compilada (apps/api/dist) en un solo archivo para llevarla dentro de la app instalada.
// Se parte del JS que genera tsc porque esbuild no emite los metadatos de decoradores que usa NestJS.
import { join } from 'node:path';
import { build } from 'esbuild';

const escritorio = join(import.meta.dirname, '..');

await build({
  entryPoints: [join(escritorio, '..', 'api', 'dist', 'servidor.js')],
  outfile: join(escritorio, 'dist-api', 'servidor.js'),
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  logLevel: 'warning',
  external: [
    // Módulo nativo: se copia aparte en el instalador.
    '@node-rs/argon2',
    // Paquetes opcionales que NestJS solo carga si existen; esta API no los usa.
    '@nestjs/microservices',
    '@nestjs/microservices/*',
    'class-transformer/storage',
    '@fastify/*',
    'bufferutil',
    'utf-8-validate',
  ],
});
