import { useEffect, useState } from 'react';
import { NOMBRE_CARGO } from '@sgt/shared-types';
import { useEstado, useUsuario } from './estado';
import { useSesion } from './sesion';
import { idPrototipo } from './datos/mock';
import { CambiarPassword } from './pantallas/CambiarPassword';
import { AHORA } from './datos/mock';
import { fechaLarga, horaLocal } from './datos/fechas';
import { Login } from './pantallas/Login';
import { Inicio } from './pantallas/Inicio';
import { EditorCuadro } from './pantallas/EditorCuadro';
import { Solicitudes } from './pantallas/Solicitudes';
import { Aptos } from './pantallas/Aptos';
import { MisHoras } from './pantallas/MisHoras';
import { Vacaciones } from './pantallas/Vacaciones';
import { Pacientes } from './pantallas/Pacientes';
import { Administracion } from './pantallas/Administracion';

type Ruta = 'inicio' | 'editor' | 'solicitudes' | 'aptos' | 'horas' | 'vacaciones' | 'pacientes' | 'admin';

const MENU: { ruta: Ruta; texto: string; soloCoordinador?: boolean }[] = [
  { ruta: 'inicio', texto: 'Página principal' },
  { ruta: 'editor', texto: 'Editor de cuadro', soloCoordinador: true },
  { ruta: 'solicitudes', texto: 'Solicitudes' },
  { ruta: 'aptos', texto: 'Filtro de aptos' },
  { ruta: 'horas', texto: 'Horas y recargos' },
  { ruta: 'vacaciones', texto: 'Vacaciones' },
  { ruta: 'pacientes', texto: 'Pacientes atendidos' },
  { ruta: 'admin', texto: 'Administración', soloCoordinador: true },
];

/** Pantallas que ya trabajan con la API; las demás muestran el aviso de datos de ejemplo. */
const CONECTADAS: Ruta[] = ['inicio', 'editor', 'admin'];

export function App() {
  const sesion = useSesion();
  const { iniciarSesion, cerrarSesion } = useEstado();

  // Las pantallas que aún usan datos de ejemplo se muestran con la persona del prototipo equivalente.
  useEffect(() => {
    if (sesion.usuario && !sesion.usuario.debeCambiarPassword) iniciarSesion(idPrototipo(sesion.usuario.documento, sesion.usuario.rol));
    else cerrarSesion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sesion.usuario]);

  if (!sesion.usuario) return <Login />;
  if (sesion.usuario.debeCambiarPassword) return <CambiarPassword />;
  return <Aplicacion />;
}

function Aplicacion() {
  const { usuario: real, cerrar } = useSesion();
  const usuario = useUsuario();
  const { solicitudes } = useEstado();
  const [ruta, setRuta] = useState<Ruta>('inicio');

  if (!usuario || !real) return null;

  const esCoordinador = real.rol === 'COORDINADOR';
  const pendientes = solicitudes.filter((s) =>
    esCoordinador
      ? s.estado === 'PENDIENTE_COORDINADOR'
      : s.estado === 'PENDIENTE_COMPANERO' && s.companeroId === usuario.id,
  ).length;

  const pantalla = {
    inicio: <Inicio />,
    editor: <EditorCuadro />,
    solicitudes: <Solicitudes />,
    aptos: <Aptos />,
    horas: <MisHoras />,
    vacaciones: <Vacaciones />,
    pacientes: <Pacientes />,
    admin: <Administracion />,
  }[ruta];

  return (
    <div className="app">
      <aside className="menu">
        <div className="marca">
          Turno<b>Care</b>
        </div>
        <nav>
          {MENU.filter((m) => !m.soloCoordinador || esCoordinador).map((m) => (
            <button key={m.ruta} className={ruta === m.ruta ? 'activo' : ''} onClick={() => setRuta(m.ruta)}>
              {m.texto}
              {m.ruta === 'solicitudes' && pendientes > 0 && <span className="contador">{pendientes}</span>}
            </button>
          ))}
        </nav>
        <div className="sesion">
          <div className="avatar">{real.nombres[0]}</div>
          <div>
            <b>{real.nombres}</b>
            <small>
              {esCoordinador ? 'Coordinador/a' : 'Enfermero/a'} · {NOMBRE_CARGO[real.cargo]}
            </small>
          </div>
          <button className="enlace" onClick={() => void cerrar()}>
            Salir
          </button>
        </div>
      </aside>
      <main className="contenido">
        {!CONECTADAS.includes(ruta) && (
          <div className="aviso-prototipo">
            Pantalla de ejemplo (se conecta a la API en los próximos sprints) · se muestra como {usuario.nombres} · hora simulada: {fechaLarga(AHORA)}, {horaLocal(AHORA)}
          </div>
        )}
        {pantalla}
      </main>
    </div>
  );
}
