# SGT · Decisiones a partir de las respuestas del cliente

| Campo | Valor |
|---|---|
| Versión | 1.0 |
| Fecha | 24 de septiembre de 2026 |
| Fuente | [`docs/cliente/respuestasCliente.md`](cliente/respuestasCliente.md) |
| Afecta a | [`01_Plan_Tecnico_Equipo_Desarrollo_SGT.md`](01_Plan_Tecnico_Equipo_Desarrollo_SGT.md) (sube a v0.2) |
| Validar en | Reunión con el cliente del **miércoles 30 de septiembre** |

> Este documento traduce cada respuesta del cliente en una decisión concreta (requisito, parámetro o cambio de alcance). Las marcadas con ⚠️ **contradicen lo que se le prometió al cliente en la propuesta** y deben quedar aprobadas por escrito el 30-sep.

---

## 1. Resumen de respuestas y decisión tomada

| # | Respuesta del cliente | Decisión | Impacto |
|---|---|---|---|
| 1 | Los turnos los asigna el coordinador; él gestiona horarios y turnos. | Se confirma: solo el rol `COORDINADOR` crea, edita y publica el cuadro. | Ninguno (ya previsto). |
| 2 | Cuando el coordinador necesita una solicitud, deja una anotación; no necesita aprobación, pero queda constancia. | Las solicitudes del coordinador se **autoaprueban** al crearse (estado `APLICADA` directo) y quedan en auditoría con la marca `autoaprobada = true`. Se cierra la pregunta 🔴 3 del §14. | Nuevo RF-SOL-08. |
| 3 | Salarios por cargo: auxiliar desde $1.150.000; profesional/jefe $2.260.000–$3.400.000; especialista ≈ $3.390.000 o más. | ⚠️ El cliente quiere **valor monetario de recargos**. Se agrega `cargo` y `salario_base` al usuario y un cálculo de valor por hora. | Cambio de alcance (ADR-008). |
| 4 | Tabla de recargos (imagen). | Se parametrizan los porcentajes con vigencia. Ver §3. | Nuevo RN-07. |
| 5 | Las horas se calculan sobre las **ya marcadas** (puede haber cambios o sustituciones). | Horas oficiales = **horas reales** (marcaciones). Las programadas se muestran solo como referencia y para el filtro de aptos. | Cierra pregunta 6 del §14. |
| 6 | "Calcúlalas tú, como en una empresa de salud" (tolerancias, descansos, topes). | Se fijan valores por defecto del §2, todos editables por el coordinador. | Cierra pregunta 7 del §14. |
| 7 | Vacaciones: 15 días hábiles consecutivos por año; se conceden dentro del año siguiente; aviso con 15 días de anticipación. | Se confirma RN-04. Anticipación mínima = 15 días. Alerta cuando un periodo causado está por cumplir 1 año sin disfrutarse. | Nuevo RF-VAC-07. |
| 8 | Datos de pacientes: nombre, documento, diagnóstico, teléfono y estado de egreso. | ⚠️ Pasa de "solo un número" a **registro de pacientes con datos sensibles de salud**. Ver §4. | Cambio de alcance (ADR-009). |
| 9 | 1 coordinador y 9 enfermeros. | 10 usuarios. RNF-03 se reduce a 20 conexiones simultáneas (margen ×2). | Simplifica infraestructura. |

---

## 2. Parámetros laborales por defecto (respuesta 6)

Todos se guardan en `parametros.json` con vigencia (no hay base de datos, ver ADR-010) y los puede cambiar el coordinador.

