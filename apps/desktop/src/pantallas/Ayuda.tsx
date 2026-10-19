// Guía de usuario dentro de la app: para qué sirve cada pantalla y cómo se usa, según el rol.
import { useState, type ReactNode } from 'react';
import type { Rol } from '@sgt/shared-types';
import type { Ruta } from '../App';
import { useSesion } from '../sesion';
import { Estado, Tarjeta } from '../componentes/Ui';

interface Seccion {
  ruta: Ruta;
  titulo: string;
  para: string;
  pasos: ReactNode[];
  /** Si solo la ve uno de los roles. */
  rol?: Rol;
  /** Lo que cambia para el coordinador en una pantalla que ven los dos. */
  coordinador?: ReactNode[];
}

const SECCIONES: Seccion[] = [
  {
    ruta: 'inicio',
    titulo: 'Página principal',
    para: 'Es tu punto de partida: marcas entrada y salida, ves quién está en turno, el cuadro de la semana y el chat del equipo.',
    pasos: [
      <>Al llegar, pulsa <b>Marcar entrada</b>. Se usa la hora del servidor, no la del computador, y aparece un aviso verde de confirmación.</>,
      <>Al terminar tu turno pulsa <b>Marcar salida</b>. Si pulsas dos veces seguidas no pasa nada: la segunda se ignora.</>,
      <>En <b>Estado del turno actual</b> ves en vivo a tus compañeros: en turno, retrasado, ausente o con la salida pendiente.</>,
      <>El <b>cuadro de la semana</b> muestra los turnos publicados. Usa las flechas para ver otras semanas. Un turno tachado quedó libre y necesita a alguien que lo cubra.</>,
      <>En el <b>chat</b> escribe y pulsa Enter. Marca <b>Novedad</b> para avisos importantes (se resaltan en naranja y se pueden filtrar). Puedes borrar tu mensaje en los primeros 10 minutos.</>,
    ],
    coordinador: [<>Puedes ocultar cualquier mensaje del chat que no corresponda; queda registrado en la auditoría.</>],
  },
  {
    ruta: 'editor',
    titulo: 'Editor de cuadro',
    rol: 'COORDINADOR',
    para: 'Aquí armas el cuadro de turnos del período (hasta dos meses), lo publicas y haces cambios cuando hace falta.',
    pasos: [
      <>Pulsa <b>Nuevo cuadro</b> y elige la fecha de inicio y fin. Empieza como <Estado valor="BORRADOR" />: solo tú lo ves.</>,
      <>Elige un turno en la paleta (M, T, N…) y haz clic en las casillas, o arrastra para pintar varias. <b>Libre</b> borra la casilla. También puedes escribir la letra del turno o pulsar Supr.</>,
      <>El borrador se guarda solo. Las advertencias (poco descanso, demasiadas horas en la semana) te avisan pero no te bloquean.</>,
      <>Revisa la fila de <b>cobertura</b> de cada día y la columna <b>Σ</b> con las horas de cada persona en la semana.</>,
      <>Pulsa <b>Publicar cuadro</b>. Todo el equipo lo ve al instante y el chat lo anuncia.</>,
      <>Si cambias un cuadro ya <Estado valor="PUBLICADO" />, la app te pide un <b>motivo</b> y crea una versión nueva. El historial de versiones muestra qué cambió y quién lo hizo.</>,
      <>Cuando termina el período, pulsa <b>Cerrar período</b>: queda <Estado valor="CERRADO" /> y ya no admite cambios.</>,
    ],
  },
  {
    ruta: 'solicitudes',
    titulo: 'Solicitudes',
    para: 'Para pedir cambios de turno, permisos y vacaciones sin papeles ni mensajes sueltos.',
    pasos: [
      <>Ve a la pestaña <b>Nueva solicitud</b> y elige el tipo:</>,
      <><b>Intercambio</b>: cambias uno de tus turnos por uno de un compañero. <b>Cesión</b>: le das tu turno a un compañero.</>,
      <><b>Permiso</b>: eliges los días y el motivo (cita médica, calamidad…). <b>Vacaciones</b>: mejor desde la pantalla Vacaciones, que te muestra el saldo.</>,
      <>En un intercambio o cesión, primero el compañero debe <b>aceptar</b> (<Estado valor="PENDIENTE_COMPANERO" />) y luego el coordinador <b>aprueba</b> (<Estado valor="PENDIENTE_COORDINADOR" />).</>,
      <>Al aprobarse queda <Estado valor="APLICADA" /> y el cuadro cambia solo. No tienes que avisar a nadie más.</>,
      <>Mientras esté pendiente puedes <b>cancelarla</b>. El número naranja en el menú indica cuántas esperan tu respuesta.</>,
    ],
    coordinador: [
      <>Ves las solicitudes de todo el equipo. Aprueba o rechaza con un comentario corto.</>,
      <>Antes de aprobar, la app revisa que la persona que toma el turno esté apta (descanso, horas, cruces).</>,
      <>Tus propios permisos y vacaciones quedan aprobados de una vez.</>,
    ],
  },
  {
    ruta: 'aptos',
    titulo: 'Filtro de aptos',
    para: 'Te dice quién puede tomar un turno sin quedar sobrecargado. Sirve para buscar con quién cambiar o quién cubre un turno libre.',
    pasos: [
      <>Elige la fecha y el turno, o pulsa uno de los <b>turnos que requieren cobertura</b>.</>,
      <>La lista se divide en <Estado valor="APTO" />, <Estado valor="APTO_CON_ADVERTENCIA" /> y <Estado valor="NO_APTO" />, con el motivo de cada caso.</>,
      <>Aparece primero quien tiene menos horas esa semana.</>,
    ],
    coordinador: [<>Además ves las horas que sumaría cada persona en la semana.</>],
  },
  {
    ruta: 'horas',
    titulo: 'Horas y recargos',
    para: 'Resume tus horas del mes: diurnas, nocturnas, dominicales y festivas, y extras, con el valor estimado de los recargos.',
    pasos: [
      <>Elige el mes. Cada turno trabajado aparece con su desglose.</>,
      <>Los valores son estimados con tu salario y los porcentajes vigentes. El pago oficial lo hace nómina.</>,
      <>Pulsa <b>Exportar a Excel</b> para descargar el detalle.</>,
    ],
    coordinador: [<>Puedes elegir a cualquier persona del equipo.</>],
  },
  {
    ruta: 'vacaciones',
    titulo: 'Vacaciones',
    para: 'Muestra cuántos días te corresponden y te deja pedirlas.',
    pasos: [
      <>Por cada año trabajado se ganan 15 días hábiles (lunes a sábado, sin festivos).</>,
      <>Elige <b>desde</b> y <b>hasta</b>: la app calcula cuántos días hábiles usas y qué día vuelves a trabajar.</>,
      <>Si algo no cuadra (poca anticipación o pocos días disponibles) aparece en rojo. Si todo está bien, pulsa <b>Pedir vacaciones</b>.</>,
      <>La solicitud sigue su camino en <b>Solicitudes</b>. Al aprobarse, tus turnos de esos días quedan libres para que otra persona los cubra.</>,
    ],
    coordinador: [<>Abajo ves el saldo de todo el equipo.</>],
  },
  {
    ruta: 'pacientes',
    titulo: 'Pacientes atendidos',
    para: 'Registra cuántos pacientes atendiste en cada turno. Solo se guarda el número, nunca datos de los pacientes.',
    pasos: [<>Cuando tu turno ya empezó, escribe el número en la casilla del turno y pulsa <b>Guardar</b>.</>, <>Arriba ves tus totales y el promedio por turno.</>],
    coordinador: [<>El resumen por persona muestra la carga de todo el equipo. Puedes corregir el número de cualquiera.</>],
  },
  {
    ruta: 'admin',
    titulo: 'Administración',
    rol: 'COORDINADOR',
    para: 'Configuración: personal, tipos de turno, parámetros laborales, festivos y registro de auditoría.',
    pasos: [
      <><b>Personal</b>: crea a cada persona con su documento. La app genera una <b>contraseña temporal</b> que la persona cambia al entrar por primera vez.</>,
      <>Si alguien olvida la contraseña, pulsa <b>Contraseña</b> para generarle una nueva. <b>Desactivar</b> le impide entrar, pero conserva su historial.</>,
      <><b>Tipos de turno</b>: código, nombre, horario y color de cada turno.</>,
      <><b>Parámetros</b>: jornada, recargos, descansos… Cada cambio tiene una fecha desde la que rige, así no se alteran los meses anteriores.</>,
      <><b>Festivos</b>: ya vienen los de Colombia; puedes agregar o quitar.</>,
      <><b>Auditoría</b>: las últimas acciones importantes (quién publicó, aprobó, corrigió…).</>,
    ],
  },
];

