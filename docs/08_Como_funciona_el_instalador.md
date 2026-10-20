# Cómo funciona el instalador (.exe) {#instalador}

**Autor:** Santiago Caicedo · **Versión:** 0.1.0 · **Descarga:** [Releases de GitHub](https://github.com/santyxswc/CuadroDeTurnos/releases/latest)

Este documento explica qué hay dentro de `TurnoCare-Instalador-0.1.0.exe`, qué pasa al ejecutarlo y cómo se genera. La idea central: **la app de escritorio lleva su propio servidor**. Por eso funciona en cualquier PC con Windows, sin instalar Node.js, sin base de datos y sin internet.

## 1. Qué hace al ejecutarlo

| Paso | Qué pasa | Dónde |
|---|---|---|
| 1 | El instalador (NSIS "de un clic") copia la app sin hacer preguntas ni pedir permisos de administrador. | `%LOCALAPPDATA%\Programs\turnocare\` |
| 2 | Crea los accesos directos **TurnoCare** en el escritorio y en el menú Inicio, y registra el desinstalador en *Aplicaciones instaladas*. | Escritorio / menú Inicio |
| 3 | Abre la app. | — |
| 4 | La app arranca la API dentro de su propio proceso, en un **puerto libre** que elige el sistema y solo en `127.0.0.1`, así que nadie de la red puede conectarse. | Memoria |
| 5 | La primera vez crea la carpeta de datos con el **equipo de ejemplo** (10 usuarios, contraseña `Demo2026`), los tipos de turno, los parámetros laborales y los festivos de Colombia. | `%APPDATA%\TurnoCare\datos\` |
| 6 | Abre la ventana con la pantalla de ingreso, ya conectada a esa API. | — |

Al cerrar la ventana se detienen la app y la API. Si se abre el ícono con la app ya abierta, no se inicia una segunda copia: se trae al frente la ventana que ya estaba. Así nunca hay dos servidores escribiendo los mismos archivos.

## 2. Qué hay dentro

```
TurnoCare.exe                 Electron 44 (Chromium + Node.js), renombrado
resources/app/
├── package.json              "main": dist-electron/main.js
├── dist-electron/main.js     Proceso principal: arranca la API y abre la ventana
├── dist/                     La interfaz (React 19 compilado con Vite)
├── dist-api/servidor.js      La API NestJS completa en un solo archivo (esbuild)
└── node_modules/@node-rs/    argon2: único módulo nativo (hash de contraseñas)
```

El instalador pesa unos **107 MB**. Casi todo es Electron, que trae su propio Chromium y Node.js; el código de TurnoCare ocupa solo unos pocos MB.

## 3. Cómo arranca, paso a paso

```
 Doble clic en TurnoCare
          │
          ▼
 electron/main.ts ── ¿ya hay una copia abierta? ── sí ──► la trae al frente y sale
          │ no
          ▼
 require('dist-api/servidor.js').iniciarServidor('%APPDATA%\TurnoCare\datos')
          │   · si no existe usuarios.json → crea el equipo de ejemplo
          │   · NestJS escucha en 127.0.0.1:<puerto libre>
          ▼
 BrowserWindow.loadFile('dist/index.html?api=http://127.0.0.1:<puerto>/api')
          │
          ▼
 La interfaz lee ?api= (src/api/cliente.ts) y usa esa dirección
 para HTTP y para el tiempo real (Socket.IO)
```

Detalles que lo hacen funcionar en cualquier PC:

- **Puerto libre (`listen(0)`):** si otro programa usa el 3000, no importa; el sistema asigna uno libre y se le pasa a la interfaz en la dirección.
- **Datos en la carpeta del usuario:** `%APPDATA%` siempre tiene permiso de escritura; la carpeta de instalación no se toca. Desinstalar **no borra los datos**.
- **Sin dependencias externas:** el JS de la API va empaquetado en un solo archivo. El único binario nativo (argon2) se copia junto a la app.
- **Sesión por arranque:** el secreto de los tokens se genera al abrir la app. Los tokens viven en memoria, así que al cerrar la app se cierra la sesión.

## 4. Cómo se genera

```bash
npm install
npm run instalador
```

`npm run instalador` ejecuta, en orden:

1. **Compilar** los paquetes compartidos y la API (`tsc`), y la interfaz (`vite build`).
2. **Empaquetar la API** con `apps/desktop/scripts/empaquetar-api.mjs`: esbuild junta `apps/api/dist/servidor.js` y todas sus dependencias en `dist-api/servidor.js`. Se parte del JS que genera `tsc`, no del TypeScript, porque esbuild no emite los metadatos de decoradores que NestJS necesita para la inyección de dependencias.
3. **Construir el instalador** con `apps/desktop/scripts/instalador.mjs`, que llama a **electron-builder** (configuración en `apps/desktop/package.json`, clave `build`). Se construye en una carpeta temporal fuera del proyecto, porque Windows a veces bloquea carpetas que un editor está vigilando. Al final copia el `.exe` a `apps/desktop/release/`.

Configuración principal de electron-builder:

| Opción | Valor | Por qué |
|---|---|---|
| `nsis.oneClick` | `true` | Instala sin preguntas |
| `nsis.perMachine` | `false` | No pide administrador; se instala para el usuario actual |
| `nsis.runAfterFinish` | `true` | Abre la app al terminar |
| `nsis.deleteAppDataOnUninstall` | `false` | Desinstalar conserva los datos |
| `asar` | `false` | El módulo nativo de argon2 se carga sin pasos extra |
| `files` | `dist`, `dist-electron`, `dist-api`, `@node-rs/argon2` | Solo lo necesario; React ya va dentro de `dist` |

## 5. Publicar una versión nueva

1. Subir el número en `apps/desktop/package.json` (`version`).
2. `npm run instalador`.
3. Crear el release y adjuntar el `.exe`:
   ```bash
   gh release create v0.1.1 apps/desktop/release/TurnoCare-Instalador-0.1.1.exe --title "TurnoCare 0.1.1" --notes "Novedades…"
   ```

El `.exe` no se guarda en el repositorio (`*.exe` está en `.gitignore`): pesa más de los 100 MB que permite GitHub por archivo, así que se distribuye por **Releases**.

## 6. Limitaciones conocidas

- **No tiene firma digital.** Windows SmartScreen muestra "Windows protegió su PC" la primera vez. Se continúa con *Más información → Ejecutar de todas formas*. Firmarlo requiere un certificado de pago.
- **Solo Windows de 64 bits.** electron-builder también puede generar versiones para macOS y Linux, pero no se configuraron.
- **Cada instalación tiene sus propios datos.** Está pensada para un computador compartido, por ejemplo el de la estación de enfermería. Para que varios computadores compartan los mismos datos habría que dejar la API en un servidor de la red; el código ya lo permite (`npm run start -w @sgt/api` y `VITE_API_URL`).