| Clave | Valor por defecto | Justificación |
|---|---|---|
| `jornada.inicio_nocturna` | 19:00 | Ley 2466 de 2025, art. 10 (desde 25-dic-2025). |
| `jornada.fin_nocturna` | 06:00 | CST art. 160. |
| `jornada.maxima_semanal_h` | 42 | Ley 2101 de 2021, escalón vigente desde 15-jul-2026. |
| `jornada.divisor_mensual_h` | 210 | 42 h ÷ 6 días × 30 días. Base para el valor hora. |
| `extra.max_diarias_h` | 2 | CST art. 22 (Ley 50 de 1990). |
| `extra.max_semanales_h` | 12 | Ídem. Límite duro del filtro de aptos: 42 + 12 = 54 h. |
| `aptitud.umbral_alerta_pct` | 90 | "Apto con advertencia" desde 37,8 h en la semana. |
| `aptitud.descanso_minimo_h` | 12 | Práctica habitual en IPS para turnos de 12 h. |
| `aptitud.max_noches_consecutivas` | 3 | Práctica habitual; reduce fatiga en turnos N. |
| `aptitud.max_horas_continuas` | 12 | No se programan turnos continuos de más de 12 h. |
| `aptitud.dias_descanso_semana` | 1 | Descanso obligatorio semanal (CST art. 172). |
| `asistencia.tolerancia_retraso_min` | 10 | Pasados 10 min sin marcar → "Retrasado". |
| `asistencia.minutos_ausente` | 60 | Pasada 1 h sin marcar → "Ausente". |
| `asistencia.ventana_asociacion_h` | 2 | La marcación se asocia a la asignación a ±2 h. |
| `asistencia.alerta_salida_min` | 30 | "Salida pendiente" 30 min después del fin. |
| `vacaciones.dias_por_anio` | 15 | CST art. 186. |
| `vacaciones.anticipacion_min_dias` | 15 | Respuesta 7 del cliente. |
| `vacaciones.dias_habiles` | Lun–Sáb sin festivos | Regla general del CST; **confirmar con talento humano** si el sábado cuenta para el personal por turnos. |
| `vacaciones.permitir_anticipadas` | No | Se pueden pedir al cumplir el año de servicio. |
| `seguridad.inactividad_min` | 15 | Equipos compartidos en la estación de enfermería. |
| `chat.minutos_edicion` | 10 | Tiempo para editar o borrar un mensaje propio. |

**Tipos de turno iniciales** (el cliente no envió horarios; se proponen los usuales y se validan el 30-sep):

| Código | Nombre | Horario | Duración |
|---|---|---|---|
| M | Mañana | 07:00–13:00 | 6 h |
| T | Tarde | 13:00–19:00 | 6 h |
| N | Noche | 19:00–07:00 | 12 h |
| D | Día largo | 07:00–19:00 | 12 h |

---

## 3. Recargos y valor monetario (respuestas 3 y 4) · ADR-008 ⚠️

### 3.1 Cambio de alcance
El plan decía: *"La aplicación cuenta horas; no calcula dinero"* (supuesto 6 y "Won't" de nómina). El cliente envió salarios y tabla de recargos, así que **espera ver valores en pesos**. Decisión propuesta:

- La app calcula el **valor estimado de recargos y horas extra** por persona y período, a partir del salario base.
- **No** liquida nómina completa (sin seguridad social, prestaciones, auxilio de transporte ni deducciones). El reporte lo dice explícitamente: *"Valor estimado de recargos. La liquidación oficial la hace nómina."*

### 3.2 Regla RN-07 · Recargos
Se guardan **porcentajes base** con vigencia y los combinados se calculan sumando. Así la tabla del cliente se reproduce exacta y se actualiza sola cuando cambia la ley:

| Concepto | % base (parámetro) | Combinado |
|---|--:|--:|
| Recargo nocturno | 35 % | — |
| Hora extra diurna | 25 % | — |
| Hora extra nocturna | 75 % | — |
| Dominical/festivo | **90 %** (desde 1-jul-2026) | — |
| Nocturna dominical/festiva | | 90 + 35 = **125 %** |
| Extra diurna dominical/festiva | | 90 + 25 = **115 %** |
| Extra nocturna dominical/festiva | | 90 + 75 = **165 %** |

Vigencias del recargo dominical (Ley 2466 de 2025): 80 % desde 1-jul-2025 · 90 % desde 1-jul-2026 · **100 % desde 1-jul-2027** (en esa fecha los combinados pasan a 135 %, 125 % y 175 % sin tocar código).

**Fórmulas**

```
valor_hora         = salario_base / divisor_mensual_h            (210 con jornada de 42 h)
recargo_nocturno   = horas_nocturnas_ordinarias × valor_hora × 0,35
extra_diurna       = horas_extra_diurnas × valor_hora × 1,25     (la hora + el recargo)
dominical_diurna   = horas_dominicales_diurnas × valor_hora × 0,90
...
```

Ejemplo, enfermera jefe con $2.800.000: valor hora = 2.800.000 / 210 = $13.333. Una noche sábado→domingo (5 h nocturnas ordinarias + 6 h nocturnas dominicales + 1 h diurna dominical) genera: 5 × 13.333 × 0,35 + 6 × 13.333 × 1,25 + 1 × 13.333 × 0,90 = **$135.333** de recargos.

### 3.3 Observación para el cliente
El salario de **auxiliar desde $1.150.000** está por debajo del salario mínimo legal (el de 2025 ya era $1.423.500). La app validará que `salario_base ≥ SMMLV vigente` (parámetro) y mostrará una advertencia si no se cumple. Conviene confirmar si esa cifra es de medio tiempo o si está desactualizada.

### 3.4 Cargos
Se agrega el catálogo `CARGO`: Auxiliar de enfermería, Enfermero/a profesional, Enfermero/a jefe, Enfermero/a especialista. El cargo es independiente del **rol** en la app (el coordinador puede ser jefe de enfermería).

