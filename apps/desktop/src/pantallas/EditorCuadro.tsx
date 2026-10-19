// Editor de cuadro conectado a la API (Sprint 2): borrador, advertencias, publicar, versiones y tiempo real.
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import {
  EventoTiempoReal,
  type CuadroDto,
  type EventoCuadroDto,
  type FestivoDto,
  type ResumenCuadroDto,
  type TipoTurnoDto,
  type UsuarioDto,
} from '@sgt/shared-types';
import { api } from '../api/cliente';
import { useAccion, useDatos } from '../api/useDatos';
import { useTiempoReal } from '../api/tiempoReal';
import { diaMes, diaSemana, encabezadoDia, fechaHora, fechaLocal, finDeMes, horas, lunesDe, rangoFechas, sumarDias } from '../datos/fechas';
import { Chip, Estado, Tarjeta } from '../componentes/Ui';

/** Pincel que deja el día libre. */
const LIBRE = '';

/** Cambios aún no guardados: `${usuarioId}|${fecha}` → tipo de turno (null = libre). */
type Pendientes = Record<string, string | null>;

const clave = (usuarioId: string, fecha: string) => `${usuarioId}|${fecha}`;
const hoy = () => fechaLocal(new Date());
const periodoTexto = (c: Pick<ResumenCuadroDto, 'periodoInicio' | 'periodoFin'>) =>
  `${diaMes(c.periodoInicio)} – ${diaMes(c.periodoFin)} ${c.periodoFin.slice(0, 4)}`;
const ESTADO_TEXTO = { BORRADOR: 'borrador', PUBLICADO: 'publicado', CERRADO: 'cerrado' } as const;

const MensajeError = ({ texto }: { texto: string | null }) => (texto ? <div className="alerta-caja error">{texto}</div> : null);

export function EditorCuadro() {
  const lista = useDatos<ResumenCuadroDto[]>('/cuadros');
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);

  // Por defecto se abre el borrador en curso o, si no hay, el cuadro vigente.
  useEffect(() => {
    if (seleccionado || !lista.datos?.length) return;
    const h = hoy();
    const c =
      lista.datos.find((x) => x.estado === 'BORRADOR') ?? lista.datos.find((x) => x.periodoInicio <= h && x.periodoFin >= h) ?? lista.datos[0];
    setSeleccionado(c.id);
  }, [lista.datos, seleccionado]);

  useTiempoReal([EventoTiempoReal.CUADRO_ACTUALIZADO], () => void lista.recargar());

  return (
    <div className="pila">
      <div className="fila encabezado">
        <div className="espaciador">
          <h2>Editor de cuadro</h2>
          <p className="sub">Elige un turno en la paleta y haz clic o arrastra sobre las celdas. Las advertencias no bloquean: tú decides.</p>
        </div>
        {!!lista.datos?.length && (
          <label>
            Período
            <select value={seleccionado ?? ''} onChange={(e) => setSeleccionado(e.target.value)}>
              {lista.datos.map((c) => (
                <option key={c.id} value={c.id}>
                  {periodoTexto(c)} · {ESTADO_TEXTO[c.estado]}
                </option>
              ))}
            </select>
          </label>
        )}
        {!creando && <button onClick={() => setCreando(true)}>Nuevo cuadro</button>}
      </div>
      <MensajeError texto={lista.error} />
      {creando && (
        <NuevoCuadro
          ultimo={lista.datos?.[0]}
          alCancelar={() => setCreando(false)}
          alCrear={(c) => {
            setCreando(false);
            setSeleccionado(c.id);
            void lista.recargar();
          }}
        />
      )}
      {seleccionado ? (
        <Grilla
          key={seleccionado}
          id={seleccionado}
          alCambiarLista={() => void lista.recargar()}
          alDescartar={() => {
            setSeleccionado(null);
            void lista.recargar();
          }}
        />
      ) : (
        lista.datos &&
        !creando && (
          <Tarjeta>
            <p className="vacio">Aún no hay cuadros. Crea el primero con «Nuevo cuadro».</p>
          </Tarjeta>
        )
      )}
    </div>
  );
}

