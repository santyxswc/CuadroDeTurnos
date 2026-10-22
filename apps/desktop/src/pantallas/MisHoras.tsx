// Horas y recargos con datos reales: turnos publicados y marcaciones de la API, calculados con el motor de reglas.
// El coordinador puede corregir una marcación (con motivo, queda auditada) y cualquiera exporta el detalle a Excel.
import { useState } from 'react';
import { factores, valorizarRecargos, type HorasClasificadas } from '@sgt/rules-engine';
import { NOMBRE_CARGO, type AsignacionDto, type FestivoDto, type MarcacionDto, type ParametroDto, type TipoTurnoDto, type UsuarioDto } from '@sgt/shared-types';
import { api } from '../api/cliente';
import { useAccion, useDatos } from '../api/useDatos';
import { useSesion } from '../sesion';
import { diaMes, fechaLocal, finDeMes, horaLocal, horas, lunesDe, pesos, sumarDias } from '../datos/fechas';
import { clasificar, filasHoras, parametro, porcentajes, type FilaHoras, type Fuente } from '../datos/liquidacion';
import { descargarCsv } from '../datos/exportar';
import { Chip, Dato, Tarjeta } from '../componentes/Ui';

const CONCEPTOS: Record<keyof HorasClasificadas, string> = {
  nocturnasOrdinarias: 'Recargo nocturno ordinario',
  diurnasDominicales: 'Dominical/festiva diurna',
  nocturnasDominicales: 'Nocturna dominical/festiva',
  extraDiurnas: 'Hora extra diurna',
  extraNocturnas: 'Hora extra nocturna',
  extraDiurnasDominicales: 'Extra diurna dominical/festiva',
  extraNocturnasDominicales: 'Extra nocturna dominical/festiva',
};

