# CLAUDE.md

Contexto del proyecto para Claude Code. Léelo antes de proponer cambios.

## Proyecto
TurnoCare / SGT: app de escritorio para gestionar turnos de enfermería de **un solo servicio con 10 usuarios** (1 coordinador + 9 enfermeros). App interna, **no se publica en internet**. Entrega final: **11-nov-2026**.

## Decisiones que no se deben revertir sin preguntar
- **NO hay base de datos** (ni PostgreSQL, ni SQLite, ni Prisma, ni Docker). Toda la información, credenciales incluidas, se guarda en **archivos JSON** que **solo la API** lee y escribe. Ver ADR-010 y §8.3 de `docs/01_Plan_Tecnico_Equipo_Desarrollo_SGT.md` (estructura de la carpeta de datos y reglas: escritura atómica con `.tmp` + rename, cola de escrituras, caché en memoria, repositorios con interfaz).
- Las apps de escritorio **nunca** acceden a los archivos directamente; todo pasa por la API.
- Contraseñas siempre hasheadas (Argon2id). De los pacientes solo se guarda la **cantidad atendida por turno**, nunca datos personales (reemplaza el cifrado AES-256-GCM que planteaba el plan original).
- Las marcaciones usan la hora del servidor. Zona horaria `America/Bogota`.
- Las horas oficiales para nómina son las **marcadas** (reales), no las programadas.

## Stack
TypeScript en todo el monorepo (npm workspaces):
- `apps/desktop`: Electron + React 19 + Vite. Todas las pantallas usan la API (`src/api/cliente.ts`, `src/sesion.tsx`); ya no hay datos de ejemplo en memoria. `electron/main.ts` arranca la API empaquetada (`apps/api/src/servidor.ts`) en la app instalada.
- `apps/api`: NestJS 11. Persistencia en `src/almacen/archivo-json.ts` (`ColeccionJson`, `RegistroJsonl`) a través de `AlmacenService`. Todas las rutas requieren sesión salvo `@Publico()`; roles con `@Roles('COORDINADOR')`. Toda acción sensible se registra con `AuditoriaService`.
- `packages/rules-engine`: reglas laborales puras (horas diurnas/nocturnas/dominicales, recargos, estado del turno, aptitud). Pruebas con Vitest; cualquier cambio de reglas va con pruebas.
- `packages/shared-types`: enums, DTOs y `PARAMETROS_DEFECTO`.

## Comandos
- `npm run dev:desktop`: prototipo en http://localhost:5173
- `npm run build` antes de `npm test` (las pruebas de la API usan los paquetes compilados)
- `npm test`: Vitest en `rules-engine` y `node:test` en la API (incluye pruebas de punta a punta por HTTP con carpeta de datos temporal)
- `npm run start -w @sgt/api` / `npm run semilla:demo -w @sgt/api` (usuarios de ejemplo, contraseña `Demo2026`)
- `npm run build` / `npm run typecheck`
- Si Electron no abre: `node node_modules/electron/install.js` (npm 12 bloquea el script de instalación).

## Documentación
- `docs/01_Plan_Tecnico_Equipo_Desarrollo_SGT.md`: requisitos, reglas de negocio, ADRs, C4 y plan de sprints.
- `docs/02_Decisiones_Respuestas_Cliente.md`: respuestas del cliente y los cambios de alcance que generaron (recargos en pesos, datos de pacientes).
- `docs/03`, `04`, `05`, `07`: bitácoras de avance (Sprint 0, 1, 2 y 3 a 5). **Actualízalas al terminar cada paso.**
- `docs/06_Guia_de_Usuario.md` (y su PDF), `docs/08_Como_funciona_el_instalador.md`.

## Forma de trabajo
- Todo en español: código de dominio, textos de la interfaz, documentos y mensajes de commit (formato convencional: `feat(modulo): ...`).
- Commits sin trailer `Co-Authored-By`.
