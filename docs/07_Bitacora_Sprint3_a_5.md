# Bitácora · Sprints 3, 4 y 5 (19 de octubre de 2026)

**Objetivo:** terminar lo que faltaba del MVP. Del Sprint 3: horas y recargos, y pacientes atendidos. Del Sprint 4: solicitudes, filtro de aptos y vacaciones. Del Sprint 5: chat con novedades, avisos dentro de la app, exportación y corrección de marcaciones.
**Entregable:** todas las pantallas trabajan con la API, ya no queda ningún dato de ejemplo, y la guía de usuario está en la app (menú **Ayuda**) y en [06_Guia_de_Usuario.md](06_Guia_de_Usuario.md).

> Criterio de este tramo: es un ejercicio académico que va a usar un estudiante de enfermería, así que se eligió siempre la versión más simple que cumple el requisito.

## Qué se hizo

| # | Qué | Requisitos |
|---|---|---|
| 1 | **Horas y recargos** con turnos publicados y marcaciones reales. Usa el motor de reglas, los parámetros vigentes del mes y los festivos de la API. Se puede calcular con lo programado o con lo marcado. | RF-HOR, RN-01, RN-02 |
| 2 | **Pacientes atendidos**: solo la cantidad por turno, nunca datos personales. Lo registra la persona del turno (o el coordinador) una vez empezado el turno. El coordinador ve el resumen por persona. | RF-PAC-01/02 |
| 3 | **Solicitudes** de intercambio, cesión, permiso y vacaciones. El compañero acepta, luego el coordinador aprueba, y el cuadro cambia solo en una versión nueva. Antes de aprobar se revisa la aptitud de quien toma el turno. Los permisos y vacaciones aprobados dejan los turnos "requiere cobertura". | RF-SOL, RF-VAC-04 |
| 4 | **Vacaciones**: el saldo sale de la fecha de ingreso menos las vacaciones aprobadas en la app (días hábiles con los festivos reales). Simula el rango y la fecha de reintegro, y la solicitud va a la bandeja. | RF-VAC-01 a 03, RN-04 |
| 5 | **Filtro de aptos** con turnos publicados, ausencias aprobadas y parámetros vigentes. Muestra primero a quien tiene menos carga. | RF-APT-01/02, RN-03 |
| 6 | **Chat del equipo**: `chat.json`, historial paginado, envío en tiempo real y marca de **novedad** con filtro. El autor borra en los primeros `chat.minutos_edicion` minutos; el coordinador oculta cualquier mensaje y queda auditado. | RF-CHAT-01, 03, 04 |
| 7 | **Avisos automáticos en el chat** al publicar un cuadro y cuando un turno queda sin cobertura. | RF-CHAT-05 |
| 8 | **No leídos**: un contador junto a *Página principal* cuando llegan mensajes y la persona está en otra pantalla. Lo último leído se guarda en el equipo. | RF-CHAT-02 |
| 9 | **Avisos emergentes** dentro de la app, abajo a la derecha: solicitud nueva por responder o novedad en el chat. Al pulsarlos se abre la pantalla correspondiente. | Notificaciones (S5) |
| 10 | **Exportar a Excel** (CSV con `;` y BOM, para que Excel en español lo abra bien) del cuadro y del detalle de horas. | Reportes (S5) |
| 11 | **Corrección de marcaciones** desde *Horas y recargos* (coordinador): entrada o salida, hora y motivo obligatorio. Queda auditada. | RF-ASI-06 |
| 12 | **Limpieza**: se eliminaron `estado.tsx`, `mock.ts` y `reglas.ts`, el aviso de "pantalla de ejemplo" y la persona del prototipo. | — |
| 13 | **Guía de usuario**: pantalla *Ayuda* con primeros pasos, cada pantalla (para qué sirve, pasos y botón **Abrir**), la versión del coordinador, la leyenda de estados y preguntas frecuentes. La misma guía, más detallada, está en `docs/06_Guia_de_Usuario.md`. | Manual (S6) |

## Pruebas

- API: **51 pruebas** de punta a punta (`node:test`), con 4 nuevas del chat:
  - avisos del sistema;
  - envío en tiempo real y novedades;
  - paginación;
  - borrado por el autor y ocultado auditado.
- Motor de reglas: 28 pruebas (Vitest).
- Recorrido contra una API local con los usuarios de ejemplo:
  - publicar un cuadro;
  - aprobar un permiso;
  - revisar los avisos en el chat;
  - enviar un mensaje con salto de línea;
  - corregir una marcación;
  - confirmar los eventos por socket.

## Decisiones simples (a propósito)

- El chat usa un solo archivo `chat.json`, no uno por mes como decía el plan. Para el volumen de un equipo pequeño alcanza y es más fácil de revisar.
- No hay carga inicial de vacaciones disfrutadas antes de usar la app. El saldo cuenta solo lo aprobado en TurnoCare.
- Un enfermero solo ve sus solicitudes. En el filtro de aptos, los permisos de sus compañeros se notan por los turnos liberados. Al aprobar, la API vuelve a revisar todo.
- La exportación es CSV (abre en Excel) en lugar de PDF o `.xlsx`, para no agregar librerías.

## Pendiente (Sprint 6)

- Prueba de uso con el equipo (UAT): recorrer la guía con un enfermero y con la coordinadora.
- Instalador de escritorio y carga de datos reales.
- Opcionales del plan: mensajes directos, copiar el cuadro del mes anterior, tema oscuro.
