// Pacientes atendidos (RF-PAC-01/02): solo la cantidad por turno, sin datos personales de pacientes.
import { useState } from 'react';
import type { AsignacionDto, AtencionDto, TipoTurnoDto, UsuarioResumenDto } from '@sgt/shared-types';
import { api } from '../api/cliente';
import { useAccion, useDatos } from '../api/useDatos';
import { useSesion } from '../sesion';
import { diaMes, fechaLocal, finDeMes, horaLocal, horas } from '../datos/fechas';
import { Chip, Dato, Tarjeta } from '../componentes/Ui';

const EQUIPO = 'equipo';

export function Pacientes() {
  const { usuario: yo } = useSesion();
  const esCoordinador = yo!.rol === 'COORDINADOR';
  const [mes, setMes] = useState(fechaLocal(new Date()).slice(0, 7));
  const [personaId, setPersonaId] = useState(esCoordinador ? EQUIPO : yo!.id);
  const desde = `${mes}-01`;
  const hasta = finDeMes(desde);

  const turnos = useDatos<AsignacionDto[]>(`/cuadros/asignaciones?desde=${desde}&hasta=${hasta}`);
  const atenciones = useDatos<AtencionDto[]>(`/atenciones?desde=${desde}&hasta=${hasta}`);
  const personas = useDatos<UsuarioResumenDto[]>('/usuarios');
  const tipos = useDatos<TipoTurnoDto[]>('/tipos-turno?incluirInactivos=true');

  const cantidad = new Map((atenciones.datos ?? []).map((a) => [a.asignacionId, a.cantidad]));
  const registradas = (atenciones.datos ?? []).filter((a) => personaId === EQUIPO || a.usuarioId === personaId);
  const total = registradas.reduce((s, a) => s + a.cantidad, 0);

  return (
    <div className="pila">
      <div className="fila encabezado">
        <div className="espaciador">
          <h2>Pacientes atendidos</h2>
          <p className="sub">Escribe cuántos pacientes atendiste en cada turno. Solo se guarda el número, nunca datos de los pacientes.</p>
        </div>
        {esCoordinador && (
          <label>
            Ver
            <select value={personaId} onChange={(e) => setPersonaId(e.target.value)}>
              <option value={EQUIPO}>Todo el equipo</option>
              {(personas.datos ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombres}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Mes
          <input type="month" value={mes} onChange={(e) => e.target.value && setMes(e.target.value)} />
        </label>
      </div>
      {(turnos.error ?? atenciones.error) && <div className="alerta-caja error">{turnos.error ?? atenciones.error}</div>}

      <div className="columnas c3">
        <Dato etiqueta="Pacientes atendidos" valor={total} />
        <Dato etiqueta="Turnos registrados" valor={registradas.length} />
        <Dato etiqueta="Promedio por turno" valor={registradas.length ? horas(total / registradas.length) : '—'} />
      </div>

      {personaId === EQUIPO ? (
        <ResumenEquipo personas={personas.datos ?? []} atenciones={atenciones.datos ?? []} />
      ) : (
        <Tarjeta titulo="Turnos del mes">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Turno</th>
                <th>Horario</th>
                <th>Pacientes</th>
              </tr>
            </thead>
            <tbody>
              {(turnos.datos ?? [])
                .filter((a) => a.usuarioId === personaId && a.estado === 'ACTIVA')
                .map((a) => (
                  <tr key={a.id}>
                    <td>{diaMes(a.fecha)}</td>
                    <td>
                      <Chip codigo={a.codigo} tipo={tipos.datos?.find((t) => t.id === a.tipoTurnoId)} />
                    </td>
                    <td>
                      {horaLocal(new Date(a.inicio))}–{horaLocal(new Date(a.fin))}
                    </td>
                    <td>
                      {Date.parse(a.inicio) > Date.now() ? (
                        <span className="vacio">Turno futuro</span>
                      ) : (
                        <CampoCantidad asignacionId={a.id} guardada={cantidad.get(a.id)} alGuardar={() => void atenciones.recargar()} />
                      )}
                    </td>
                  </tr>
                ))}
              {turnos.datos?.every((a) => a.usuarioId !== personaId) && (
                <tr>
                  <td colSpan={4} className="vacio">
                    No hay turnos publicados en este mes.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Tarjeta>
      )}
    </div>
  );
}

function CampoCantidad({ asignacionId, guardada, alGuardar }: { asignacionId: string; guardada?: number; alGuardar: () => void }) {
  const [valor, setValor] = useState(guardada === undefined ? '' : String(guardada));
  const accion = useAccion();
  const cambiado = valor !== '' && Number(valor) !== guardada;

  return (
    <form
      className="fila cantidad"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await accion.ejecutar(() => api('PUT', `/atenciones/${asignacionId}`, { cantidad: Number(valor) }))) alGuardar();
      }}
    >
      <input type="number" min={0} max={200} value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0" />
      {cambiado ? (
        <button className="primario" disabled={accion.ocupado}>
          Guardar
        </button>
      ) : (
        guardada !== undefined && <span className="estado-guardado ok">Guardado</span>
      )}
      {accion.error && <span className="error-linea">{accion.error}</span>}
    </form>
  );
}

function ResumenEquipo({ personas, atenciones }: { personas: UsuarioResumenDto[]; atenciones: AtencionDto[] }) {
  const filas = personas
    .map((p) => {
      const suyas = atenciones.filter((a) => a.usuarioId === p.id);
      const total = suyas.reduce((s, a) => s + a.cantidad, 0);
      return { p, turnos: suyas.length, total };
    })
    .filter((f) => f.turnos > 0 || f.p.activo);

  return (
    <Tarjeta titulo="Resumen por persona">
      <table>
        <thead>
          <tr>
            <th>Persona</th>
            <th className="num">Turnos registrados</th>
            <th className="num">Pacientes</th>
            <th className="num">Promedio por turno</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.p.id}>
              <td>{f.p.nombres}</td>
              <td className="num">{f.turnos}</td>
              <td className="num">{f.total}</td>
              <td className="num">{f.turnos ? horas(f.total / f.turnos) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="nota">Elige una persona arriba para ver o corregir sus turnos.</p>
    </Tarjeta>
  );
}