const PRIMEROS_PASOS = [
  'Entra con tu número de documento y la contraseña que te dio el coordinador.',
  'La primera vez la app te pide cambiarla por una tuya (mínimo 8 caracteres, con letras y números).',
  'Si dejas la app sin usar 15 minutos, la sesión se cierra sola para proteger tus datos.',
  'Usa el menú de la izquierda para moverte. Los números naranjas te avisan de lo que espera tu atención.',
];

const PREGUNTAS: [string, ReactNode][] = [
  ['Olvidé marcar la entrada o la salida, ¿qué hago?', 'Avísale al coordinador por el chat. Él puede corregir la marcación indicando el motivo, y la corrección queda registrada.'],
  ['Olvidé mi contraseña.', 'El coordinador te genera una temporal desde Administración → Personal. Al entrar te pedirá cambiarla.'],
  ['¿Por qué no puedo cederle mi turno a un compañero?', 'La app revisa que tu compañero no quede sin descanso, con demasiadas horas o con dos turnos el mismo día. Mira el Filtro de aptos para ver quién sí puede.'],
  ['Mi solicitud dice "Pendiente de compañero".', 'Tu compañero debe aceptarla desde su pantalla de Solicitudes. Le aparece un aviso y un número en el menú.'],
  ['Un turno aparece tachado.', 'Quedó libre (por un permiso o vacaciones aprobados) y necesita a alguien que lo cubra. El chat también lo avisa.'],
  ['En «Estado del turno actual» dice "Sin conexión".', 'Revisa que la red funcione. La app se reconecta sola y vuelve a cargar los datos al recuperar la conexión.'],
];