function NuevoCuadro({ ultimo, alCrear, alCancelar }: { ultimo?: ResumenCuadroDto; alCrear: (c: CuadroDto) => void; alCancelar: () => void }) {
  // Sugerencia: el día siguiente al último cuadro, o el mes que viene.
  const inicial = ultimo ? sumarDias(ultimo.periodoFin, 1) : sumarDias(finDeMes(hoy()), 1);
  const [desde, setDesde] = useState(inicial);
  const [hasta, setHasta] = useState(finDeMes(inicial));
  const accion = useAccion();

  return (
    <Tarjeta titulo="Nuevo cuadro">
      <form
        className="fila"
        onSubmit={async (e) => {
          e.preventDefault();
          const c = await accion.ejecutar(() => api<CuadroDto>('POST', '/cuadros', { periodoInicio: desde, periodoFin: hasta }));
          if (c) alCrear(c);
        }}
      >
        <label>
          Desde
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} required />
        </label>
        <label>
          Hasta
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} required />
        </label>
        <button type="button" onClick={alCancelar}>
          Cancelar
        </button>
        <button className="primario" disabled={accion.ocupado}>
          Crear borrador
        </button>
      </form>
      <p className="nota">Se crea vacío y en borrador: nadie más lo ve hasta que lo publiques.</p>
      <MensajeError texto={accion.error} />
    </Tarjeta>
  );
}

