# Bitácora · Sprint 6: cierre y correcciones (22 de octubre de 2026)

**Objetivo:** dejar el proyecto listo para la entrega del 11 de noviembre: revisar el código en busca de fallas, corregirlas con pruebas y poner al día la documentación.
**Entregable:** todas las correcciones con sus pruebas; pasan todas (API: 53, motor de reglas: 28).

## Correcciones

| # | Falla | Qué se hizo | Dónde |
|---|---|---|---|
| 1 | El **turno de noche del último día del mes** no contaba en *Horas marcadas*: la salida (al día siguiente) no venía en la consulta del mes. | Las marcaciones se piden hasta un día después del período. | `MisHoras.tsx` |
| 2 | El **exceso semanal** (horas extra) se cortaba en el límite del mes: una semana de 50 h repartida entre octubre y noviembre no daba extra. | Se traen las semanas completas que tocan el mes; se muestran solo los turnos del mes. | `MisHoras.tsx` |
| 3 | *Horas y recargos* abría con **horas programadas**, aunque las oficiales para nómina son las marcadas. | Abre con *Horas marcadas*; lo programado sigue disponible. | `MisHoras.tsx` |
| 4 | Dos clics casi simultáneos en **Marcar** podían registrar **dos entradas**. | Las marcaciones se procesan en orden, una a la vez. Prueba nueva. | `marcaciones.service.ts` |
| 5 | Una aprobación y una cancelación al mismo tiempo podían **cruzarse** y dejar la solicitud en un estado incoherente. | Los cambios de estado de las solicitudes se procesan en orden. | `solicitudes.service.ts` |
| 6 | Un turno **liberado** por permiso no se podía devolver a la misma persona: el editor lo tomaba como "sin cambios". | La celda liberada cuenta como vacía, en la API y en el editor. Prueba nueva. | `cuadros.service.ts` |
| 7 | El editor del cuadro **no advertía** si alguien quedaba programado en sus vacaciones o permiso aprobados (por ejemplo, en el borrador del mes siguiente). | Las advertencias revisan las ausencias aprobadas. Prueba nueva. | `cuadros.service.ts` |
| 8 | Aprobar tarde un permiso de "hoy" **liberaba un turno ya trabajado** y sus horas dejaban de contar. | Los turnos que ya empezaron no se liberan. | `cuadros.service.ts` |
| 9 | Un parámetro en **0** (o vacío) como el divisor mensual daba valores de hora infinitos. | La API exige valores mayores que 0 en divisor, jornada máxima, horas continuas, inactividad y SMMLV; el campo vacío se rechaza. Prueba nueva. | `parametros.service.ts`, `Administracion.tsx` |
| 10 | El botón de marcación **no se actualizaba solo** cada minuto (el temporizador se reiniciaba antes de dispararse). | El intervalo ya no se reinicia en cada render. | `Inicio.tsx` |
| 11 | Si un refresco de sesión fallaba de inmediato, quedaba guardado y **todos los refrescos siguientes fallaban**. | La limpieza del refresco en curso se hace siempre. | `api/cliente.ts` |
| 12 | El login respondía **más rápido** cuando el documento no existía (permitía adivinar documentos). | Siempre se verifica un hash. También se limitó la longitud de tokens y contraseñas. | `auth.service.ts`, `dto.ts` |
| 13 | El nombre del archivo exportado quedaba mal (`André- Roja-`). | Expresión regular corregida. | `MisHoras.tsx` |
| 14 | La ventana de Electron podía abrir ventanas nuevas o navegar a otros sitios. | Se bloquean: la app solo muestra su propia interfaz. | `electron/main.ts` |

## Documentación

- `SECURITY.md`, `CLAUDE.md` y `02_Decisiones_Respuestas_Cliente.md`: se aclara que **no se guardan datos personales de pacientes** (solo la cantidad por turno), así que el cifrado AES-256-GCM del plan original no aplica.
- `SECURITY.md`: se documentan los usuarios de ejemplo del instalador (contraseña `Demo2026`). Es un proyecto académico; si se usara con datos reales, hay que cambiarlas desde *Administración*.

## Limitaciones conocidas (aceptadas para la entrega)

- **Parámetros que cambian a mitad de mes** (por ejemplo, jornada máxima de 44 a 42 h el 15-jul-2026): *Horas y recargos* usa los parámetros vigentes el primer día del mes para todo el mes. Solo afecta a julio de 2026 y a meses con cambios de ley.
- **Corregir un turno pasado** en un cuadro publicado crea una asignación nueva; las marcaciones siguen asociadas a la anterior y esas horas no se cuentan. Conviene no editar días que ya pasaron.
- Las **marcaciones "sin turno"** se ven en la corrección, pero no suman en el reporte de horas hasta que el coordinador programe ese turno.
- Si a un coordinador se le cambia el rol, sigue recibiendo los avisos en tiempo real del rol anterior hasta que vuelva a entrar.

## Pendiente

- Prueba de uso con el equipo (UAT) siguiendo la guía.
- Regenerar el instalador (`npm run instalador`) y publicarlo en Releases con estas correcciones.
