// Vacaciones con datos reales: saldo según la fecha de ingreso y las vacaciones aprobadas; la solicitud va a la bandeja de Solicitudes.
import { useState } from 'react';
import { EventoTiempoReal, NOMBRE_CARGO, type FestivoDto, type ParametroDto, type SolicitudDto, type UsuarioDto } from '@sgt/shared-types';
import { api } from '../api/cliente';
import { useAccion, useDatos } from '../api/useDatos';
import { useTiempoReal } from '../api/tiempoReal';
import { useSesion } from '../sesion';
import { diaMes, fechaLocal, sumarDias } from '../datos/fechas';
import { parametro } from '../datos/liquidacion';
import { diasHabiles, fechaReintegro, saldoVacaciones } from '../datos/vacaciones';
import { Dato, Estado, Tarjeta } from '../componentes/Ui';

export function Vacaciones() {
  const { usuario } = useSesion();
  const yo = usuario!;
  const esCoordinador = yo.rol === 'COORDINADOR';
  const hoy = fechaLocal(new Date());
  const solicitudes = useDatos<SolicitudDto[]>('/solicitudes');
  const festivosApi = useDatos<FestivoDto[]>('/festivos');
  const parametros = useDatos<ParametroDto[]>('/parametros');
  const equipo = useDatos<UsuarioDto[]>(esCoordinador ? '/usuarios' : null);
  useTiempoReal([EventoTiempoReal.SOLICITUD_ACTUALIZADA], () => void solicitudes.recargar());
  const accion = useAccion();

  const anticipacion = parametro(parametros.datos, 'vacaciones.anticipacion_min_dias');
  const diasPorAnio = parametro(parametros.datos, 'vacaciones.dias_por_anio');
  const [desde, setDesde] = useState(sumarDias(hoy, 30));
  const [hasta, setHasta] = useState(sumarDias(hoy, 44));
  const [enviada, setEnviada] = useState(false);

  const festivos = new Set((festivosApi.datos ?? []).map((f) => f.fecha));
  const lista = solicitudes.datos ?? [];
  const saldo = (p: { id: string; fechaIngreso: string }) => saldoVacaciones(p, lista, festivos, hoy, diasPorAnio);
  const s = saldo(yo);
  const consume = desde <= hasta ? diasHabiles(desde, hasta, festivos) : 0;
  const faltan = Math.round((Date.parse(desde) - Date.parse(hoy)) / 86_400_000);
  const errores = [
    desde > hasta && 'La fecha final es anterior a la inicial.',
    !esCoordinador && faltan < anticipacion && `Se piden con al menos ${anticipacion} días de anticipación.`,
    consume > s.disponibles && `Ese rango usa ${consume} días hábiles y tienes ${s.disponibles} disponibles.`,
    s.puedeSolicitarDesde > hoy && `Podrás pedir vacaciones desde el ${diaMes(s.puedeSolicitarDesde)} de ${s.puedeSolicitarDesde.slice(0, 4)}.`,
  ].filter(Boolean) as string[];
  const mias = lista.filter((x) => x.solicitanteId === yo.id && x.tipo === 'VACACIONES');

  const solicitar = async () => {
    const r = await accion.ejecutar(() => api('POST', '/solicitudes', { tipo: 'VACACIONES', desde, hasta, comentario: `${consume} días hábiles` }));
    if (r) {
      setEnviada(true);
      void solicitudes.recargar();
    }
  };

  return (
    <div className="pila">
      <div>
        <h2>Vacaciones</h2>
        <p className="sub">{diasPorAnio} días hábiles por cada año de servicio. Días hábiles: lunes a sábado, sin festivos.</p>
      </div>
      <div className="columnas c4">
        <Dato etiqueta="Días disponibles" valor={s.disponibles} />
        <Dato etiqueta="Años de servicio" valor={s.aniosServicio} nota={`Ingreso: ${yo.fechaIngreso}`} />
        <Dato etiqueta="Días causados" valor={s.diasCausados} />
        <Dato etiqueta="Días aprobados" valor={s.diasAprobados} nota="Solicitados en la app" />
      </div>

      <div className="columnas c2 arriba">
        <Tarjeta titulo="Simular y pedir">
          <div className="pila">
            <div className="fila">
              <label>
                Desde
                <input type="date" value={desde} min={hoy} onChange={(e) => { setDesde(e.target.value); setEnviada(false); }} />
              </label>
              <label>
                Hasta
                <input type="date" value={hasta} min={desde} onChange={(e) => { setHasta(e.target.value); setEnviada(false); }} />
              </label>
            </div>
            <div className="columnas c2">
              <Dato etiqueta="Días hábiles que usa" valor={consume} />
              <Dato etiqueta="Vuelves a trabajar" valor={desde <= hasta ? diaMes(fechaReintegro(hasta, festivos)) : '—'} />
            </div>
            {errores.map((e) => (
              <div key={e} className="alerta-caja error">
                {e}
              </div>
            ))}
            {accion.error && <div className="alerta-caja error">{accion.error}</div>}
            {enviada && <div className="alerta-caja info">Solicitud enviada. Puedes seguirla en Solicitudes.</div>}
            <button className="primario" disabled={errores.length > 0 || enviada || accion.ocupado} onClick={() => void solicitar()}>
              Pedir vacaciones
            </button>
          </div>
        </Tarjeta>

        <Tarjeta titulo="Mi historial">
          <table>
            <thead>
              <tr>
                <th>Fechas</th>
                <th className="num">Días</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {mias.map((x) => (
                <tr key={x.id}>
                  <td>
                    {diaMes(x.desde!)} al {diaMes(x.hasta!)}
                  </td>
                  <td className="num">{diasHabiles(x.desde!, x.hasta!, festivos)}</td>
                  <td>
                    <Estado valor={x.estado} />
                  </td>
                </tr>
              ))}
              {mias.length === 0 && (
                <tr>
                  <td colSpan={3} className="vacio">
                    Aún no has pedido vacaciones.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Tarjeta>
      </div>

      {esCoordinador && (
        <Tarjeta titulo="Saldos del equipo">
          <table>
            <thead>
              <tr>
                <th>Persona</th>
                <th>Cargo</th>
                <th>Ingreso</th>
                <th className="num">Causados</th>
                <th className="num">Aprobados</th>
                <th className="num">Disponibles</th>
              </tr>
            </thead>
            <tbody>
              {(equipo.datos ?? [])
                .filter((p) => p.activo)
                .map((p) => {
                  const x = saldo(p);
                  return (
                    <tr key={p.id}>
                      <td>{p.nombres}</td>
                      <td>{NOMBRE_CARGO[p.cargo]}</td>
                      <td>{p.fechaIngreso}</td>
                      <td className="num">{x.diasCausados}</td>
                      <td className="num">{x.diasAprobados}</td>
                      <td className="num">
                        <b>{x.disponibles}</b>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </Tarjeta>
      )}
    </div>
  );
}
