// Página principal (RF-MAIN-01 a 06). Marcación, indicadores y cuadro vienen de la API y se actualizan en tiempo real;
// el chat, el saldo de vacaciones y las solicitudes siguen con datos de ejemplo hasta su sprint.
import { useEffect, useMemo, useState } from 'react';
import {
  EventoTiempoReal,
  type AsignacionDto,
  type FestivoDto,
  type IndicadorTurnoDto,
  type MarcacionDto,
  type MiTurnoDto,
  type TipoTurnoDto,
  type UsuarioResumenDto,
} from '@sgt/shared-types';
import { api } from '../api/cliente';
import { useAccion, useDatos } from '../api/useDatos';
import { useConectado, useTiempoReal } from '../api/tiempoReal';
import { useSesion } from '../sesion';
import { useEstado, useUsuario } from '../estado';
import { persona } from '../datos/mock';
import { diaMes, diaSemana, encabezadoDia, fechaLocal, horaLocal, horas, lunesDe, rangoFechas, sumarDias } from '../datos/fechas';
import { saldoVacaciones } from '../datos/vacaciones';
import { Chip, Dato, Estado, Tarjeta } from '../componentes/Ui';

const hora = (iso: string) => horaLocal(new Date(iso));
const duracionH = (a: AsignacionDto) => (Date.parse(a.fin) - Date.parse(a.inicio)) / 3_600_000;

/** Recarga periódica: los estados del turno cambian con el paso del tiempo aunque nadie marque. */
function useCadaMinuto(fn: () => void) {
  useEffect(() => {
    const t = window.setInterval(fn, 60_000);
    return () => window.clearInterval(t);
  });
}