function Grilla({ id, alCambiarLista, alDescartar }: { id: string; alCambiarLista: () => void; alDescartar: () => void }) {
  const remoto = useDatos<CuadroDto>(`/cuadros/${id}`);
  const usuarios = useDatos<UsuarioDto[]>('/usuarios');
  const tipos = useDatos<TipoTurnoDto[]>('/tipos-turno?incluirInactivos=true');
  const festivos = useDatos<FestivoDto[]>('/festivos');
  const accion = useAccion();

  const [cuadro, setCuadro] = useState<CuadroDto | null>(null);
  const [pendientes, setPendientes] = useState<Pendientes>({});
  const [pincel, setPincel] = useState<string | null>(null);
  const [guardado, setGuardado] = useState<'guardando' | 'guardado' | null>(null);
  const [motivo, setMotivo] = useState('');
  const [confirmar, setConfirmar] = useState<'publicar' | 'descartar' | null>(null);
  const [historial, setHistorial] = useState(false);
  const pintando = useRef(false);
  const pendientesRef = useRef(pendientes);
  pendientesRef.current = pendientes;

  useEffect(() => {
    if (remoto.datos) setCuadro(remoto.datos);
  }, [remoto.datos]);

  const activos = useMemo(() => (tipos.datos ?? []).filter((t) => t.activo), [tipos.datos]);
  useEffect(() => {
    if (pincel === null && activos.length) setPincel(activos[0].id);
  }, [activos, pincel]);

  // Si otro coordinador cambia el cuadro, se recarga (sin pisar lo que estás editando).
  useTiempoReal<EventoCuadroDto>([EventoTiempoReal.CUADRO_ACTUALIZADO], (e) => {
    if ((!e || e.cuadroId === id) && !Object.keys(pendientesRef.current).length) void remoto.recargar();
  });

  const publicado = cuadro?.estado === 'PUBLICADO';
  const editable = !!cuadro && cuadro.estado !== 'CERRADO';

  const guardar = async (motivoTexto?: string) => {
    const enviados = { ...pendientesRef.current };
    const cambios = Object.entries(enviados).map(([k, tipoTurnoId]) => {
      const [usuarioId, fecha] = k.split('|');
      return { usuarioId, fecha, tipoTurnoId };
    });
    if (!cambios.length) return;
    setGuardado('guardando');
    const r = await accion.ejecutar(() => api<CuadroDto>('PUT', `/cuadros/${id}/celdas`, { cambios, motivo: motivoTexto }));
    if (!r) return setGuardado(null);
    setCuadro(r);
    // Solo se quitan los cambios que se enviaron; si seguiste pintando mientras guardaba, esos quedan.
    setPendientes((p) => Object.fromEntries(Object.entries(p).filter(([k, v]) => !(k in enviados) || enviados[k] !== v)));
    setGuardado('guardado');
    if (motivoTexto) {
      setMotivo('');
      alCambiarLista();
    }
  };

  // Al soltar el mouse termina el trazo; en borrador se guarda enseguida.
  useEffect(() => {
    const soltar = () => {
      if (!pintando.current) return;
      pintando.current = false;
      if (!publicado) void guardar();
    };
    window.addEventListener('pointerup', soltar);
    return () => window.removeEventListener('pointerup', soltar);
  });

  // Atajos: la letra del turno elige el pincel; Supr o Retroceso elige «Libre».
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === 'Delete' || e.key === 'Backspace') return setPincel(LIBRE);
      const t = activos.find((x) => x.codigo.toLowerCase() === e.key.toLowerCase());
      if (t) setPincel(t.id);
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [activos]);

  const datos = useMemo(() => {
    if (!cuadro || !usuarios.datos || !tipos.datos) return null;
    const celdas = new Map(cuadro.asignaciones.map((a) => [clave(a.usuarioId, a.fecha), a]));
    const conTurnos = new Set(cuadro.asignaciones.map((a) => a.usuarioId));
    return {
      celdas,
      tipos: new Map(tipos.datos.map((t) => [t.id, t])),
      advertencias: new Map(cuadro.advertencias.map((a) => [a.asignacionId, a])),
      semanas: new Map(cuadro.semanas.map((s) => [clave(s.usuarioId, s.lunes), s])),
      festivos: new Map((festivos.datos ?? []).map((f) => [f.fecha, f.nombre])),
      dias: rangoFechas(cuadro.periodoInicio, cuadro.periodoFin),
      personas: usuarios.datos
        .filter((u) => u.activo || conTurnos.has(u.id))
        .sort((a, b) => (a.rol === b.rol ? a.nombres.localeCompare(b.nombres) : a.rol === 'COORDINADOR' ? -1 : 1)),
    };
  }, [cuadro, usuarios.datos, tipos.datos, festivos.datos]);

  if (!cuadro || !datos) {
    const error = remoto.error ?? usuarios.error ?? tipos.error;
    return error ? <MensajeError texto={error} /> : <Tarjeta><p className="vacio">Cargando cuadro…</p></Tarjeta>;
  }

  /** Tipo de turno que se ve en la celda: el pendiente si lo hay, si no el guardado. */
  const efectivo = (usuarioId: string, fecha: string): string | null => {
    const k = clave(usuarioId, fecha);
    if (k in pendientes) return pendientes[k];
    const a = datos.celdas.get(k);
    return a && a.estado === 'ACTIVA' ? a.tipoTurnoId : null;
  };

  const pintar = (usuarioId: string, fecha: string) => {
    if (!editable || pincel === null) return;
    const k = clave(usuarioId, fecha);
    const a = datos.celdas.get(k);
    const guardadoId = a?.tipoTurnoId ?? null;
    const nuevo = pincel === LIBRE ? null : pincel;
    setPendientes((p) => {
      const n = { ...p };
      if (nuevo === guardadoId) delete n[k];
      else n[k] = nuevo;
      return n;
    });
    setGuardado(null);
  };

  const numPendientes = Object.keys(pendientes).length;
  const numAdvertencias = cuadro.advertencias.length;
  const ejecutar = async (accionApi: () => Promise<CuadroDto>) => {
    const r = await accion.ejecutar(accionApi);
    setConfirmar(null);
    if (r) {
      setCuadro(r);
      alCambiarLista();
    }
  };
  const publicar = () => ejecutar(() => api<CuadroDto>('POST', `/cuadros/${id}/publicar`));
  const cerrar = () => ejecutar(() => api<CuadroDto>('POST', `/cuadros/${id}/cerrar`));
  const descartar = async () => {
    const ok = await accion.ejecutar(async () => {
      await api('DELETE', `/cuadros/${id}`);
      return true;
    });
    setConfirmar(null);
    if (ok) alDescartar();
  };
  const nombre = (usuarioId: string) => usuarios.datos?.find((u) => u.id === usuarioId)?.nombres ?? 'Persona';

  return (
    <>
      <Tarjeta
        titulo={
          <>
            {periodoTexto(cuadro)} <Estado valor={cuadro.estado} />
            {cuadro.versionActual > 0 && <span className="version">versión {cuadro.versionActual}</span>}
          </>
        }
        acciones={
          <>
            {guardado === 'guardando' && <span className="estado-guardado">Guardando…</span>}
            {guardado === 'guardado' && !numPendientes && <span className="estado-guardado ok">Guardado</span>}
            <span className={`pill ${numAdvertencias ? 'rojo' : 'verde'}`}>
              {numAdvertencias ? `${numAdvertencias} ${numAdvertencias === 1 ? 'turno' : 'turnos'} con advertencia` : 'Sin advertencias'}
            </span>
            {cuadro.versiones.length > 0 && (
              <button className={historial ? 'activo' : ''} onClick={() => setHistorial(!historial)}>
                Historial ({cuadro.versiones.length})
              </button>
            )}
            {cuadro.estado === 'BORRADOR' && (
              <>
                <button className="peligro" onClick={() => setConfirmar('descartar')}>
                  Descartar borrador
                </button>
                <button className="primario" disabled={accion.ocupado || numPendientes > 0} onClick={() => (numAdvertencias ? setConfirmar('publicar') : void publicar())}>
                  Publicar cuadro
                </button>
              </>
            )}
            {publicado && cuadro.periodoFin < hoy() && (
              <button onClick={() => void cerrar()} disabled={accion.ocupado}>
                Cerrar período
              </button>
            )}
          </>
        }
      >
        {confirmar === 'publicar' && (
          <div className="alerta-caja aviso fila confirmacion">
            <span className="espaciador">
              Hay {numAdvertencias} {numAdvertencias === 1 ? 'turno' : 'turnos'} con advertencia. ¿Publicar de todas formas? Todo el equipo lo verá al instante.
            </span>
            <button onClick={() => setConfirmar(null)}>Revisar</button>
            <button className="primario" onClick={() => void publicar()}>
              Publicar igual
            </button>
          </div>
        )}
        {confirmar === 'descartar' && (
          <div className="alerta-caja error fila confirmacion">
            <span className="espaciador">Se borrará este borrador con todos sus turnos. No se puede deshacer.</span>
            <button onClick={() => setConfirmar(null)}>Cancelar</button>
            <button className="peligro-solido" onClick={() => void descartar()}>
              Descartar
            </button>
          </div>
        )}
        {cuadro.estado === 'CERRADO' && <div className="alerta-caja info confirmacion">Período cerrado: el cuadro queda como constancia y ya no admite cambios.</div>}
        <MensajeError texto={accion.error} />

        {editable && (
          <div className="paleta" role="toolbar" aria-label="Turno para pintar">
            {activos.map((t) => (
              <button key={t.id} className={pincel === t.id ? 'activo' : ''} onClick={() => setPincel(t.id)} title={`Atajo: ${t.codigo}`}>
                <Chip codigo={t.codigo} tipo={t} />
                <span>
                  {t.nombre}
                  <small>
                    {t.horaInicio}–{t.horaFin}
                  </small>
                </span>
              </button>
            ))}
            <button className={pincel === LIBRE ? 'activo' : ''} onClick={() => setPincel(LIBRE)} title="Atajo: Supr">
              <span className="chip libre">—</span>
              <span>
                Libre<small>borrar turno</small>
              </span>
            </button>
          </div>
        )}

        <div className="desplazable">
          <table className={`cuadro ${editable ? 'editable' : ''}`}>
            <thead>
              <tr>
                <th className="nombre">Persona</th>
                {datos.dias.map((d, i) => (
                  <Fragment key={d}>
                    <th
                      className={[d === hoy() && 'hoy', datos.festivos.has(d) && 'festivo', diaSemana(d) === 0 && 'domingo'].filter(Boolean).join(' ')}
                      title={datos.festivos.get(d)}
                    >
                      {encabezadoDia(d)}
                    </th>
                    {(diaSemana(d) === 0 || i === datos.dias.length - 1) && (
                      <th className="suma" title="Horas programadas en la semana">
                        Σ
                      </th>
                    )}
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {datos.personas.map((p) => (
                <tr key={p.id}>
                  <td className="nombre">
                    {p.nombres}
                    {!p.activo && <small> (inactivo)</small>}
                  </td>
                  {datos.dias.map((d, i) => {
                    const k = clave(p.id, d);
                    const pendiente = k in pendientes;
                    const a = datos.celdas.get(k);
                    const tipoId = efectivo(p.id, d);
                    const tipo = tipoId ? datos.tipos.get(tipoId) : undefined;
                    const alerta = !pendiente && a ? datos.advertencias.get(a.id) : undefined;
                    const semana = datos.semanas.get(clave(p.id, lunesDe(d)));
                    return (
                      <Fragment key={d}>
                        <td
                          className={['celda', alerta && 'alerta', pendiente && 'pendiente', d === hoy() && 'hoy'].filter(Boolean).join(' ')}
                          title={alerta ? alerta.motivos.join('\n') : undefined}
                          onPointerDown={(e) => {
                            if (e.button !== 0) return;
                            e.preventDefault();
                            pintando.current = true;
                            pintar(p.id, d);
                          }}
                          onPointerEnter={() => pintando.current && pintar(p.id, d)}
                        >
                          {tipo ? (
                            <Chip codigo={tipo.codigo} tipo={tipo} />
                          ) : (
                            !pendiente && a?.estado === 'LIBERADA' && <Chip codigo={a.codigo} tipo={datos.tipos.get(a.tipoTurnoId)} tachado />
                          )}
                        </td>
                        {(diaSemana(d) === 0 || i === datos.dias.length - 1) && (
                          <td
                            className={`num suma ${semana && semana.horas > semana.topeH ? 'excede' : semana && semana.horas > semana.maximaH ? 'exceso' : ''}`}
                            title={semana && semana.horas > semana.maximaH ? `${horas(semana.horas - semana.maximaH)} h por encima de ${semana.maximaH} h` : undefined}
                          >
                            {horas(semana?.horas ?? 0)}
                          </td>
                        )}
                      </Fragment>
                    );
                  })}
                </tr>
              ))}
              {activos.map((t) => (
                <tr key={t.id} className="cobertura">
                  <td className="nombre">
                    <small>Cobertura {t.nombre.toLowerCase()}</small>
                  </td>
                  {datos.dias.map((d, i) => {
                    const n = datos.personas.filter((p) => efectivo(p.id, d) === t.id).length;
                    return (
                      <Fragment key={d}>
                        <td className={n === 0 ? 'sin-cobertura' : ''}>{n}</td>
                        {(diaSemana(d) === 0 || i === datos.dias.length - 1) && <td />}
                      </Fragment>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="leyenda">
          <span className="muestra alerta" /> Cruce de turnos, descanso insuficiente o demasiadas noches seguidas (pasa el mouse para ver el motivo)
          <span className="muestra pendiente" /> Sin guardar
          <span>· Σ en amarillo: exceso sobre la jornada semanal · en rojo: supera el tope de horas extra</span>
        </div>
      </Tarjeta>

      {historial && (
        <Tarjeta titulo="Historial de versiones">
          <ol className="limpia versiones">
            {[...cuadro.versiones].reverse().map((v) => (
              <li key={v.numero}>
                <header>
                  <b>Versión {v.numero}</b>
                  <span>
                    {fechaHora(v.creadoEn)} · {v.autorNombre ?? 'Coordinador/a'}
                  </span>
                </header>
                <p>{v.motivo}</p>
                {v.cambios.length > 0 && (
                  <ul className="motivos">
                    {v.cambios.map((c) => (
                      <li key={`${c.usuarioId}${c.fecha}`}>
                        {nombre(c.usuarioId)} · {diaMes(c.fecha)}: {c.antes ?? 'libre'} → {c.despues ?? 'libre'}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        </Tarjeta>
      )}

      {publicado && numPendientes > 0 && (
        <form
          className="barra-cambios"
          onSubmit={(e) => {
            e.preventDefault();
            void guardar(motivo);
          }}
        >
          <b>
            {numPendientes} {numPendientes === 1 ? 'cambio' : 'cambios'} sin guardar
          </b>
          <input placeholder="Motivo del cambio (queda en el historial)" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={300} required />
          <button type="button" onClick={() => setPendientes({})}>
            Descartar
          </button>
          <button className="primario" disabled={accion.ocupado || !motivo.trim()}>
            Guardar versión {cuadro.versionActual + 1}
          </button>
        </form>
      )}
    </>
  );
}
