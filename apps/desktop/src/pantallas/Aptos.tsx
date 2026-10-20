// Filtro de aptos con datos reales: turnos publicados, vacaciones/permisos aprobados y los parámetros vigentes.
import { useMemo, useState } from 'react';
import { evaluarAptitud } from '@sgt/rules-engine';
import {
  EventoTiempoReal,
  type AsignacionDto,
  type ParametroDto,
  type SolicitudDto,
  type TipoTurnoDto,
  type UsuarioResumenDto,
} from '@sgt/shared-types';
import { useDatos } from '../api/useDatos';
import { useTiempoReal } from '../api/tiempoReal';
import { useSesion } from '../sesion';
import { bog, diaMes, fechaLocal, horas, sumarDias } from '../datos/fechas';
import { parametro } from '../datos/liquidacion';
import { Chip, Estado, Tarjeta } from '../componentes/Ui';

const GRUPOS = ['APTO', 'APTO_CON_ADVERTENCIA', 'NO_APTO'] as const;

/** Un enfermero ve el motivo con los límites, pero sin las horas de su compañero. */
const sinHoras = (m: string) =>
  m
    .replace(/^Descanso de .+ h (antes|después) del turno < (.+) h mínimo$/, 'Tendría menos de $2 h de descanso $1 del turno')
    .replace(/^Quedaría con .+ h en la semana \(límite (.+) h\)$/, 'Superaría el límite de $1 h en la semana')
    .replace(/^Generaría .+ h de exceso en la semana$/, 'Generaría horas de exceso en la semana')
    .replace(/^Quedaría con .+ h, cerca del máximo de (.+) h$/, 'Quedaría cerca del máximo de $1 h en la semana');

const intervalo = (fecha: string, t: Pick<TipoTurnoDto, 'horaInicio' | 'horaFin'>) => ({
  inicio: bog(`${fecha}T${t.horaInicio}`),
  fin: bog(`${t.horaFin <= t.horaInicio ? sumarDias(fecha, 1) : fecha}T${t.horaFin}`),
});

