// Horas y recargos con datos reales (Sprint 3): turnos publicados y marcaciones de la API, calculados con el motor de reglas.
import { useState } from 'react';
import { factores, valorizarRecargos, type HorasClasificadas } from '@sgt/rules-engine';
import { NOMBRE_CARGO, type AsignacionDto, type FestivoDto, type MarcacionDto, type ParametroDto, type TipoTurnoDto, type UsuarioDto } from '@sgt/shared-types';
import { useDatos } from '../api/useDatos';
import { useSesion } from '../sesion';
import { diaMes, fechaLocal, finDeMes, horaLocal, horas, pesos } from '../datos/fechas';
import { clasificar, filasHoras, parametro, porcentajes, type Fuente } from '../datos/liquidacion';
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
  const [fuente, setFuente] = useState<Fuente>('programadas');
  const desde = `${mes}-01`;
  const hasta = finDeMes(desde);

  // El coordinador puede ver a cualquiera; un enfermero solo a sí mismo (con sus datos de la sesión).
  const equipo = useDatos<UsuarioDto[]>(esCoordinador ? '/usuarios' : null);
  const turnos = useDatos<AsignacionDto[]>(`/cuadros/asignaciones?desde=${desde}&hasta=${hasta}`);
  const marcaciones = useDatos<MarcacionDto[]>(`/marcaciones?desde=${desde}&hasta=${hasta}&usuarioId=${usuarioId}`);
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
  );
  const suma = (k: 'total' | 'diurnas' | 'nocturnas' | 'dominicalesDiurnas' | 'dominicalesNocturnas' | 'extra') => filas.reduce((s, f) => s + f[k], 0);
  const clasificadas = clasificar(filas);
  const salario = p?.salarios.filter((s) => s.vigenteDesde <= hasta).at(-1)?.salarioBase ?? 0;
  const divisor = parametro(ps, 'jornada.divisor_mensual_h');
  const smmlv = parametro(ps, 'nomina.smmlv');
  const pct = porcentajes(ps);
  const valor = valorizarRecargos(clasificadas, salario, divisor, pct);
  const f = factores(pct);
  const tipo = (id: string) => tipos.datos?.find((t) => t.id === id);

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
        <Tarjeta titulo="Detalle por turno">
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
                  </tr>
                ))}
                {filas.length === 0 && (
                  <tr>
                    <td colSpan={8} className="vacio">
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
