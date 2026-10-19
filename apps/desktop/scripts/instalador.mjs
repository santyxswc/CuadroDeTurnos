// Genera el instalador en una carpeta temporal y copia solo el .exe a release/.
// Si el proyecto está abierto en un editor, Windows a veces no deja renombrar carpetas dentro de él
// y electron-builder falla; fuera del proyecto no pasa.
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const temporal = join(tmpdir(), 'turnocare-release');
rmSync(temporal, { recursive: true, force: true });

const r = spawnSync(`electron-builder --win --x64 --config.directories.output="${temporal}"`, { stdio: 'inherit', shell: true });
if (r.status !== 0) process.exit(r.status ?? 1);

mkdirSync('release', { recursive: true });
for (const archivo of readdirSync(temporal).filter((a) => a.endsWith('.exe'))) {
  copyFileSync(join(temporal, archivo), join('release', archivo));
  console.log(`\n✔ Instalador listo: apps/desktop/release/${archivo}`);
}