export function Aptos() {
  const { usuario } = useSesion();
  const esCoordinador = usuario!.rol === 'COORDINADOR';
  const hoy = fechaLocal(new Date());
  const [fecha, setFecha] = useState(hoy);
  const [tipoId, setTipoId] = useState('');

  const tipos = useDatos<TipoTurnoDto[]>('/tipos-turno');
  const personas = useDatos<UsuarioResumenDto[]>('/usuarios');
  const parametros = useDatos<ParametroDto[]>('/parametros');
  const solicitudes = useDatos<SolicitudDto[]>('/solicitudes');
  // Dos semanas antes y después alcanzan para descansos, noches seguidas y horas de la semana.
  const asignaciones = useDatos<AsignacionDto[]>(`/cuadros/asignaciones?desde=${sumarDias(fecha, -14)}&hasta=${sumarDias(fecha, 14)}`);
  const pendientes = useDatos<AsignacionDto[]>(`/cuadros/asignaciones?desde=${hoy}&hasta=${sumarDias(hoy, 31)}`);
  useTiempoReal([EventoTiempoReal.CUADRO_ACTUALIZADO, EventoTiempoReal.SOLICITUD_ACTUALIZADA], () => {
    void asignaciones.recargar();
    void pendientes.recargar();
    void solicitudes.recargar();
  });

  const lista = tipos.datos ?? [];
  const tipo = lista.find((t) => t.id === tipoId) ?? lista[0];
  const liberados = (pendientes.datos ?? []).filter((a) => a.estado === 'LIBERADA' && new Date(a.inicio) > new Date());

  const resultados = useMemo(() => {
    if (!tipo || !personas.datos || !asignaciones.datos) return [];
    const p = parametros.datos;
    const reglas = {
      descansoMinimoH: parametro(p, 'aptitud.descanso_minimo_h'),
      maximaSemanalH: parametro(p, 'jornada.maxima_semanal_h'),
      maxExtraSemanalH: parametro(p, 'extra.max_semanales_h'),
      umbralAlertaPct: parametro(p, 'aptitud.umbral_alerta_pct'),
      maxNochesConsecutivas: parametro(p, 'aptitud.max_noches_consecutivas'),
    };
    const turno = intervalo(fecha, tipo);
    const todas = asignaciones.datos;
    return personas.datos
      .map((persona) => {
        const propias = todas.filter((a) => a.usuarioId === persona.id);
        // Ausencias: las solicitudes aprobadas que se ven y los turnos que se liberaron por permiso o vacaciones.
        const ausencias = [
          ...(solicitudes.datos ?? [])
            .filter((s) => s.solicitanteId === persona.id && s.estado === 'APLICADA' && s.desde && s.hasta)
            .map((s) => ({ inicio: bog(`${s.desde}T00:00`), fin: bog(`${sumarDias(s.hasta!, 1)}T00:00`) })),
          ...propias.filter((a) => a.estado === 'LIBERADA').map((a) => ({ inicio: new Date(a.inicio), fin: new Date(a.fin) })),
        ];
        const activas = propias.filter((a) => a.estado === 'ACTIVA').map((a) => ({ inicio: new Date(a.inicio), fin: new Date(a.fin) }));
        return { persona, r: evaluarAptitud({ activo: true, asignaciones: activas, ausencias }, turno, reglas) };
      })
      // RF-APT-02: menor carga primero.
      .sort((a, b) => a.r.horasSemana - b.r.horasSemana);
  }, [tipo, fecha, personas.datos, asignaciones.datos, solicitudes.datos, parametros.datos]);

  return (
    <div className="pila">
      <div>
        <h2>Filtro de aptos</h2>
        <p className="sub">
          Para un turno dado, clasifica al personal según descanso, horas en la semana, noches seguidas, vacaciones y cruces.
          {!esCoordinador && ' Como enfermero/a ves la clasificación y el motivo, sin las horas de tus compañeros.'}
        </p>
      </div>
      <Tarjeta titulo="Turno a cubrir">
        <div className="fila">
          <label>
            Fecha
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </label>
          <label>
            Turno
            <select value={tipo?.id ?? ''} onChange={(e) => setTipoId(e.target.value)}>
              {lista.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.codigo} · {t.nombre} {t.horaInicio}–{t.horaFin}
                </option>
              ))}
            </select>
          </label>
          <div style={{ flex: 2 }}>
            <small style={{ color: 'var(--suave)' }}>Turnos que requieren cobertura:</small>
            <div className="fila" style={{ marginTop: 4 }}>
              {liberados.slice(0, 6).map((a) => (
                <button key={a.id} onClick={() => { setFecha(a.fecha); setTipoId(a.tipoTurnoId); }}>
                  <Chip codigo={a.codigo} tipo={lista.find((t) => t.id === a.tipoTurnoId)} /> {diaMes(a.fecha)}
                </button>
              ))}
              {liberados.length === 0 && <small>Ninguno por ahora.</small>}
            </div>
          </div>
        </div>
      </Tarjeta>
      <div className="columnas c3">
        {GRUPOS.map((g) => {
          const grupo = resultados.filter((x) => x.r.clasificacion === g);
          return (
            <Tarjeta key={g} titulo={<><Estado valor={g} /> {grupo.length}</>}>
              <ul className="limpia indicadores">
                {grupo.map(({ persona, r }) => (
                  <li key={persona.id}>
                    <div>
                      {persona.nombres}
                      {r.motivos.length > 0 && (
                        <ul className="motivos">
                          {(esCoordinador ? r.motivos : r.motivos.map(sinHoras)).map((m) => <li key={m}>{m}</li>)}
                        </ul>
                      )}
                    </div>
                    {esCoordinador && <small title="Horas programadas en la semana, incluyendo este turno">{horas(r.horasSemana)} h</small>}
                  </li>
                ))}
                {grupo.length === 0 && <li><small>Nadie en este grupo</small></li>}
              </ul>
            </Tarjeta>
          );
        })}
      </div>
    </div>
  );
}
