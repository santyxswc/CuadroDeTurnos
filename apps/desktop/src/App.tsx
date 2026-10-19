import { useEffect, useRef, useState } from 'react';
import { EventoTiempoReal, NOMBRE_CARGO, type MensajeChatDto, type SolicitudDto } from '@sgt/shared-types';
import { useSesion } from './sesion';
import { useDatos } from './api/useDatos';
import { useTiempoReal } from './api/tiempoReal';
import { ultimoLeido } from './api/chatLeido';
import { CambiarPassword } from './pantallas/CambiarPassword';
import { Login } from './pantallas/Login';
import { Inicio } from './pantallas/Inicio';
import { EditorCuadro } from './pantallas/EditorCuadro';
import { Solicitudes } from './pantallas/Solicitudes';
import { Aptos } from './pantallas/Aptos';
import { MisHoras } from './pantallas/MisHoras';
import { Vacaciones } from './pantallas/Vacaciones';
import { Pacientes } from './pantallas/Pacientes';
import { Administracion } from './pantallas/Administracion';
import { Ayuda } from './pantallas/Ayuda';

export type Ruta = 'inicio' | 'editor' | 'solicitudes' | 'aptos' | 'horas' | 'vacaciones' | 'pacientes' | 'admin' | 'ayuda';

const MENU: { ruta: Ruta; texto: string; soloCoordinador?: boolean }[] = [
  { ruta: 'inicio', texto: 'Página principal' },
  { ruta: 'editor', texto: 'Editor de cuadro', soloCoordinador: true },
  { ruta: 'solicitudes', texto: 'Solicitudes' },
  { ruta: 'aptos', texto: 'Filtro de aptos' },
  { ruta: 'horas', texto: 'Horas y recargos' },
  { ruta: 'vacaciones', texto: 'Vacaciones' },
  { ruta: 'pacientes', texto: 'Pacientes atendidos' },
  { ruta: 'admin', texto: 'Administración', soloCoordinador: true },
  { ruta: 'ayuda', texto: 'Ayuda' },
];

export function App() {
  const sesion = useSesion();
  if (!sesion.usuario) return <Login />;
  if (sesion.usuario.debeCambiarPassword) return <CambiarPassword />;
  return <Aplicacion />;
}

interface Aviso {
  id: number;
  texto: string;
  ir: Ruta;
}

function Aplicacion() {
  const { usuario, cerrar } = useSesion();
  const yo = usuario!;
  const solicitudes = useDatos<SolicitudDto[]>('/solicitudes');
  const chat = useDatos<MensajeChatDto[]>('/chat?limite=50');
  const [ruta, setRuta] = useState<Ruta>('inicio');
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const rutaActual = useRef(ruta);
  rutaActual.current = ruta;

  const esCoordinador = yo.rol === 'COORDINADOR';
  // Lo que espera una respuesta de esta persona.
  const pendientes = (solicitudes.datos ?? []).filter((s) =>
    esCoordinador ? s.estado === 'PENDIENTE_COORDINADOR' : s.estado === 'PENDIENTE_COMPANERO' && s.companeroId === yo.id,
  ).length;
  const leido = ultimoLeido(yo.id) ?? '';
  const sinLeer = ruta === 'inicio' ? 0 : (chat.datos ?? []).filter((m) => m.autorId !== yo.id && m.creadoEn > leido).length;

  // Notificaciones dentro de la app: un aviso corto que desaparece solo.
  const avisar = (texto: string, ir: Ruta) => {
    const id = Date.now() + Math.random();
    setAvisos((a) => [...a.slice(-2), { id, texto, ir }]);
    window.setTimeout(() => setAvisos((a) => a.filter((x) => x.id !== id)), 6_000);
  };

  const anteriores = useRef<number | null>(null);
  useEffect(() => {
    if (!solicitudes.datos) return;
    if (anteriores.current !== null && pendientes > anteriores.current && rutaActual.current !== 'solicitudes') {
      avisar(esCoordinador ? 'Hay una solicitud nueva esperando tu aprobación.' : 'Un compañero te pidió un cambio de turno.', 'solicitudes');
    }
    anteriores.current = pendientes;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendientes, solicitudes.datos]);

  useTiempoReal([EventoTiempoReal.SOLICITUD_ACTUALIZADA], () => void solicitudes.recargar());
  useTiempoReal<MensajeChatDto>([EventoTiempoReal.CHAT_ACTUALIZADO], (m) => {
    void chat.recargar();
    if (m?.contenido && m.esNovedad && m.autorId !== yo.id && rutaActual.current !== 'inicio') {
      avisar(`Novedad: ${m.contenido.slice(0, 90)}${m.contenido.length > 90 ? '…' : ''}`, 'inicio');
    }
  });

  const pantalla = {
    inicio: <Inicio />,
    editor: <EditorCuadro />,
    solicitudes: <Solicitudes />,
    aptos: <Aptos />,
    horas: <MisHoras />,
    vacaciones: <Vacaciones />,
    pacientes: <Pacientes />,
    admin: <Administracion />,
    ayuda: <Ayuda ir={setRuta} />,
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
              {m.ruta === 'solicitudes' && pendientes > 0 && <span className="contador" title="Esperan tu respuesta">{pendientes}</span>}
              {m.ruta === 'inicio' && sinLeer > 0 && <span className="contador" title="Mensajes nuevos en el chat">{sinLeer}</span>}
            </button>
          ))}
        </nav>
        <div className="sesion">
          <div className="avatar">{yo.nombres[0]}</div>
          <div>
            <b>{yo.nombres}</b>
            <small>
              {esCoordinador ? 'Coordinador/a' : 'Enfermero/a'} · {NOMBRE_CARGO[yo.cargo]}
            </small>
          </div>
          <button className="enlace" onClick={() => void cerrar()}>
            Salir
          </button>
        </div>
      </aside>
      <main className="contenido">{pantalla}</main>
      <div className="avisos" aria-live="polite">
        {avisos.map((a) => (
          <button
            key={a.id}
            className="aviso"
            onClick={() => {
              setRuta(a.ir);
              setAvisos((x) => x.filter((y) => y.id !== a.id));
            }}
          >
            {a.texto}
          </button>
        ))}
      </div>
    </div>
  );
}
