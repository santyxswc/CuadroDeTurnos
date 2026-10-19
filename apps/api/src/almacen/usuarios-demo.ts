// Las 10 personas del prototipo como usuarios reales, para probar la app con datos de ejemplo.
// Se escriben directo en el JSON: debe hacerse con la API detenida (un solo proceso escribe, ADR-010).
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import type { Cargo, Rol } from '@sgt/shared-types';
import { ColeccionJson } from './archivo-json';
import type { UsuarioGuardado } from './modelos';
import { hashPassword } from '../auth/passwords';

export const PASSWORD_DEMO = 'Demo2026';

const PERSONAS: [string, string, Rol, Cargo, number, string][] = [
  ['52123456', 'Laura Méndez', 'COORDINADOR', 'JEFE', 3_400_000, '2019-03-04'],
  ['80234567', 'Andrés Rojas', 'ENFERMERO', 'PROFESIONAL', 2_500_000, '2022-02-14'],
  ['1020345678', 'Camila Torres', 'ENFERMERO', 'AUXILIAR', 1_150_000, '2024-06-03'],
  ['1015456789', 'Julián Pardo', 'ENFERMERO', 'AUXILIAR', 1_800_000, '2021-09-20'],
  ['52567890', 'Diana Castillo', 'ENFERMERO', 'ESPECIALISTA', 3_390_000, '2020-01-13'],
  ['1032678901', 'Sofía Herrera', 'ENFERMERO', 'PROFESIONAL', 2_260_000, '2023-10-02'],
  ['1019789012', 'Mateo Gómez', 'ENFERMERO', 'AUXILIAR', 1_800_000, '2026-01-19'],
  ['1026890123', 'Valentina Ruiz', 'ENFERMERO', 'PROFESIONAL', 2_600_000, '2022-11-28'],
  ['1014901234', 'Santiago Vargas', 'ENFERMERO', 'AUXILIAR', 1_900_000, '2023-04-17'],
  ['1030012345', 'Paula Moreno', 'ENFERMERO', 'JEFE', 2_900_000, '2021-05-10'],
];

/** Crea los usuarios de ejemplo que falten. Devuelve cuántos creó. */
export async function crearUsuariosDemo(directorioDatos: string): Promise<number> {
  const usuarios = new ColeccionJson<UsuarioGuardado>(join(directorioDatos, 'usuarios.json'));
  await usuarios.cargar();
  const hash = await hashPassword(PASSWORD_DEMO);
  let creados = 0;
  for (const [documento, nombres, rol, cargo, salarioBase, fechaIngreso] of PERSONAS) {
    if (usuarios.buscar((u) => u.documento === documento)) continue;
    await usuarios.insertar({
      id: randomUUID(),
      documento,
      nombres,
      email: null,
      rol,
      cargo,
      fechaIngreso,
      activo: true,
      hashPassword: hash,
      debeCambiarPassword: false,
      salarios: [{ salarioBase, vigenteDesde: fechaIngreso }],
      creadoEn: new Date().toISOString(),
    });
    creados++;
  }
  return creados;
}
