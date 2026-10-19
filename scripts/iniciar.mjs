// Arranca todo con un solo comando: `npm run iniciar`.
// Compila lo necesario, crea los usuarios de ejemplo la primera vez y abre la app en el navegador.
// Para detener: Ctrl + C en esta ventana.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const raiz = join(import.meta.dirname, '..');
const api = join(raiz, 'apps', 'api');
const opciones = { cwd: raiz, stdio: 'inherit', shell: true };

function paso(texto, comando) {
  console.log(`\n▶ ${texto}…`);
  const r = spawnSync(comando, opciones);
  if (r.status !== 0) {
    console.error(`\n✖ No se pudo completar: ${texto}.`);
    process.exit(1);
  }
}

paso('Preparando la aplicación', 'npm run build -w @sgt/shared-types -w @sgt/rules-engine -w @sgt/api');

if (!existsSync(join(api, 'datos', 'usuarios.json'))) {
  paso('Creando los usuarios de ejemplo', 'npm run semilla:demo -w @sgt/api');
}

console.log(`
──────────────────────────────────────────────────────────
  TurnoCare se está abriendo en el navegador.
  Si no se abre solo, entra a  http://localhost:5173

  Usuarios de ejemplo (contraseña: Demo2026)
    Coordinadora: 52123456  (Laura Méndez)
    Enfermero:    80234567  (Andrés Rojas)

  Para cerrar todo: Ctrl + C en esta ventana.
──────────────────────────────────────────────────────────
`);

const procesos = [
  spawn('node --env-file-if-exists=.env dist/main.js', { ...opciones, cwd: api }),
  spawn('npm run dev -w @sgt/desktop -- --open', opciones),
];

const cerrar = () => {
  for (const p of procesos) p.kill();
  process.exit(0);
};
process.on('SIGINT', cerrar);
process.on('SIGTERM', cerrar);
for (const p of procesos) p.on('exit', (codigo) => codigo && cerrar());
