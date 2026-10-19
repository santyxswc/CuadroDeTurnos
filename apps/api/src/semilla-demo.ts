// Crea los usuarios de ejemplo para probar el login. Solo para desarrollo.
// Detén la API antes de ejecutarlo: la regla es que un solo proceso escriba los JSON (ADR-010).
import { crearUsuariosDemo, PASSWORD_DEMO } from './almacen/usuarios-demo';
import { configDesdeEntorno } from './config';

async function main() {
  const { directorioDatos } = configDesdeEntorno();
  const creados = await crearUsuariosDemo(directorioDatos);
  console.log(`${creados} usuarios de ejemplo creados en ${directorioDatos}. Contraseña de todos: ${PASSWORD_DEMO}`);
}

void main();