export function Inicio() {
  const { usuario } = useSesion();
  const yo = usuario!;
  const hoy = fechaLocal(new Date());
  const [lunes, setLunes] = useState(lunesDe(hoy));
  const dias = rangoFechas(lunes, sumarDias(lunes, 6));

  const semana = useDatos<AsignacionDto[]>(`/cuadros/asignaciones?desde=${lunes}&hasta=${sumarDias(lunes, 6)}`);
  const proximas = useDatos<AsignacionDto[]>(`/cuadros/asignaciones?desde=${hoy}&hasta=${sumarDias(hoy, 30)}`);
  const personas = useDatos<UsuarioResumenDto[]>('/usuarios');
  const tipos = useDatos<TipoTurnoDto[]>('/tipos-turno?incluirInactivos=true');
  const festivos = useDatos<FestivoDto[]>('/festivos');

  useTiempoReal([EventoTiempoReal.CUADRO_ACTUALIZADO], () => {
    void semana.recargar();
    void proximas.recargar();
  });

  const tipo = useMemo(() => new Map((tipos.datos ?? []).map((t) => [t.id, t])), [tipos.datos]);
  const nombreFestivo = useMemo(() => new Map((festivos.datos ?? []).map((f) => [f.fecha, f.nombre])), [festivos.datos]);
  const celda = useMemo(() => new Map((semana.datos ?? []).map((a) => [`${a.usuarioId}|${a.fecha}`, a])), [semana.datos]);

  const filas = (personas.datos ?? [])
    .filter((p) => p.activo || semana.datos?.some((a) => a.usuarioId === p.id))
    .sort((a, b) => (a.rol === b.rol ? a.nombres.localeCompare(b.nombres) : a.rol === 'COORDINADOR' ? -1 : 1));

  const mias = (proximas.datos ?? []).filter((a) => a.usuarioId === yo.id && a.estado === 'ACTIVA' && Date.parse(a.inicio) > Date.now());
  const horasSemana = (semana.datos ?? []).filter((a) => a.usuarioId === yo.id && a.estado === 'ACTIVA').reduce((s, a) => s + duracionH(a), 0);

  return (
    <div className="pila">
      <Marcacion />

      <div className="columnas c4">
        <Dato
          etiqueta="Próximo turno"
          valor={mias[0] ? `${mias[0].codigo} · ${diaMes(mias[0].fecha)}` : '—'}
          nota={mias[0] ? `${hora(mias[0].inicio)}–${hora(mias[0].fin)}${mias.length > 1 ? ` · luego ${mias.slice(1, 3).map((a) => `${a.codigo} ${diaMes(a.fecha)}`).join(', ')}` : ''}` : 'Sin turnos publicados'}
        />
        <Dato etiqueta={lunes === lunesDe(hoy) ? 'Horas programadas esta semana' : `Horas programadas semana del ${diaMes(lunes)}`} valor={horas(horasSemana)} nota="Según el cuadro publicado" />
        <ResumenEjemplo />
      </div>

      <div className="columnas principal">
        <Tarjeta
          titulo={`Cuadro de turnos · semana del ${diaMes(lunes)}`}
          acciones={
            <div className="segmentado">
              <button onClick={() => setLunes(sumarDias(lunes, -7))} aria-label="Semana anterior">
                ‹
              </button>
              <button onClick={() => setLunes(lunesDe(hoy))} disabled={lunes === lunesDe(hoy)}>
                Hoy
              </button>
              <button onClick={() => setLunes(sumarDias(lunes, 7))} aria-label="Semana siguiente">
                ›
              </button>
            </div>
          }
        >
          {semana.error && <div className="alerta-caja error">{semana.error}</div>}
          {semana.datos && semana.datos.length === 0 && <div className="alerta-caja info">No hay un cuadro publicado para esta semana.</div>}
          <div className="desplazable">
            <table className="cuadro">
              <thead>
                <tr>
                  <th className="nombre">Persona</th>
                  {dias.map((d) => (
                    <th key={d} className={[d === hoy && 'hoy', nombreFestivo.has(d) && 'festivo', diaSemana(d) === 0 && 'domingo'].filter(Boolean).join(' ')} title={nombreFestivo.get(d)}>
                      {encabezadoDia(d)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filas.map((p) => (
                  <tr key={p.id} className={p.id === yo.id ? 'yo' : ''}>
                    <td className="nombre">{p.nombres}</td>
                    {dias.map((d) => {
                      const a = celda.get(`${p.id}|${d}`);
                      return (
                        <td key={d} className={d === hoy ? 'hoy' : ''}>
                          {a && <Chip codigo={a.codigo} tipo={tipo.get(a.tipoTurnoId)} tachado={a.estado === 'LIBERADA'} />}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="leyenda">
            {(tipos.datos ?? [])
              .filter((t) => t.activo)
              .map((t) => (
                <span key={t.id}>
                  <Chip codigo={t.codigo} tipo={t} /> {t.nombre} {t.horaInicio}–{t.horaFin}
                </span>
              ))}
            <span>
              <Chip codigo="N" tipo={{ nombre: 'Requiere cobertura', color: '#fff', horaInicio: '', horaFin: '' }} tachado /> Requiere cobertura
            </span>
            {yo.rol !== 'COORDINADOR' && <span>· Solo lectura: el cuadro lo modifica el coordinador.</span>}
          </div>
        </Tarjeta>

        <div className="pila">
          <Indicadores nombres={new Map((personas.datos ?? []).map((p) => [p.id, p.nombres]))} tipos={tipo} />
          <Chat />
        </div>
      </div>
    </div>
  );
}

/** Botón de marcación (RF-MAIN-04). La hora la pone el servidor; el reloj se muestra con la hora del servidor. */
function Marcacion() {
  const mi = useDatos<MiTurnoDto>('/marcaciones/mi-turno');
  const accion = useAccion();
  const [registrada, setRegistrada] = useState<MarcacionDto | null>(null);
  const [, setTick] = useState(0);
  const desfase = useMemo(() => (mi.datos ? Date.parse(mi.datos.ahora) - Date.now() : 0), [mi.datos]);

  useTiempoReal([EventoTiempoReal.MARCACION_REGISTRADA, EventoTiempoReal.CUADRO_ACTUALIZADO], () => void mi.recargar());
  useCadaMinuto(() => void mi.recargar());
  useEffect(() => {
    const t = window.setInterval(() => setTick((n) => n + 1), 10_000);
    return () => window.clearInterval(t);
  }, []);

  const marcar = async () => {
    const m = await accion.ejecutar(() => api<MarcacionDto>('POST', '/marcaciones', { equipo: navigator.platform || null }));
    if (m) {
      setRegistrada(m);
      void mi.recargar();
    }
  };

  // La confirmación se queda unos segundos y desaparece.
  useEffect(() => {
    if (!registrada) return;
    const t = window.setTimeout(() => setRegistrada(null), 8_000);
    return () => window.clearTimeout(t);
  }, [registrada]);

  const turno = mi.datos?.turno;
  const salida = mi.datos?.siguiente === 'SALIDA';
  const titulo = salida
    ? turno?.entrada
      ? `En turno desde las ${hora(turno.entrada)}`
      : 'Tienes una entrada sin salida'
    : turno
      ? 'Aún no has marcado tu entrada'
      : 'No tienes un turno programado ahora';

  return (
    <div className="marcacion">
      <div className="espaciador">
        <small>{turno ? `Tu turno: ${turno.codigo} ${hora(turno.inicio)}–${hora(turno.fin)}` : 'Marcación de entrada y salida'}</small>
        <h2>{mi.datos ? titulo : 'Consultando tu turno…'}</h2>
        <small>
          Hora del servidor {horaLocal(new Date(Date.now() + desfase))} · es la que queda registrada, no la de este equipo.
        </small>
        {registrada && !accion.error && (
          <div className="confirmado" role="status">
            ✓ {registrada.tipo === 'ENTRADA' ? 'Entrada' : 'Salida'} registrada a las {hora(registrada.hora)}
            {!registrada.asignacionId && ' (sin turno programado: el coordinador la revisará)'}
          </div>
        )}
        {accion.error && (
          <div className="confirmado error" role="alert">
            {accion.error}
          </div>
        )}
      </div>
      {mi.datos && (
        <button className={turno || salida ? 'grande' : 'grande secundario'} onClick={() => void marcar()} disabled={accion.ocupado}>
          {salida ? 'Marcar salida' : turno ? 'Marcar entrada' : 'Marcar entrada sin turno'}
        </button>
      )}
    </div>
  );
}

function Indicadores({ nombres, tipos }: { nombres: Map<string, string>; tipos: Map<string, TipoTurnoDto> }) {
  const estado = useDatos<IndicadorTurnoDto[]>('/marcaciones/estado-actual');
  const conectado = useConectado();
  useTiempoReal([EventoTiempoReal.MARCACION_REGISTRADA, EventoTiempoReal.CUADRO_ACTUALIZADO], () => void estado.recargar());
  useCadaMinuto(() => void estado.recargar());
  const tipoPorCodigo = (codigo: string) => [...tipos.values()].find((t) => t.codigo === codigo);

  return (
    <Tarjeta
      titulo="Estado del turno actual"
      acciones={
        <span className={`en-vivo ${conectado ? '' : 'sin-conexion'}`} title={conectado ? 'Se actualiza solo' : 'Sin conexión en tiempo real: se actualiza cada minuto'}>
          {conectado ? 'En vivo' : 'Sin conexión'}
        </span>
      }
    >
      {estado.error && <div className="alerta-caja error">{estado.error}</div>}
      {estado.datos?.length === 0 && <p className="vacio">No hay turnos en curso ni por empezar.</p>}
      <ul className="limpia indicadores">
        {(estado.datos ?? []).map((i) => (
          <li key={i.asignacionId}>
            <div>
              {nombres.get(i.usuarioId) ?? 'Persona'}
              <small>
                <Chip codigo={i.codigo} tipo={tipoPorCodigo(i.codigo)} /> {hora(i.inicio)}–{hora(i.fin)}
                {i.entrada && ` · entró ${hora(i.entrada)}`}
                {i.salida && ` · salió ${hora(i.salida)}`}
              </small>
            </div>
            <Estado valor={i.estado} />
          </li>
        ))}
      </ul>
    </Tarjeta>
  );
}

/** Saldo de vacaciones y solicitudes: datos de ejemplo hasta el Sprint 4. */
function ResumenEjemplo() {
  const usuario = useUsuario();
  const { solicitudes } = useEstado();
  if (!usuario) return null;
  const pendientes = solicitudes.filter((s) => s.solicitanteId === usuario.id && s.estado.startsWith('PENDIENTE')).length;
  return (
    <>
      <Dato etiqueta="Saldo de vacaciones" valor={`${saldoVacaciones(usuario, solicitudes).disponibles} días`} nota="Dato de ejemplo" />
      <Dato etiqueta="Mis solicitudes pendientes" valor={pendientes} nota="Dato de ejemplo" />
    </>
  );
}

function Chat() {
  const usuario = useUsuario();
  const { mensajes, enviarMensaje } = useEstado();
  const [texto, setTexto] = useState('');
  const [novedad, setNovedad] = useState(false);
  const [soloNovedades, setSoloNovedades] = useState(false);

  if (!usuario) return null;
  const visibles = soloNovedades ? mensajes.filter((m) => m.esNovedad) : mensajes;

  return (
    <Tarjeta
      titulo={
        <>
          Chat del equipo <span className="pill gris">Ejemplo</span>
        </>
      }
      className="chat"
      acciones={
        <label className="check">
          <input type="checkbox" checked={soloNovedades} onChange={(e) => setSoloNovedades(e.target.checked)} /> Solo novedades
        </label>
      }
    >
      <div className="mensajes">
        {visibles.map((m) => (
          <div key={m.id} className={['mensaje', m.autorId === usuario.id && 'mio', m.esNovedad && 'novedad', !m.autorId && 'sistema'].filter(Boolean).join(' ')}>
            <header>
              <b>{m.autorId ? persona(m.autorId).nombres : 'Sistema'}</b>
              <span>{horaLocal(m.hora)}</span>
              {m.esNovedad && <span className="pill naranja">Novedad</span>}
            </header>
            {m.contenido}
          </div>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!texto.trim()) return;
          enviarMensaje(texto.trim(), novedad);
          setTexto('');
          setNovedad(false);
        }}
      >
        <textarea rows={2} placeholder="Escribe un mensaje para el equipo…" value={texto} onChange={(e) => setTexto(e.target.value)} />
        <div className="fila">
          <label className="check">
            <input type="checkbox" checked={novedad} onChange={(e) => setNovedad(e.target.checked)} /> Marcar como novedad
          </label>
          <span className="espaciador" />
          <button className="primario" type="submit">
            Enviar
          </button>
        </div>
      </form>
    </Tarjeta>
  );
}
