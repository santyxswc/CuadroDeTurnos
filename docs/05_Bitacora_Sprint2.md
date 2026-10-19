# Bitácora · Sprint 2 y comienzo del Sprint 3 (19 de octubre de 2026)

**Objetivo (plan técnico §12):** editor de cuadro real (borrador, advertencias, publicar, versiones), vista general en la página principal, tiempo real y marcación de entrada/salida con indicadores.
**Entregable demostrable:** el coordinador arma y publica un cuadro, todo el equipo lo ve en vivo y cada persona marca su entrada y salida con la hora del servidor. Se muestra en la reunión del **miércoles 28 de octubre**.

> El sprint arrancó con retraso: el Sprint 2 debía cerrar el 13-oct. Este paso recupera el Sprint 2 completo y adelanta la parte de marcaciones del Sprint 3.

## Lenguajes y tecnologías de este paso

| Dónde | Lenguaje | Qué se agregó |
|---|---|---|
| `apps/api/src/cuadros` | TypeScript (NestJS) | Cuadros por período: borrador, celdas, advertencias, publicar, versiones, cerrar y descartar |
| `apps/api/src/marcaciones` | TypeScript (NestJS) | Marcación con hora del servidor, asociación al turno, indicadores y correcciones auditadas |
| `apps/api/src/tiempo-real` | TypeScript (Socket.IO) | Gateway autenticado con el token de acceso; se cierra al revocar la sesión |
| `apps/desktop` | TypeScript + React + CSS | Editor de cuadro y página principal conectados a la API, cliente Socket.IO |
| Pruebas | `node:test` | 15 pruebas nuevas de punta a punta (41 en la API, 69 en total con las 28 del motor) |

Librerías nuevas: `@nestjs/websockets`, `@nestjs/platform-socket.io` y `socket.io` en la API; `socket.io-client` en la app (y en las pruebas de la API).

## Qué se hizo

| # | Qué | Por qué |
|---|---|---|
| 1 | Contratos en `shared-types`: `CuadroDto`, `AsignacionDto` (con fecha y código), versiones, advertencias, horas por semana, marcaciones, indicadores y eventos de tiempo real. | Un solo contrato entre API y app. |
| 2 | `cuadros.json`: cada cuadro guarda sus asignaciones y su historial de versiones. Un cuadro publicado nunca borra: la asignación cambiada queda como `REEMPLAZADA` y la versión registra persona, día, turno antes y después, autor y motivo. | RF-CUA-02 a 05, RN-06. |
| 3 | Advertencias por turno con el mismo motor de aptitud (RN-03): cruce, descanso menor al mínimo, noches seguidas. Las horas por semana se devuelven aparte con la jornada máxima y el tope vigentes en esa fecha. Incluye turnos de cuadros vecinos (la última noche del mes afecta el descanso del día 1). | RF-CUA-03. Las advertencias no bloquean. |
| 4 | Gateway Socket.IO: el cliente se conecta con su token; los borradores solo avisan a coordinadores; al cerrar sesión, desactivar o restablecer la contraseña se desconectan sus sockets. | RF-MAIN-05 sin abrir un canal sin autenticación. |
| 5 | `marcaciones.json`: el servidor decide si es entrada o salida, la asocia al turno más cercano dentro de la ventana (`asistencia.ventana_asociacion_h`) o la deja "sin turno"; evita dobles clics (60 s); guarda equipo e IP. El coordinador crea o corrige con motivo obligatorio y queda auditado con valor anterior y nuevo. | RF-ASI-01 a 04 y 06. |
| 6 | Editor de cuadro en la app: paleta de turnos, **clic o arrastre para pintar** celdas, atajos de teclado (letra del turno, Supr = libre), guardado automático en borrador, barra de cambios con motivo en cuadros publicados, historial de versiones, cobertura por turno y Σ semanal con colores de exceso. | Entregable del sprint. |
| 7 | Página principal con datos reales: botón de marcar con la hora del servidor y confirmación, indicadores "En vivo", cuadro semanal publicado y próximo turno. Chat, saldo de vacaciones y solicitudes siguen de ejemplo y están rotulados así. | RF-MAIN-01, 02, 04, 05 y parte de 06. |
| 8 | Estilos según la guía de diseño recomendada (apple-design): respuesta al presionar, tracking por tamaño, material translúcido en la barra flotante, foco visible y soporte de `prefers-reduced-motion`, `prefers-reduced-transparency` y `prefers-contrast`. | RNF-09 (usabilidad y accesibilidad). |

## Endpoints nuevos (`http://localhost:3000/api`)

| Método y ruta | Quién | Qué hace |
|---|---|---|
| `GET /cuadros` | Todos | Lista (los enfermeros no ven borradores) |
| `GET /cuadros/asignaciones?desde&hasta` | Todos | Turnos publicados en un rango (máx. 62 días) |
| `GET /cuadros/:id` | Todos | Cuadro con asignaciones y versiones; advertencias y horas por semana solo para el coordinador |
| `POST /cuadros` | Coordinador | Nuevo borrador (sin cruces con otros períodos) |
| `PUT /cuadros/:id/celdas` | Coordinador | Cambia celdas; en publicado exige `motivo` y crea versión |
| `POST /cuadros/:id/publicar` · `/cerrar` · `DELETE /cuadros/:id` | Coordinador | Publicar, cerrar el período terminado, descartar borrador |
| `POST /marcaciones` | Todos | Marcar entrada o salida (hora del servidor) |
| `GET /marcaciones/mi-turno` · `/estado-actual` | Todos | Botón de marcar e indicadores de la página principal |
| `GET /marcaciones?desde&hasta&usuarioId` | Todos | Coordinador: de cualquiera · enfermero: solo las propias |
| `POST /marcaciones/correcciones` | Coordinador | Crear o corregir con motivo (auditado) |

**Socket.IO** (mismo puerto, ruta `/socket.io`, `auth: { token }`): `cuadro.actualizado`, `marcacion.registrada`.

## Cómo se verificó

- `npm run build`, `npm run typecheck` y `npm test`: 41/41 en la API y 28/28 en el motor.
- Flujo real contra la API con los usuarios de ejemplo y una carpeta de datos temporal: cuadro de octubre con rotación, publicación recibida por socket, marcación asociada al turno, indicadores (Ausente / En turno), versión 2 con motivo y desconexión del socket al cerrar sesión.
- La interfaz no se probó en el navegador en este paso (la extensión de Chrome no estaba conectada); falta una pasada manual del editor y la página principal.

## Pendiente / decisiones

- [ ] Prueba manual del editor (pintar arrastrando, barra de motivo) y de la página principal en Electron.
- [ ] Copiar el cuadro del período anterior (RF-CUA-07, Should).
- [ ] Al cerrar el período, congelar las horas calculadas (RN-06): se hace con el módulo de horas.
- [ ] Alerta de salida pendiente como notificación (RF-ASI-05) y pantalla del coordinador para revisar marcaciones "sin turno" y corregirlas (la API ya existe).
- [ ] Ausencias (vacaciones y permisos aprobados) en las advertencias del cuadro: llegan con las solicitudes del Sprint 4.

## Siguiente

Horas diurnas/nocturnas/dominicales y recargos con datos reales (programadas vs. marcadas), disponibilidad y pacientes atendidos (resto del Sprint 3); luego solicitudes y vacaciones (Sprint 4).
