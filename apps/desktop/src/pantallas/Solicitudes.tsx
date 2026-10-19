// Solicitudes conectadas a la API (Sprint 4): intercambio, cesión, permiso y vacaciones.
import { useState } from 'react';
import {
  EventoTiempoReal,
  type AsignacionDto,
  type CategoriaPermiso,
  type NuevaSolicitudDto,
  type SolicitudDto,
  type TipoSolicitud,
  type TipoTurnoDto,
  type UsuarioResumenDto,
} from '@sgt/shared-types';
import { api } from '../api/cliente';
import { useAccion, useDatos } from '../api/useDatos';
import { useTiempoReal } from '../api/tiempoReal';
import { useSesion } from '../sesion';
import { CATEGORIAS_PERMISO } from '../datos/mock';
import { diaMes, fechaHora, fechaLocal, horaLocal, sumarDias } from '../datos/fechas';
import { Chip, Estado, Tarjeta } from '../componentes/Ui';

const TIPOS: Record<TipoSolicitud, string> = {
  CESION: 'Cesión de turno',
  INTERCAMBIO: 'Intercambio de turno',
  PERMISO: 'Permiso',
  VACACIONES: 'Vacaciones',
};

/** Catálogos que usan la bandeja y el formulario. */
function useCatalogos() {
  const personas = useDatos<UsuarioResumenDto[]>('/usuarios');
  const tipos = useDatos<TipoTurnoDto[]>('/tipos-turno?incluirInactivos=true');
  return {
    personas: personas.datos ?? [],
    nombre: (id: string | null) => personas.datos?.find((p) => p.id === id)?.nombres ?? '—',
    tipo: (id: string) => tipos.datos?.find((t) => t.id === id),
  };
}

export function Solicitudes() {
  const [pestana, setPestana] = useState<'bandeja' | 'nueva'>('bandeja');
  const solicitudes = useDatos<SolicitudDto[]>('/solicitudes');
  const catalogos = useCatalogos();
  useTiempoReal([EventoTiempoReal.SOLICITUD_ACTUALIZADA], () => void solicitudes.recargar());

  return (
    <div className="pila">
      <div>
        <h2>Solicitudes</h2>
        <p className="sub">En cesiones e intercambios el compañero acepta primero y después decide el coordinador. Al aprobar, el cuadro se actualiza solo.</p>
      </div>
      <div className="pestanas">
        <button className={pestana === 'bandeja' ? 'activo' : ''} onClick={() => setPestana('bandeja')}>
          Bandeja
        </button>
        <button className={pestana === 'nueva' ? 'activo' : ''} onClick={() => setPestana('nueva')}>
          Nueva solicitud
        </button>
      </div>
      {solicitudes.error && <div className="alerta-caja error">{solicitudes.error}</div>}
      {pestana === 'bandeja' ? (
        <Bandeja lista={solicitudes.datos ?? []} catalogos={catalogos} alCambiar={() => void solicitudes.recargar()} />
      ) : (
        <Nueva
          catalogos={catalogos}
          alTerminar={() => {
            setPestana('bandeja');
            void solicitudes.recargar();
          }}
        />
      )}
    </div>
  );
}

type Catalogos = ReturnType<typeof useCatalogos>;

function Turno({ a, catalogos }: { a: AsignacionDto; catalogos: Catalogos }) {
  return (
    <>
      <Chip codigo={a.codigo} tipo={catalogos.tipo(a.tipoTurnoId)} /> {diaMes(a.fecha)}
    </>
  );
}

function Detalle({ s, catalogos }: { s: SolicitudDto; catalogos: Catalogos }) {
  if (s.asignacion) {
    return (
      <>
        <Turno a={s.asignacion} catalogos={catalogos} /> → {catalogos.nombre(s.companeroId)}
        {s.asignacionDestino && (
          <>
            {' '}
            · a cambio de <Turno a={s.asignacionDestino} catalogos={catalogos} />
          </>
        )}
      </>
    );
  }
  const rango = s.desde === s.hasta ? diaMes(s.desde!) : `${diaMes(s.desde!)} al ${diaMes(s.hasta!)}`;
  return <>{`${rango}${s.categoria ? ` · ${CATEGORIAS_PERMISO[s.categoria]}` : ''}`}</>;
}