---

## 4. Registro de pacientes (respuesta 8) · ADR-009 ⚠️

> **Actualización (Sprint 3):** este cambio de alcance **no se implementó**. Para simplificar y no manejar datos sensibles, TurnoCare guarda solo la **cantidad de pacientes atendidos por turno** (RF-PAC-01/02), sin nombre, documento, diagnóstico ni teléfono. Por eso RF-PAC-04/05 y RNF-13 a RNF-17 quedan fuera del producto. Ver `07_Bitacora_Sprint3_a_5.md`.

### 4.1 Cambio de alcance
La propuesta enviada al cliente dice textualmente: *"Solo se guarda el número, nunca datos de los pacientes."* El cliente ahora pide **nombre, documento, diagnóstico, teléfono y estado de egreso**. El diagnóstico es un **dato sensible** (Ley 1581 de 2012, art. 5) y la información clínica tiene reserva legal (Ley 23 de 1981, Resolución 1995 de 1999). Esto no impide construirlo, pero obliga a lo siguiente:

### 4.2 Requisitos adicionales (propuestos como Must)

| ID | Requisito |
|---|---|
| RF-PAC-04 | Registro por turno de cada paciente atendido: nombre, tipo y número de documento, diagnóstico (código **CIE-10** + descripción), teléfono y estado de egreso. |
| RF-PAC-05 | Estado de egreso como lista cerrada: *Continúa hospitalizado, Alta mejorado, Remitido, Alta voluntaria, Fallecido, Otro*. |
| RNF-13 | Cifrado por campo de documento, teléfono y diagnóstico dentro de `pacientes.json` (AES-256-GCM en la API; la llave no se guarda en la carpeta de datos). |
| RNF-14 | Solo ven el detalle de un paciente el enfermero que lo registró y el coordinador. Los demás solo ven conteos. |
| RNF-15 | Toda **consulta** (no solo cambios) de datos de pacientes queda en auditoría. |
| RNF-16 | Aviso de privacidad y aceptación del tratamiento de datos sensibles en el primer ingreso de cada usuario. |
| RNF-17 | Política de retención definida por el cliente (dato pendiente) y borrado/anonimización al vencer. |

### 4.3 Qué necesitamos del cliente
1. Confirmación **por escrito** del cambio y de que la institución es la **responsable** del tratamiento de esos datos (nosotros somos encargados).
2. ¿Estos datos ya existen en la historia clínica o en otro sistema (HIS)? Si es así, duplicarlos aumenta el riesgo; se podría registrar solo el número de documento y el estado de egreso.
3. Tiempo de retención de los registros.

---

## 5. Nuevos requisitos derivados

| ID | Requisito | P |
|---|---|:-:|
| RF-SOL-08 | Las solicitudes creadas por el coordinador sobre sí mismo se aplican sin aprobación y quedan registradas como "anotación del coordinador" con motivo obligatorio. | M |
| RF-VAC-07 | Alerta al coordinador cuando un periodo de vacaciones causado cumple 11 meses sin programarse (la ley exige concederlas dentro del año siguiente). | S |
| RF-HOR-07 | Valor estimado de recargos y horas extra por persona y período, calculado sobre horas reales (RN-07). | M |
| RF-ADM-04 | Catálogo de cargos y salario base por persona, con historial de cambios salariales (vigencia). | M |

---

## 6. Preguntas que siguen abiertas para el 30-sep

1. 🔴 ¿La institución es pública o privada? (Las respuestas mencionan reglas del CST, así que **asumimos privada**.)
2. 🔴 ¿Hay servidor en la institución y contacto de TI? ¿Los equipos son Windows?
3. 🔴 Horarios exactos de los turnos actuales (proponemos M, T, N y D del §2).
4. 🔴 Aprobación escrita de los dos cambios de alcance (§3 y §4).
5. ¿El sábado cuenta como día hábil para las vacaciones del personal por turnos?
6. ¿Quién reemplaza al coordinador en sus ausencias?
7. Formato de exportación que usa nómina (Excel con qué columnas).
8. ¿El salario de auxiliar de $1.150.000 es correcto?

---

## 7. Impacto en el cronograma

Los dos cambios de alcance suman trabajo aproximado de **4 a 5 días-persona** (cifrado, auditoría de lectura, formularios de pacientes, motor de valorización). Para no mover el 11-nov se propone:

- Recargos en pesos → Sprint 3, junto al motor de horas (se reutiliza la segmentación).
- Registro de pacientes → Sprint 3 (reemplaza al conteo simple).
- Se mueven a v1.1: "Copiar cuadro del mes anterior" (RF-CUA-07), mensajes directos y tema oscuro.