const nombreMes = (mes: string) =>
  new Intl.DateTimeFormat('es-CO', { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(new Date(`${mes}-01T00:00:00Z`));

export function MisHoras() {
  const { usuario: yo } = useSesion();
  const esCoordinador = yo!.rol === 'COORDINADOR';
  const [usuarioId, setUsuarioId] = useState(yo!.id);
  const [mes, setMes] = useState(fechaLocal(new Date()).slice(0, 7));
  const [fuente, setFuente] = useState<Fuente>('reales');
  const desde = `${mes}-01`;
  const hasta = finDeMes(desde);
  // Las semanas que cruzan el inicio o el fin del mes se traen completas, para que el exceso semanal (RN-02)
  // no se corte en el límite del mes. Las marcaciones, un día más: la salida de una noche cae al día siguiente.
  const inicioSemanas = lunesDe(desde);
  const finSemanas = sumarDias(lunesDe(hasta), 6);

  // El coordinador puede ver a cualquiera; un enfermero solo a sí mismo (con sus datos de la sesión).
  const equipo = useDatos<UsuarioDto[]>(esCoordinador ? '/usuarios' : null);
  const turnos = useDatos<AsignacionDto[]>(`/cuadros/asignaciones?desde=${inicioSemanas}&hasta=${finSemanas}`);
  const marcaciones = useDatos<MarcacionDto[]>(`/marcaciones?desde=${inicioSemanas}&hasta=${sumarDias(finSemanas, 1)}&usuarioId=${usuarioId}`);
  const parametros = useDatos<ParametroDto[]>(`/parametros?fecha=${desde}`);
  const festivos = useDatos<FestivoDto[]>('/festivos');
  const tipos = useDatos<TipoTurnoDto[]>('/tipos-turno?incluirInactivos=true');

  const p = esCoordinador ? equipo.datos?.find((u) => u.id === usuarioId) : yo!;
  const ps = parametros.datos;
  const error = turnos.error ?? marcaciones.error ?? parametros.error;

  const filas = filasHoras(
    (turnos.datos ?? []).filter((a) => a.usuarioId === usuarioId),
    marcaciones.datos ?? [],
    fuente,
    ps,
    new Set((festivos.datos ?? []).map((f) => f.fecha)),
  ).filter((x) => x.a.fecha >= desde && x.a.fecha <= hasta);
  const suma = (k: 'total' | 'diurnas' | 'nocturnas' | 'dominicalesDiurnas' | 'dominicalesNocturnas' | 'extra') => filas.reduce((s, f) => s + f[k], 0);
  const clasificadas = clasificar(filas);
  const salario = p?.salarios.filter((s) => s.vigenteDesde <= hasta).at(-1)?.salarioBase ?? 0;
  const divisor = parametro(ps, 'jornada.divisor_mensual_h');
  const smmlv = parametro(ps, 'nomina.smmlv');
  const pct = porcentajes(ps);
  const valor = valorizarRecargos(clasificadas, salario, divisor, pct);
  const f = factores(pct);
  const tipo = (id: string) => tipos.datos?.find((t) => t.id === id);
  const marca = (asignacionId: string, t: 'ENTRADA' | 'SALIDA') => (marcaciones.datos ?? []).find((m) => m.asignacionId === asignacionId && m.tipo === t)?.hora;
  const [corrigiendo, setCorrigiendo] = useState<FilaHoras | null>(null);

  const exportar = () =>
    descargarCsv(`horas-${(p?.nombres ?? 'persona').replace(/\s+/g, '-')}-${mes}`, [
      ['Fecha', 'Turno', 'Inicio', 'Fin', 'Entrada marcada', 'Salida marcada', 'Diurnas', 'Nocturnas', 'Dom. diurnas', 'Dom. nocturnas', 'Extra'],
      ...filas.map((x) => {
        const e = marca(x.a.id, 'ENTRADA');
        const s = marca(x.a.id, 'SALIDA');
        return [x.a.fecha, x.a.codigo, horaLocal(x.inicio), horaLocal(x.fin), e && horaLocal(new Date(e)), s && horaLocal(new Date(s)), x.diurnas, x.nocturnas, x.dominicalesDiurnas, x.dominicalesNocturnas, x.extra];
      }),
      ['Total', '', '', '', '', '', suma('diurnas'), suma('nocturnas'), suma('dominicalesDiurnas'), suma('dominicalesNocturnas'), suma('extra')],
    ]);

  return (
    <div className="pila">
      <div className="fila encabezado">
        <div className="espaciador">
          <h2>Horas y recargos · {nombreMes(mes)}</h2>
          <p className="sub">
            Horas diurnas ({parametro(ps, 'jornada.fin_nocturna')}–{parametro(ps, 'jornada.inicio_nocturna')}), nocturnas, dominicales y festivas de los turnos publicados.
          </p>
        </div>
        {esCoordinador && (
          <label>
            Persona
            <select value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)}>
              {(equipo.datos ?? []).map((x) => (
                <option key={x.id} value={x.id}>
                  {x.nombres}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Mes
          <input type="month" value={mes} onChange={(e) => e.target.value && setMes(e.target.value)} />
        </label>
        <label>
          Calcular con
          <select value={fuente} onChange={(e) => setFuente(e.target.value as Fuente)}>
            <option value="programadas">Turnos programados (cuadro)</option>
            <option value="reales">Horas marcadas (oficial para nómina)</option>
          </select>
        </label>
      </div>
      {error && <div className="alerta-caja error">{error}</div>}

      <div className="columnas c4">
        <Dato etiqueta="Total de horas" valor={horas(suma('total'))} nota={fuente === 'reales' ? 'Turnos con entrada y salida marcadas' : 'Según el cuadro publicado'} />
        <Dato etiqueta="Diurnas / nocturnas ordinarias" valor={`${horas(suma('diurnas'))} / ${horas(suma('nocturnas'))}`} />
        <Dato etiqueta="Dominicales y festivas (diurnas / nocturnas)" valor={`${horas(suma('dominicalesDiurnas'))} / ${horas(suma('dominicalesNocturnas'))}`} />
        <Dato etiqueta={`Exceso sobre ${parametro(ps, 'jornada.maxima_semanal_h')} h semanales`} valor={horas(suma('extra'))} nota="Posibles horas extra" />
      </div>

      <div className="columnas horas">
        <Tarjeta titulo="Detalle por turno" acciones={<button onClick={exportar} disabled={!filas.length}>Exportar a Excel</button>}>
          {corrigiendo && (
            <Correccion
              fila={corrigiendo}
              entrada={marca(corrigiendo.a.id, 'ENTRADA')}
              salida={marca(corrigiendo.a.id, 'SALIDA')}
              alTerminar={(ok) => {
                setCorrigiendo(null);
                if (ok) void marcaciones.recargar();
              }}
            />
          )}
          <div className="desplazable alto">
            <table className="nowrap">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Turno</th>
                  <th>Horario</th>
                  <th className="num">Diurnas</th>
                  <th className="num">Nocturnas</th>
                  <th className="num">Dom. diurnas</th>
                  <th className="num">Dom. nocturnas</th>
                  <th className="num">Extra</th>
                  <th>Marcado</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((x) => (
                  <tr key={x.a.id}>
                    <td>{diaMes(x.a.fecha)}</td>
                    <td>
                      <Chip codigo={x.a.codigo} tipo={tipo(x.a.tipoTurnoId)} />
                    </td>
                    <td>
                      {horaLocal(x.inicio)}–{horaLocal(x.fin)}
                    </td>
                    <td className="num">{horas(x.diurnas)}</td>
                    <td className="num">{horas(x.nocturnas)}</td>
                    <td className="num">{horas(x.dominicalesDiurnas)}</td>
                    <td className="num">{horas(x.dominicalesNocturnas)}</td>
                    <td className="num">{x.extra ? horas(x.extra) : ''}</td>
                    <td>
                      <Marcado entrada={marca(x.a.id, 'ENTRADA')} salida={marca(x.a.id, 'SALIDA')} />
                      {esCoordinador && (
                        <button className="enlace" onClick={() => setCorrigiendo(x)}>
                          Corregir
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {filas.length === 0 && (
                  <tr>
                    <td colSpan={9} className="vacio">
                      {fuente === 'reales' ? 'No hay turnos con entrada y salida marcadas en este mes.' : 'No hay turnos publicados en este mes.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Tarjeta>

        <Tarjeta titulo="Valor estimado de recargos">
          {p && (
            <p className="sub">
              {p.nombres} · {NOMBRE_CARGO[p.cargo]} · salario {pesos(salario)} · valor hora {pesos(valor.valorHora)} (salario ÷ {divisor} h)
            </p>
          )}
          {salario > 0 && salario < smmlv && (
            <div className="alerta-caja error confirmacion">El salario registrado es inferior al salario mínimo de referencia ({pesos(smmlv)}).</div>
          )}
          <table>
            <thead>
              <tr>
                <th>Concepto</th>
                <th className="num">Horas</th>
                <th className="num">Factor</th>
                <th className="num">Valor</th>
              </tr>
            </thead>
            <tbody>
              {(Object.keys(CONCEPTOS) as (keyof HorasClasificadas)[]).map((k) => (
                <tr key={k}>
                  <td>{CONCEPTOS[k]}</td>
                  <td className="num">{horas(clasificadas[k])}</td>
                  <td className="num">{f[k].toFixed(2).replace('.', ',')}</td>
                  <td className="num">{pesos(valor.conceptos[k])}</td>
                </tr>
              ))}
              <tr className="total">
                <td>Total estimado</td>
                <td />
                <td />
                <td className="num">{pesos(valor.total)}</td>
              </tr>
            </tbody>
          </table>
          <div className="alerta-caja aviso nota">
            Es un valor estimado de recargos; la liquidación oficial la hace nómina. Recargo dominical vigente: {pct.dominicalPct} %.
          </div>
        </Tarjeta>
      </div>
    </div>
  );
}

function Marcado({ entrada, salida }: { entrada?: string; salida?: string }) {
  if (!entrada && !salida) return <small className="vacio">Sin marcar </small>;
  return <small>{entrada ? horaLocal(new Date(entrada)) : '—'}–{salida ? horaLocal(new Date(salida)) : '—'} </small>;
}

/** El coordinador registra la hora correcta de entrada o salida; el motivo es obligatorio y queda en la auditoría. */
function Correccion({ fila, entrada, salida, alTerminar }: { fila: FilaHoras; entrada?: string; salida?: string; alTerminar: (ok: boolean) => void }) {
  const [tipo, setTipo] = useState<'ENTRADA' | 'SALIDA'>(entrada ? 'SALIDA' : 'ENTRADA');
  const local = (d: Date) => `${fechaLocal(d)}T${horaLocal(d)}`;
  const [hora, setHora] = useState(local(tipo === 'ENTRADA' ? fila.inicio : fila.fin));
  const [motivo, setMotivo] = useState('');
  const accion = useAccion();

  const guardar = async () => {
    const r = await accion.ejecutar(() =>
      api('POST', '/marcaciones/correcciones', { usuarioId: fila.a.usuarioId, asignacionId: fila.a.id, tipo, hora: new Date(`${hora}:00-05:00`).toISOString(), motivo }),
    );
    if (r !== undefined) alTerminar(true);
  };

  return (
    <div className="alerta-caja info pila compacta">
      <b>
        Corregir marcación del turno {fila.a.codigo} del {diaMes(fila.a.fecha)}
      </b>
      <small>
        Marcado ahora: <Marcado entrada={entrada} salida={salida} />
      </small>
      <div className="fila">
        <label>
          Qué corriges
          <select
            value={tipo}
            onChange={(e) => {
              const t = e.target.value as 'ENTRADA' | 'SALIDA';
              setTipo(t);
              setHora(local(t === 'ENTRADA' ? fila.inicio : fila.fin));
            }}
          >
            <option value="ENTRADA">Entrada</option>
            <option value="SALIDA">Salida</option>
          </select>
        </label>
        <label>
          Hora correcta
          <input type="datetime-local" value={hora} onChange={(e) => setHora(e.target.value)} />
        </label>
        <label style={{ flex: 2 }}>
          Motivo
          <input value={motivo} maxLength={300} placeholder="Ej.: olvidó marcar al llegar" onChange={(e) => setMotivo(e.target.value)} />
        </label>
      </div>
      {accion.error && <div className="error-linea">{accion.error}</div>}
      <div className="fila">
        <span className="espaciador" />
        <button onClick={() => alTerminar(false)}>Cancelar</button>
        <button className="primario" disabled={motivo.trim().length < 5 || !hora || accion.ocupado} onClick={() => void guardar()}>
          Guardar corrección
        </button>
      </div>
    </div>
  );
}