function Bandeja({ lista, catalogos, alCambiar }: { lista: SolicitudDto[]; catalogos: Catalogos; alCambiar: () => void }) {
  const { usuario } = useSesion();
  const yo = usuario!;
  const esCoordinador = yo.rol === 'COORDINADOR';
  const [soloPendientes, setSoloPendientes] = useState(true);
  const [comentarios, setComentarios] = useState<Record<string, string>>({});
  const accion = useAccion();

  const enviar = async (ruta: string, cuerpo?: unknown) => {
    if (await accion.ejecutar(() => api('POST', ruta, cuerpo))) alCambiar();
  };
  const visibles = lista.filter((s) => !soloPendientes || s.estado.startsWith('PENDIENTE'));

  return (
    <Tarjeta
      titulo={esCoordinador ? 'Solicitudes del equipo' : 'Mis solicitudes'}
      acciones={
        <label className="check">
          <input type="checkbox" checked={soloPendientes} onChange={(e) => setSoloPendientes(e.target.checked)} /> Solo pendientes
        </label>
      }
    >
      {accion.error && <div className="alerta-caja error confirmacion">{accion.error}</div>}
      <table>
        <thead>
          <tr>
            <th>Creada</th>
            <th>Tipo</th>
            <th>Solicitante</th>
            <th>Detalle</th>
            <th>Estado</th>
            <th>Acción</th>
          </tr>
        </thead>
        <tbody>
          {visibles.map((s) => {
            const puedeResolver = esCoordinador && s.estado === 'PENDIENTE_COORDINADOR';
            const puedeResponder = s.estado === 'PENDIENTE_COMPANERO' && s.companeroId === yo.id;
            const puedeCancelar = s.solicitanteId === yo.id && s.estado.startsWith('PENDIENTE');
            return (
              <tr key={s.id}>
                <td>{fechaHora(s.creadaEn)}</td>
                <td>{TIPOS[s.tipo]}</td>
                <td>{catalogos.nombre(s.solicitanteId)}</td>
                <td>
                  <Detalle s={s} catalogos={catalogos} />
                  {s.comentario && (
                    <div>
                      <small>{s.comentario}</small>
                    </div>
                  )}
                  {s.respuesta && (
                    <div>
                      <small>
                        <b>Respuesta:</b> {s.respuesta}
                      </small>
                    </div>
                  )}
                </td>
                <td>
                  <Estado valor={s.estado} />
                  {s.autoaprobada && (
                    <div>
                      <small>Del coordinador: no requiere aprobación</small>
                    </div>
                  )}
                </td>
                <td>
                  {puedeResolver && (
                    <div className="pila compacta">
                      <input placeholder="Comentario (opcional)" value={comentarios[s.id] ?? ''} onChange={(e) => setComentarios({ ...comentarios, [s.id]: e.target.value })} />
                      <div className="fila">
                        <button className="primario" disabled={accion.ocupado} onClick={() => void enviar(`/solicitudes/${s.id}/resolver`, { aprueba: true, respuesta: comentarios[s.id] })}>
                          Aprobar
                        </button>
                        <button className="peligro" disabled={accion.ocupado} onClick={() => void enviar(`/solicitudes/${s.id}/resolver`, { aprueba: false, respuesta: comentarios[s.id] })}>
                          Rechazar
                        </button>
                      </div>
                    </div>
                  )}
                  {puedeResponder && (
                    <div className="fila">
                      <button className="primario" disabled={accion.ocupado} onClick={() => void enviar(`/solicitudes/${s.id}/responder`, { acepta: true })}>
                        Aceptar
                      </button>
                      <button className="peligro" disabled={accion.ocupado} onClick={() => void enviar(`/solicitudes/${s.id}/responder`, { acepta: false })}>
                        No acepto
                      </button>
                    </div>
                  )}
                  {puedeCancelar && (
                    <button disabled={accion.ocupado} onClick={() => void enviar(`/solicitudes/${s.id}/cancelar`)}>
                      Cancelar
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
          {visibles.length === 0 && (
            <tr>
              <td colSpan={6} className="vacio">
                {soloPendientes ? 'No hay solicitudes pendientes.' : 'No hay solicitudes.'}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </Tarjeta>
  );
}

function Nueva({ catalogos, alTerminar }: { catalogos: Catalogos; alTerminar: () => void }) {
  const { usuario } = useSesion();
  const yo = usuario!;
  const hoy = fechaLocal(new Date());
  const turnos = useDatos<AsignacionDto[]>(`/cuadros/asignaciones?desde=${hoy}&hasta=${sumarDias(hoy, 61)}`);
  const accion = useAccion();
  const [tipo, setTipo] = useState<TipoSolicitud>('CESION');
  const [asignacionId, setAsignacionId] = useState('');
  const [companeroId, setCompaneroId] = useState('');
  const [destinoId, setDestinoId] = useState('');
  const [categoria, setCategoria] = useState<CategoriaPermiso>('PERSONAL');
  const [desde, setDesde] = useState(sumarDias(hoy, 2));
  const [hasta, setHasta] = useState(sumarDias(hoy, 2));
  const [comentario, setComentario] = useState('');

  const futuros = (turnos.datos ?? []).filter((a) => a.estado === 'ACTIVA' && Date.parse(a.inicio) > Date.now());
  const mios = futuros.filter((a) => a.usuarioId === yo.id);
  const delCompanero = futuros.filter((a) => a.usuarioId === companeroId);
  const conCompanero = tipo === 'INTERCAMBIO' || tipo === 'CESION';
  const listo = conCompanero ? !!asignacionId && !!companeroId && (tipo === 'CESION' || !!destinoId) : desde <= hasta;
  const textoTurno = (a: AsignacionDto) => `${a.codigo} · ${diaMes(a.fecha)} ${horaLocal(new Date(a.inicio))}–${horaLocal(new Date(a.fin))}`;

  const enviar = async () => {
    const cuerpo: NuevaSolicitudDto = conCompanero
      ? { tipo, companeroId, asignacionId, asignacionDestinoId: destinoId || undefined, comentario }
      : { tipo, desde, hasta, categoria: tipo === 'PERMISO' ? categoria : undefined, comentario };
    if (await accion.ejecutar(() => api('POST', '/solicitudes', cuerpo))) alTerminar();
  };

  return (
    <Tarjeta titulo="Nueva solicitud">
      <div className="pila">
        <label>
          ¿Qué necesitas?
          <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoSolicitud)}>
            <option value="CESION">Que un compañero tome mi turno (cesión)</option>
            <option value="INTERCAMBIO">Cambiar turnos con un compañero (intercambio)</option>
            <option value="PERMISO">Un permiso</option>
            <option value="VACACIONES">Vacaciones</option>
          </select>
        </label>

        {conCompanero ? (
          <div className="fila">
            <label>
              Mi turno
              <select value={asignacionId} onChange={(e) => setAsignacionId(e.target.value)}>
                <option value="">Selecciona…</option>
                {mios.map((a) => (
                  <option key={a.id} value={a.id}>
                    {textoTurno(a)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Compañero
              <select
                value={companeroId}
                onChange={(e) => {
                  setCompaneroId(e.target.value);
                  setDestinoId('');
                }}
              >
                <option value="">Selecciona…</option>
                {catalogos.personas
                  .filter((p) => p.activo && p.id !== yo.id)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombres}
                    </option>
                  ))}
              </select>
            </label>
            {tipo === 'INTERCAMBIO' && (
              <label>
                Turno del compañero que tomo a cambio
                <select value={destinoId} onChange={(e) => setDestinoId(e.target.value)} disabled={!companeroId}>
                  <option value="">Selecciona…</option>
                  {delCompanero.map((a) => (
                    <option key={a.id} value={a.id}>
                      {textoTurno(a)}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        ) : (
          <div className="fila">
            {tipo === 'PERMISO' && (
              <label>
                Motivo
                <select value={categoria} onChange={(e) => setCategoria(e.target.value as CategoriaPermiso)}>
                  {Object.entries(CATEGORIAS_PERMISO).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              Desde
              <input type="date" value={desde} min={hoy} onChange={(e) => setDesde(e.target.value)} />
            </label>
            <label>
              Hasta
              <input type="date" value={hasta} min={desde} onChange={(e) => setHasta(e.target.value)} />
            </label>
          </div>
        )}
        {conCompanero && mios.length === 0 && turnos.datos && <div className="alerta-caja info">No tienes turnos publicados próximos para ceder o intercambiar.</div>}
        <label>
          Comentario (opcional; no escribas diagnósticos)
          <input value={comentario} onChange={(e) => setComentario(e.target.value)} maxLength={300} />
        </label>
        {yo.rol === 'COORDINADOR' && !conCompanero && (
          <div className="alerta-caja aviso">Como coordinador/a, tu permiso o vacaciones no requieren aprobación: quedan aplicados y registrados.</div>
        )}
        {accion.error && <div className="alerta-caja error">{accion.error}</div>}
        <div className="fila">
          <span className="espaciador" />
          <button className="primario" disabled={!listo || accion.ocupado} onClick={() => void enviar()}>
            Enviar solicitud
          </button>
        </div>
      </div>
    </Tarjeta>
  );
}
