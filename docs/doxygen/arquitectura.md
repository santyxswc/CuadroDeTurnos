# Arquitectura {#arquitectura}

**Autor:** Santiago Caicedo

TurnoCare es un monorepo con *npm workspaces*. Tiene dos aplicaciones y dos paquetes compartidos, todo en TypeScript.

```
CuadroDeTurnos/
├── apps/
│   ├── desktop/          App de escritorio: Electron (proceso principal) + React (interfaz)
│   └── api/              API NestJS: reglas de negocio, persistencia JSON y tiempo real
├── packages/
│   ├── shared-types/     Enums, DTOs y parámetros por defecto que comparten API e interfaz
│   └── rules-engine/     Motor de reglas laborales: TypeScript puro, sin E/S, con pruebas
├── scripts/              Arranque en un comando (iniciar.mjs) y generador de la guía PDF
└── docs/                 Plan técnico, decisiones, bitácoras, guía de usuario y esta documentación
```

## Vista general

```
┌──────────────────────── TurnoCare.exe (Electron) ────────────────────────┐
│                                                                          │
│  Proceso principal (electron/main.ts)                                    │
│   ├─ inicia la API ──────────────┐                                       │
│   └─ abre la ventana             │                                       │
│                                  ▼                                       │
│  ┌──────────── Interfaz (React) ────────────┐   ┌──── API (NestJS) ────┐ │
│  │ pantallas/  Inicio, EditorCuadro,        │   │ auth  usuarios       │ │
│  │             Solicitudes, Aptos, MisHoras,│HTTP│ cuadros  marcaciones │ │
│  │             Vacaciones, Pacientes,       │──►│ solicitudes  chat    │ │
│  │             Administracion, Ayuda        │   │ parametros  festivos │ │
│  │ api/        cliente HTTP, tiempo real    │◄──│ tiempo-real (eventos)│ │
│  └──────────────────┬───────────────────────┘ WS └──────────┬──────────┘ │
│                     │                                       │            │
│                     └──── @sgt/rules-engine ────────────────┤            │
│                           @sgt/shared-types                 ▼            │
│                                              %APPDATA%\TurnoCare\datos   │
│                                              (archivos JSON)             │
└──────────────────────────────────────────────────────────────────────────┘
```

## Paquetes compartidos

### rules-engine: el motor de reglas laborales

Funciones puras, sin acceso a disco ni a red, con 28 pruebas (Vitest):

| Módulo | Qué calcula |
|---|---|
| `horas.ts` | Divide un turno en horas diurnas, nocturnas, dominicales y festivas, y detecta las horas extra semanales |
| `recargos.ts` | Valor de cada recargo según el salario, el divisor mensual y los porcentajes vigentes |
| `festivos.ts` | Festivos de Colombia (Ley Emiliani y fechas que dependen de la Pascua) |
| `asistencia.ts` | Estado del turno: programado, en turno, retrasado, ausente, salida pendiente o finalizado |
| `aptitud.ts` | Si una persona puede tomar un turno: descanso mínimo, horas en la semana, noches seguidas, cruces y ausencias |

Lo usan los dos lados: la **API** para validar antes de guardar y la **interfaz** para mostrar advertencias al instante. Así nunca calculan distinto.

### shared-types

Enums (roles, estados de turno y de solicitud…), DTOs de cada endpoint, nombres de eventos de tiempo real y los **parámetros laborales por defecto**. Un cambio en un contrato se detecta al compilar en ambos lados.

## API (apps/api)

NestJS 11 con un módulo por área:

| Módulo | Responsabilidad |
|---|---|
| `auth` | Inicio de sesión con argon2, tokens JWT de acceso (10 min) y de refresco, sesión máxima de 12 h, cambio de contraseña |
| `usuarios` | Personal, roles, cargos y salarios con vigencia; los usuarios se desactivan, nunca se borran |
| `cuadros` | Cuadro por período: borrador → publicado (con versiones y motivo) → cerrado |
| `marcaciones` | Entrada y salida con la hora del servidor, estado en vivo y correcciones auditadas |
| `solicitudes` | Intercambio, cesión, permiso y vacaciones; flujo compañero → coordinador; al aprobar cambia el cuadro |
| `atenciones` | Número de pacientes atendidos por turno |
| `chat` | Mensajes, novedades, avisos automáticos del sistema y moderación |
| `parametros`, `festivos`, `tipos-turno` | Configuración con vigencia por fechas |
| `auditoria` | Registro de solo-agregar (`auditoria.jsonl`) de cada acción importante |
| `tiempo-real` | Gateway de Socket.IO autenticado con el mismo token |

Las reglas transversales son un **guard global** (todo exige sesión salvo lo marcado como público), el decorador `@Roles('COORDINADOR')` y la validación de cada entrada con `class-validator`.

### Persistencia sin base de datos

Cada colección es un archivo JSON en la carpeta de datos (`usuarios.json`, `cuadros.json`, `marcaciones.json`, `solicitudes.json`, `chat.json`, …). La clase `ArchivoJson` (`almacen/archivo-json.ts`) garantiza que:

- el contenido vive en memoria y se lee desde ahí;
- las escrituras de un archivo van **en cola**, una a la vez;
- cada escritura es **atómica**: se escribe un `.tmp` y se renombra, así nunca queda un JSON a medio escribir;
- si la escritura falla, la memoria vuelve al valor anterior.

Es suficiente para un equipo de enfermería (decenas de personas) y hace que los datos se puedan revisar y respaldar copiando una carpeta.

### Tiempo real

Cuando algo cambia, la API emite un evento corto, por ejemplo `cuadro.actualizado`, `marcacion.registrada`, `solicitud.actualizada` o `chat.actualizado`. La interfaz no aplica los datos del evento: **vuelve a pedirlos por HTTP**. Es más simple y nunca hay dos versiones de la verdad. Al reconectar, cada pantalla recarga sus datos.

## Interfaz (apps/desktop)

React 19 sin librerías de estado ni de componentes:

- `api/cliente.ts`: `fetch` con renovación automática del token. Los tokens viven solo en memoria.
- `api/useDatos.ts`: hook `useDatos(ruta)`, que devuelve `{ datos, error, cargando, recargar }`.
- `api/tiempoReal.tsx`: conexión Socket.IO y el hook `useTiempoReal(eventos, fn)`.
- `pantallas/`: una pantalla por opción del menú.
- `electron/main.ts`: en la app instalada arranca la API empaquetada y abre la ventana (ver @ref instalador "Cómo funciona el instalador").

## Calidad

- **Pruebas:** 28 del motor de reglas (Vitest) y 51 de punta a punta de la API (`node:test` contra una API real con carpeta temporal), que incluyen permisos, flujos de solicitudes, versiones del cuadro, tiempo real y chat.
- **CI:** GitHub Actions compila todo y corre las pruebas en cada push.
- **Seguridad:** contraseñas con argon2, el rol se comprueba en la API (no solo en la interfaz), la API del instalador escucha solo en `127.0.0.1` y nunca se guardan datos de pacientes.
