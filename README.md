# TurnoCare · SGT (Sistema de Gestión de Turnos de Enfermería)

Aplicación de escritorio para que un equipo de enfermería maneje su cuadro de turnos, marcaciones de entrada y salida, horas diurnas/nocturnas, recargos, solicitudes, vacaciones, pacientes atendidos y chat del equipo.

Entrega comprometida: **11 de noviembre de 2026**.

## Tecnologías

| Parte | Lenguaje | Tecnología |
|---|---|---|
| App de escritorio | TypeScript + CSS | Electron, React 19, Vite |
| API | TypeScript | Node.js, NestJS 11 |
| Datos | JSON | **Sin base de datos**: archivos JSON que solo la API lee y escribe (ADR-010) |
| Motor de reglas | TypeScript puro | Sin dependencias; pruebas con Vitest |
| Infraestructura | YAML | GitHub Actions |

## Estructura

```
apps/
  desktop/        App de escritorio (Electron + React). Todas las pantallas usan la API
  api/            API NestJS; guarda los datos en archivos JSON (carpeta apps/api/datos/, ignorada por git)
packages/
  shared-types/   Enums, DTOs y parámetros laborales por defecto
  rules-engine/   Cálculo de horas, recargos, estado del turno y filtro de aptos
docs/             Plan técnico, decisiones, bitácora y documentos del cliente
```

## Instalar en cualquier computador (Windows)

1. Ejecuta **TurnoCare-Instalador-0.1.0.exe**. No pregunta nada: se instala, deja un ícono **TurnoCare** en el escritorio y se abre sola.
2. Entra con un usuario de ejemplo (en la pantalla de ingreso, **¿Primera vez?**).

No necesita Node.js, internet ni base de datos: la app lleva su propio servidor y guarda los datos en `%APPDATA%\TurnoCare\datos`. Si Windows muestra "Windows protegió su PC", pulsa **Más información → Ejecutar de todas formas** (el instalador no está firmado).

Para generar el instalador desde el código (en Windows, con Node.js 22+):

```bash
npm install
npm run instalador
```

El archivo queda en `apps/desktop/release/`.

## Cómo abrir la aplicación desde el código (forma fácil)

1. Instala [Node.js](https://nodejs.org) (versión 22 o superior). No se necesita base de datos.
2. Abre una terminal en esta carpeta y escribe, solo la primera vez:
   ```bash
   npm install
   ```
3. Cada vez que quieras usar la app:
   ```bash
   npm run iniciar
   ```
   Se abre sola en el navegador (http://localhost:5173). Para cerrarla: `Ctrl + C` en la terminal.

Usuarios de ejemplo (contraseña `Demo2026`): coordinadora **52123456** (Laura Méndez) y enfermero **80234567** (Andrés Rojas).

¿Primera vez? Abre **Ayuda** en el menú de la app o lee la [guía de usuario](docs/06_Guia_de_Usuario.md).

## Cómo ejecutar por partes (desarrollo)

```bash
npm install
npm run build

# 1. API (http://localhost:3000/api). La primera vez crea el usuario "admin" y muestra su contraseña temporal en la consola.
cp apps/api/.env.example apps/api/.env      # poner un SGT_JWT_SECRET
npm run semilla:demo -w @sgt/api            # opcional: 10 usuarios de ejemplo, contraseña Demo2026
npm run start -w @sgt/api

# 2. App en el navegador (http://localhost:5173), en otra terminal
npm run dev:desktop

# Como app de escritorio (ver nota sobre Electron abajo)
npm run build -w @sgt/desktop
npm run electron -w @sgt/desktop

# Pruebas (motor de reglas y API)
npm test
```

> **Electron:** npm 12 bloquea los scripts de instalación y el binario de Electron puede no descargarse (pasa incluso con la aprobación ya guardada en `package.json`). Si `npm run electron` falla, ejecuta una vez:
> ```bash
> node node_modules/electron/install.js
> ```

## Documentación

- [Plan técnico](docs/01_Plan_Tecnico_Equipo_Desarrollo_SGT.md)
- [Decisiones a partir de las respuestas del cliente](docs/02_Decisiones_Respuestas_Cliente.md)
- [Bitácora del Sprint 0](docs/03_Bitacora_Sprint0.md)
- [Bitácora del Sprint 1](docs/04_Bitacora_Sprint1.md): autenticación, administración y endpoints de la API
- [Bitácora del Sprint 2](docs/05_Bitacora_Sprint2.md): cuadro de turnos con versiones, tiempo real (Socket.IO) y marcaciones
- [Bitácora de los Sprints 3 a 5](docs/07_Bitacora_Sprint3_a_5.md): horas, pacientes, solicitudes, vacaciones, aptos, chat, avisos y exportación
- [Guía de usuario](docs/06_Guia_de_Usuario.md): cómo usar cada pantalla, para enfermeros y coordinadores
