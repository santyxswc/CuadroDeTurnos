# Guía de usuario · TurnoCare

TurnoCare reemplaza el cuadro de turnos en papel o en hojas de cálculo. Aquí todo el equipo ve el mismo cuadro, marca su entrada y salida, pide cambios, permisos y vacaciones, y se comunica por el chat.

> Esta misma guía está dentro de la app, en el menú **Ayuda**, con un botón para abrir cada pantalla.

**Contenido**

1. [Primeros pasos](#1-primeros-pasos)
2. [Lo que hace cada pantalla](#2-lo-que-hace-cada-pantalla)
3. [¿Cómo hago para…? (enfermero/a)](#3-cómo-hago-para-enfermeroa)
4. [¿Cómo hago para…? (coordinador/a)](#4-cómo-hago-para-coordinadora)
5. [Qué significa cada estado](#5-qué-significa-cada-estado)
6. [Preguntas frecuentes](#6-preguntas-frecuentes)

---

## 1. Primeros pasos

| Paso | Qué hacer |
|---|---|
| 1 | Abre la app. En una instalación de prueba: `npm run iniciar` en la carpeta del proyecto, y se abre sola en el navegador. |
| 2 | Escribe tu **número de documento** y la **contraseña** que te dio el coordinador. |
| 3 | La primera vez la app te pide **cambiar la contraseña** por una tuya: mínimo 8 caracteres, con letras y números. |
| 4 | Muévete con el **menú de la izquierda**. Los **números naranjas** te avisan de lo que espera tu atención (solicitudes por responder, mensajes nuevos). |
| 5 | Si dejas la app sin usar **15 minutos**, la sesión se cierra sola para proteger tus datos. |

Usuarios de prueba (contraseña `Demo2026`): coordinadora **52123456** (Laura Méndez) y enfermero **80234567** (Andrés Rojas).

Cuando pasa algo importante (una solicitud nueva, una novedad en el chat) aparece un **aviso abajo a la derecha**. Púlsalo para ir a esa pantalla; si no, desaparece solo.

---

## 2. Lo que hace cada pantalla

| Pantalla | Para qué sirve | Quién la ve |
|---|---|---|
| **Página principal** | Marcar entrada y salida, ver quién está en turno, el cuadro de la semana, tu próximo turno, tu saldo de vacaciones y el chat del equipo. | Todos |
| **Editor de cuadro** | Armar el cuadro del período, publicarlo y hacer cambios con motivo. | Coordinador/a |
| **Solicitudes** | Pedir intercambios, cesiones, permisos y vacaciones; responder a lo que te piden. | Todos |
| **Filtro de aptos** | Ver quién puede tomar un turno sin quedar sobrecargado. | Todos |
| **Horas y recargos** | Horas del mes (diurnas, nocturnas, dominicales y festivas, extras) y el valor estimado de los recargos. Exportar a Excel. | Todos |
| **Vacaciones** | Saldo de días, simular fechas y pedir vacaciones. | Todos |
| **Pacientes atendidos** | Registrar cuántos pacientes atendiste en cada turno (solo el número). | Todos |
| **Administración** | Personal, tipos de turno, parámetros laborales, festivos y auditoría. | Coordinador/a |
| **Ayuda** | Esta guía. | Todos |

---

## 3. ¿Cómo hago para…? (enfermero/a)

### Marcar mi entrada y mi salida
1. En la **Página principal**, pulsa **Marcar entrada** al llegar.
2. Aparece un aviso verde con la hora registrada. Se usa la hora del servidor, no la de tu computador.
3. Al terminar, pulsa **Marcar salida**.

Si pulsas dos veces seguidas no pasa nada: la segunda se ignora. Si olvidaste marcar, avísale al coordinador por el chat para que la corrija.

### Ver mis turnos
- El **cuadro de la semana** está en la Página principal. Usa las flechas **‹ ›** para ver otras semanas y **Hoy** para volver.
- Tu **próximo turno** aparece en un recuadro aparte.
- Un turno **tachado** quedó libre (por un permiso o vacaciones) y necesita a alguien que lo cubra.

### Cambiar un turno con un compañero (intercambio) o dárselo (cesión)
1. Si quieres, revisa antes en **Filtro de aptos** quién puede tomar ese turno.
2. Ve a **Solicitudes → Nueva solicitud**.
3. Elige **Intercambio** (cambias tu turno por uno suyo) o **Cesión** (le das tu turno).
4. Elige tu turno, el compañero y, en el intercambio, el turno de él que tomas tú. Envía.
5. Tu compañero recibe un aviso y debe **aceptar**. Luego el coordinador **aprueba**.
6. Al aprobarse, el **cuadro cambia solo**. No hace falta avisar a nadie más.

Si la app no te deja, es porque tu compañero quedaría sin descanso, con demasiadas horas o con dos turnos el mismo día.

### Responder a un compañero que me pidió un cambio
1. Verás un número naranja en **Solicitudes** y un aviso.
2. Abre **Solicitudes → Bandeja** y pulsa **Aceptar** o **Rechazar**.

### Pedir un permiso
1. **Solicitudes → Nueva solicitud → Permiso**.
2. Elige los días y el motivo (cita médica, calamidad doméstica, académico, personal u otro). Agrega un comentario si quieres.
3. Cuando el coordinador lo apruebe, tus turnos de esos días quedan libres para que otra persona los cubra.

### Pedir vacaciones
1. Abre **Vacaciones**. Arriba ves los **días disponibles**: 15 días hábiles por cada año trabajado (lunes a sábado, sin festivos).
2. Elige **desde** y **hasta**. La app calcula cuántos días hábiles usas y qué día vuelves a trabajar.
3. Si algo no cuadra (poca anticipación, pocos días disponibles) aparece en rojo y no te deja enviar.
4. Pulsa **Pedir vacaciones**. Sigue el estado en **Solicitudes**.

### Cancelar una solicitud
En **Solicitudes → Bandeja**, mientras esté pendiente, pulsa **Cancelar**.

### Registrar los pacientes que atendí
1. Abre **Pacientes atendidos**.
2. Cuando tu turno ya empezó, escribe el número en la casilla del turno y pulsa **Guardar**.
3. Solo se guarda el número, nunca nombres ni datos de los pacientes.

### Revisar mis horas
1. Abre **Horas y recargos** y elige el mes.
2. **Calcular con**: *Turnos programados* (según el cuadro) u *Horas marcadas* (lo que marcaste, que es lo que cuenta para nómina).
3. En el detalle ves cada turno, su desglose y a qué hora marcaste.
4. **Exportar a Excel** descarga el detalle.

El valor de los recargos es un estimado; el pago oficial lo hace nómina.

### Usar el chat
- Escribe en la caja de abajo y pulsa **Enter**. Para cambiar de línea usa **Shift + Enter**.
- Marca **Novedad** para avisos importantes: se resaltan en naranja y se pueden ver solas con **Solo novedades**.
- Puedes **borrar** tu mensaje en los primeros 10 minutos.
- Los mensajes **Aviso del sistema** los escribe la app sola: cuando se publica un cuadro o un turno queda sin cobertura.
- Si estás en otra pantalla, el número naranja junto a **Página principal** indica mensajes nuevos.

---

## 4. ¿Cómo hago para…? (coordinador/a)

El coordinador también puede hacer todo lo anterior. Además:

### Crear al personal
1. **Administración → Personal → + Nuevo usuario**.
2. Llena documento, nombres, rol, cargo, fecha de ingreso y salario.
3. La app muestra una **contraseña temporal**: entrégasela a la persona. Al entrar, deberá cambiarla.
- **Contraseña**: genera una nueva temporal si alguien la olvidó.
- **Desactivar**: la persona ya no puede entrar, pero se conserva su historial.

### Armar y publicar el cuadro
1. **Editor de cuadro → Nuevo cuadro**. Elige el período (máximo dos meses). Empieza como **Borrador**: solo tú lo ves.
2. Elige un turno en la **paleta** (M, T, N…) y haz clic en las casillas, o **arrastra** para pintar varias. **Libre** borra. Atajos: la letra del turno, o **Supr** para Libre.
3. Se guarda solo. Revisa:
   - las **advertencias** (poco descanso, demasiadas horas en la semana, muchas noches seguidas): avisan pero no bloquean;
   - la fila de **cobertura** de cada día;
   - la columna **Σ** con las horas por persona y semana.
4. Pulsa **Publicar cuadro**. Todo el equipo lo ve al instante y el chat lo anuncia.
5. **Exportar a Excel** descarga el cuadro (una fila por persona, una columna por día).

### Cambiar un cuadro ya publicado
1. Pinta los cambios. Aparece una barra abajo que pide el **motivo**.
2. Guarda: se crea una **versión nueva**. En **Historial** ves qué cambió, quién y por qué.
3. Al terminar el período, pulsa **Cerrar período**: ya no admite cambios.

### Aprobar o rechazar solicitudes
1. El número naranja en **Solicitudes** indica cuántas esperan tu respuesta.
2. En la **Bandeja**, revisa y pulsa **Aprobar** o **Rechazar**, con un comentario corto si quieres.
3. Antes de aprobar, la app vuelve a revisar que quien toma el turno esté apta. Al aprobar, el cuadro cambia solo.
4. Tus propios permisos y vacaciones quedan aprobados de una vez.

### Buscar quién cubre un turno libre
1. **Filtro de aptos**: pulsa uno de los **turnos que requieren cobertura**, o elige fecha y turno.
2. La lista muestra primero a quien tiene menos horas esa semana, con el motivo de cada clasificación.
3. Luego asigna el turno en el **Editor de cuadro** (con motivo).

### Corregir una marcación
1. **Horas y recargos** → elige la persona y el mes.
2. En el detalle, pulsa **Corregir** en el turno.
3. Elige si corriges la **entrada** o la **salida**, la hora correcta y el **motivo**. La corrección queda en la auditoría.

### Ajustar parámetros, turnos y festivos
- **Tipos de turno**: código, nombre, horario y color.
- **Parámetros**: jornada, recargos, descansos, anticipación de vacaciones… Cada cambio tiene una **fecha desde la que rige**, así no se alteran los meses anteriores.
- **Festivos**: ya vienen los de Colombia; puedes agregar o quitar.
- **Auditoría**: las últimas acciones importantes (quién publicó, aprobó, corrigió u ocultó un mensaje).

### Moderar el chat
Pulsa **Ocultar** en cualquier mensaje que no corresponda. Deja de verse para todos y queda registrado en la auditoría.

---

## 5. Qué significa cada estado

**Turno del día** (Página principal → Estado del turno actual)

| Estado | Significa |
|---|---|
| Programado | Aún no empieza |
| En turno | Marcó entrada |
| Retrasado | El turno empezó y no ha marcado (pasada la tolerancia de 10 min) |
| Ausente | Pasó una hora sin marcar |
| Salida pendiente | El turno terminó y no marcó salida |
| Finalizado | Marcó entrada y salida |

**Solicitudes**

| Estado | Significa |
|---|---|
| Pendiente de compañero | Espera que el compañero acepte |
| Pendiente de coordinador | Espera la aprobación |
| Aprobada y aplicada | Aprobada; el cuadro ya cambió |
| Rechazada / Rechazada por compañero | No se aprobó |
| Cancelada | Quien la pidió la retiró |

**Cuadro**

| Estado | Significa |
|---|---|
| Borrador | En preparación; solo lo ve el coordinador |
| Publicado | Lo ve todo el equipo; los cambios crean versiones |
| Cerrado | Período terminado; ya no admite cambios |

**Filtro de aptos**

| Estado | Significa |
|---|---|
| Apto | Puede tomar el turno |
| Apto con advertencia | Puede, pero queda cerca del límite de horas |
| No apto | Rompería una regla: descanso, cruce, vacaciones o permiso, exceso de horas |

---

## 6. Preguntas frecuentes

**Olvidé marcar la entrada o la salida.**
Avísale al coordinador. Él la corrige en *Horas y recargos* indicando el motivo.

**Olvidé mi contraseña.**
El coordinador te genera una temporal en *Administración → Personal → Contraseña*.

**No me deja ceder mi turno.**
Tu compañero quedaría sin descanso, con demasiadas horas o con dos turnos ese día. Mira el *Filtro de aptos*.

**Mi solicitud dice "Pendiente de compañero".**
Tu compañero debe aceptarla desde su *Bandeja*. Le aparece un aviso y un número en el menú.

**Un turno aparece tachado.**
Quedó libre por un permiso o vacaciones aprobados y necesita a alguien que lo cubra.

**En «Estado del turno actual» dice "Sin conexión".**
Revisa la red. La app se reconecta sola y vuelve a cargar los datos al recuperar la conexión.

**El saldo de vacaciones no coincide con lo que tengo.**
La app cuenta las vacaciones aprobadas dentro de TurnoCare. Las tomadas antes de usar la app no aparecen; coméntalo con el coordinador.