export function Ayuda({ ir }: { ir: (r: Ruta) => void }) {
  const { usuario } = useSesion();
  const [rol, setRol] = useState<Rol>(usuario!.rol);
  const esCoordinador = usuario!.rol === 'COORDINADOR';
  const secciones = SECCIONES.filter((s) => !s.rol || s.rol === rol);

  return (
    <div className="pila ayuda">
      <div>
        <h2>¿Cómo usar TurnoCare?</h2>
        <p className="sub">Una guía corta de cada pantalla: para qué sirve y qué hacer. Pulsa «Abrir» para ir directo a ella.</p>
      </div>

      {esCoordinador && (
        <div className="segmentado" role="tablist" aria-label="Ver la guía como">
          <button role="tab" aria-selected={rol === 'ENFERMERO'} className={rol === 'ENFERMERO' ? 'activo' : ''} onClick={() => setRol('ENFERMERO')}>
            Guía del enfermero/a
          </button>
          <button role="tab" aria-selected={rol === 'COORDINADOR'} className={rol === 'COORDINADOR' ? 'activo' : ''} onClick={() => setRol('COORDINADOR')}>
            Guía del coordinador/a
          </button>
        </div>
      )}

      <Tarjeta titulo="Primeros pasos">
        <ol className="pasos">
          {PRIMEROS_PASOS.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ol>
      </Tarjeta>

      <div className="columnas c2 arriba">
        {secciones.map((s) => (
          <Tarjeta
            key={s.ruta}
            titulo={s.titulo}
            acciones={
              (!s.rol || esCoordinador) && (
                <button onClick={() => ir(s.ruta)} aria-label={`Abrir ${s.titulo}`}>
                  Abrir →
                </button>
              )
            }
          >
            <p className="para">{s.para}</p>
            <ol className="pasos">
              {s.pasos.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ol>
            {rol === 'COORDINADOR' && s.coordinador && (
              <div className="extra-coordinador">
                <b>Si eres coordinador/a</b>
                <ul>
                  {s.coordinador.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>
            )}
          </Tarjeta>
        ))}
      </div>

      <Tarjeta titulo="¿Qué significa cada estado?">
        <div className="leyenda">
          <div>
            <h4>Turno del día</h4>
            <p><Estado valor="PROGRAMADO" /> aún no empieza</p>
            <p><Estado valor="EN_TURNO" /> marcó entrada</p>
            <p><Estado valor="RETRASADO" /> empezó y no ha marcado</p>
            <p><Estado valor="AUSENTE" /> pasó una hora sin marcar</p>
            <p><Estado valor="SALIDA_PENDIENTE" /> terminó y no marcó salida</p>
            <p><Estado valor="FINALIZADO" /> marcó entrada y salida</p>
          </div>
          <div>
            <h4>Solicitudes</h4>
            <p><Estado valor="PENDIENTE_COMPANERO" /> espera al compañero</p>
            <p><Estado valor="PENDIENTE_COORDINADOR" /> espera al coordinador</p>
            <p><Estado valor="APLICADA" /> el cuadro ya cambió</p>
            <p><Estado valor="RECHAZADA" /> no se aprobó</p>
            <p><Estado valor="CANCELADA" /> la retiraste</p>
          </div>
          <div>
            <h4>Cuadro</h4>
            <p><Estado valor="BORRADOR" /> solo lo ve el coordinador</p>
            <p><Estado valor="PUBLICADO" /> lo ve todo el equipo</p>
            <p><Estado valor="CERRADO" /> período terminado, sin cambios</p>
          </div>
        </div>
      </Tarjeta>

      <Tarjeta titulo="Preguntas frecuentes">
        <div className="preguntas">
          {PREGUNTAS.map(([p, r]) => (
            <details key={p}>
              <summary>{p}</summary>
              <p>{r}</p>
            </details>
          ))}
        </div>
      </Tarjeta>
    </div>
  );
}
