# TurnoCare · Gestión de turnos de enfermería {#mainpage}

**Autor:** Santiago Caicedo · **Versión:** 0.1.0 · **Código:** [github.com/santyxswc/CuadroDeTurnos](https://github.com/santyxswc/CuadroDeTurnos) · **Descarga:** [instalador para Windows](https://github.com/santyxswc/CuadroDeTurnos/releases/latest)

TurnoCare es una aplicación de escritorio para que un equipo de enfermería maneje su **cuadro de turnos** sin hojas de cálculo. Con ella se marcan la entrada y la salida, se calculan las horas diurnas, nocturnas y dominicales con sus **recargos según la ley colombiana**, se piden cambios de turno, permisos y vacaciones, y el equipo se comunica por un **chat en tiempo real**.

![Página principal de un enfermero en turno](02-inicio-enfermero.png)

## Qué hace

| Para el enfermero/a | Para el coordinador/a |
|---|---|
| Marcar entrada y salida con la hora del servidor | Armar el cuadro con una grilla de "pintar" turnos, con advertencias en vivo |
| Ver el cuadro de la semana y su próximo turno | Publicarlo; cada cambio posterior crea una versión con motivo |
| Pedir intercambios, cesiones, permisos y vacaciones | Aprobar solicitudes; el cuadro se actualiza solo |
| Revisar sus horas y el valor estimado de los recargos | Buscar quién puede cubrir un turno (filtro de aptos) |
| Registrar cuántos pacientes atendió (sin datos personales) | Corregir marcaciones, con registro en la auditoría |
| Chat del equipo con novedades y avisos | Administrar personal, turnos, parámetros legales y festivos |

![Editor de cuadro del coordinador](10-editor.png)

## Cómo está construido

| Parte | Tecnología |
|---|---|
| App de escritorio | Electron 44, React 19, TypeScript, Vite |
| API | Node.js, NestJS 11, Socket.IO (tiempo real) |
| Datos | Archivos JSON con escritura atómica, **sin base de datos** |
| Reglas laborales | Paquete TypeScript puro y probado (Vitest) |
| Pruebas | 28 del motor de reglas y 51 de punta a punta de la API |
| Distribución | Instalador `.exe` (electron-builder + NSIS) que lleva la API adentro |
| CI | GitHub Actions: compila y prueba en cada cambio |

Más detalle en @ref arquitectura "Arquitectura" y en @ref instalador "Cómo funciona el instalador".

## Decisiones de diseño destacadas

- **Un solo instalador, cero configuración.** La app arranca su propia API en un puerto libre y guarda los datos en la carpeta del usuario. Funciona en cualquier PC con Windows sin instalar nada más.
- **Las reglas laborales viven en un paquete aparte**, sin entrada ni salida. Lo usan la API (para validar) y la interfaz (para mostrar advertencias al instante). Así ambos lados siempre calculan igual.
- **Los parámetros legales tienen vigencia por fechas.** La reducción de la jornada (Ley 2101) y el aumento del recargo dominical (Ley 2466) se aplican según la fecha de cada turno, sin alterar los meses ya liquidados.
- **El cuadro publicado nunca se sobrescribe.** Cada cambio crea una versión con autor y motivo, y queda en la auditoría.
- **Tiempo real simple.** El servidor solo avisa "qué cambió" y cada pantalla vuelve a pedir sus datos por HTTP. Hay una sola fuente de verdad.

## Documentación

| Documento | Contenido |
|---|---|
| [Guía de usuario (PDF)](https://github.com/santyxswc/CuadroDeTurnos/blob/main/docs/Guia_de_Usuario_TurnoCare.pdf) | Manual con capturas para enfermeros y coordinadores |
| @ref arquitectura "Arquitectura" | Módulos, flujo de datos, persistencia y tiempo real |
| @ref instalador "Cómo funciona el instalador" | Qué hay dentro del `.exe` y cómo se genera |
| Páginas relacionadas | Plan técnico, decisiones del cliente y bitácoras de cada sprint |
| Archivos y clases | Referencia del código fuente, generada con Doxygen |

## Probarlo

1. Descarga el instalador desde [Releases](https://github.com/santyxswc/CuadroDeTurnos/releases/latest) y ábrelo.
2. En la pantalla de ingreso pulsa **¿Primera vez?** y elige un usuario de ejemplo (contraseña `Demo2026`).

Desde el código: `npm install` y luego `npm run iniciar` (necesita Node.js 22 o superior).
