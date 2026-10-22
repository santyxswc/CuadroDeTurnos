// Administración conectada a la API (Sprint 1): personal, tipos de turno, parámetros, festivos y auditoría.
import { useState } from 'react';
import {
  Cargo,
  NOMBRE_CARGO,
  PARAMETROS_DEFECTO,
  type EventoAuditoriaDto,
  type FestivoDto,
  type ParametroDto,
  type Rol,
  type TipoTurnoDto,
  type UsuarioConPasswordTemporalDto,
  type UsuarioDto,
} from '@sgt/shared-types';
import { api } from '../api/cliente';
import { useAccion, useDatos } from '../api/useDatos';
import { useSesion } from '../sesion';
import { pesos } from '../datos/fechas';
import { Tarjeta } from '../componentes/Ui';

type Pestana = 'usuarios' | 'turnos' | 'parametros' | 'festivos' | 'auditoria';

const PESTANAS: Record<Pestana, string> = {
  usuarios: 'Personal',
  turnos: 'Tipos de turno',
  parametros: 'Parámetros',
  festivos: 'Festivos',
  auditoria: 'Auditoría',
};

export function Administracion() {
  const [pestana, setPestana] = useState<Pestana>('usuarios');
  return (
    <div className="pila">
      <div>
        <h2>Administración</h2>
        <p className="sub">Personal, tipos de turno, parámetros laborales con vigencia, festivos y auditoría. Los cambios se guardan en el servidor.</p>
      </div>
      <div className="pestanas">
        {(Object.keys(PESTANAS) as Pestana[]).map((p) => (
          <button key={p} className={pestana === p ? 'activo' : ''} onClick={() => setPestana(p)}>
            {PESTANAS[p]}
          </button>
        ))}
      </div>
      {pestana === 'usuarios' && <Personal />}
      {pestana === 'turnos' && <TiposTurno />}
      {pestana === 'parametros' && <Parametros />}
      {pestana === 'festivos' && <Festivos />}
      {pestana === 'auditoria' && <Auditoria />}
    </div>
  );
}

const MensajeError = ({ texto }: { texto: string | null }) => (texto ? <div className="alerta-caja error">{texto}</div> : null);

const hoy = () => new Date(Date.now() - 5 * 3_600_000).toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// Personal
// ---------------------------------------------------------------------------

const salarioVigente = (u: UsuarioDto) => u.salarios.filter((s) => s.vigenteDesde <= hoy()).at(-1)?.salarioBase ?? u.salarios[0]?.salarioBase;

function Personal() {
  const { usuario: yo } = useSesion();
  const { datos, error, recargar } = useDatos<UsuarioDto[]>('/usuarios');
  const accion = useAccion();
  const [editando, setEditando] = useState<UsuarioDto | 'nuevo' | null>(null);
  const [salarioDe, setSalarioDe] = useState<UsuarioDto | null>(null);
  const [confirmar, setConfirmar] = useState<{ u: UsuarioDto; que: 'desactivar' | 'restablecer' } | null>(null);
  const [credencial, setCredencial] = useState<UsuarioConPasswordTemporalDto | null>(null);
  const smmlv = PARAMETROS_DEFECTO['nomina.smmlv'];

  const ejecutarConfirmacion = async () => {
    if (!confirmar) return;
    const { u, que } = confirmar;
    const r = await accion.ejecutar(() =>
      que === 'desactivar'
        ? api('POST', `/usuarios/${u.id}/desactivar`)
        : api<UsuarioConPasswordTemporalDto>('POST', `/usuarios/${u.id}/restablecer-password`),
    );
    setConfirmar(null);
    if (r && que === 'restablecer') setCredencial(r as UsuarioConPasswordTemporalDto);
    await recargar();
  };

  return (
    <div className="pila">
      {credencial && (
        <div className="alerta-caja aviso">
          <b>Contraseña temporal de {credencial.usuario.nombres}:</b>{' '}
          <code style={{ fontSize: 16, background: '#fff', padding: '2px 8px', borderRadius: 4 }}>{credencial.passwordTemporal}</code>
          <div>Entrégala a la persona. Se le pedirá cambiarla al entrar. No se volverá a mostrar.</div>
          {credencial.advertencias.map((a) => <div key={a}>⚠ {a}</div>)}
          <button className="enlace" onClick={() => setCredencial(null)}>Entendido</button>
        </div>
      )}
      {confirmar && (
        <div className="alerta-caja aviso fila">
          <span className="espaciador">
            {confirmar.que === 'desactivar'
              ? `¿Desactivar a ${confirmar.u.nombres}? No podrá entrar y se cerrarán sus sesiones. Su historial se conserva.`
              : `¿Restablecer la contraseña de ${confirmar.u.nombres}? Se generará una temporal y se cerrarán sus sesiones.`}
          </span>
          <button onClick={() => setConfirmar(null)}>Cancelar</button>
          <button className="primario" onClick={() => void ejecutarConfirmacion()}>Confirmar</button>
        </div>
      )}
      <MensajeError texto={error ?? accion.error} />
      {editando && (
        <FormUsuario
          usuario={editando === 'nuevo' ? null : editando}
          alTerminar={async (r) => {
            setEditando(null);
            if (r) setCredencial(r);
            await recargar();
          }}
        />
      )}
      {salarioDe && <FormSalario usuario={salarioDe} alTerminar={async () => { setSalarioDe(null); await recargar(); }} />}
      <Tarjeta titulo={`Personal (${datos?.filter((u) => u.activo).length ?? '…'} activos)`} acciones={<button className="primario" onClick={() => setEditando('nuevo')}>+ Nuevo usuario</button>}>
        <div className="desplazable">
          <table>
            <thead>
              <tr><th>Nombre</th><th>Documento</th><th>Correo</th><th>Rol</th><th>Cargo</th><th className="num">Salario vigente</th><th>Ingreso</th><th>Estado</th><th /></tr>
            </thead>
            <tbody>
              {datos?.map((u) => {
                const salario = salarioVigente(u);
                return (
                  <tr key={u.id} style={{ opacity: u.activo ? 1 : 0.55 }}>
                    <td>{u.nombres}{u.id === yo?.id && <small> (tú)</small>}</td>
                    <td>{u.documento}</td>
                    <td>{u.email ?? '—'}</td>
                    <td>{u.rol === 'COORDINADOR' ? 'Coordinador/a' : 'Enfermero/a'}</td>
                    <td>{NOMBRE_CARGO[u.cargo]}</td>
                    <td className="num">
                      {salario !== undefined ? pesos(salario) : '—'}
                      {salario !== undefined && salario < smmlv && <div><span className="pill rojo">Menor al mínimo</span></div>}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>{u.fechaIngreso}</td>
                    <td>
                      {u.activo ? <span className="pill verde">Activo</span> : <span className="pill gris">Inactivo</span>}
                      {u.debeCambiarPassword && <div><span className="pill amarillo">Contraseña temporal</span></div>}
                    </td>
                    <td>
                      <div className="fila" style={{ gap: 8, flexWrap: 'nowrap' }}>
                        <button className="enlace" onClick={() => setEditando(u)}>Editar</button>
                        <button className="enlace" onClick={() => setSalarioDe(u)}>Salario</button>
                        <button className="enlace" onClick={() => setConfirmar({ u, que: 'restablecer' })}>Contraseña</button>
                        {u.activo ? (
                          u.id !== yo?.id && <button className="enlace" style={{ color: 'var(--rojo)' }} onClick={() => setConfirmar({ u, que: 'desactivar' })}>Desactivar</button>
                        ) : (
                          <button className="enlace" onClick={() => void accion.ejecutar(() => api('POST', `/usuarios/${u.id}/activar`)).then(recargar)}>Activar</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="sub" style={{ marginTop: 10 }}>Los usuarios nunca se borran: se desactivan para conservar el historial (RF-AUT-03).</p>
      </Tarjeta>
    </div>
  );
}

function FormUsuario({ usuario, alTerminar }: { usuario: UsuarioDto | null; alTerminar: (r?: UsuarioConPasswordTemporalDto) => void }) {
  const accion = useAccion();
  const [f, setF] = useState({
    documento: usuario?.documento ?? '',
    nombres: usuario?.nombres ?? '',
    email: usuario?.email ?? '',
    rol: (usuario?.rol ?? 'ENFERMERO') as Rol,
    cargo: (usuario?.cargo ?? 'AUXILIAR') as Cargo,
    fechaIngreso: usuario?.fechaIngreso ?? hoy(),
    salarioBase: '',
  });
  const campo = (k: keyof typeof f) => ({ value: f[k], onChange: (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value }) });

  const guardar = async () => {
    if (usuario) {
      const r = await accion.ejecutar(() =>
        api('PATCH', `/usuarios/${usuario.id}`, { nombres: f.nombres, email: f.email || null, rol: f.rol, cargo: f.cargo, fechaIngreso: f.fechaIngreso }),
      );
      if (r) alTerminar();
    } else {
      const r = await accion.ejecutar(() =>
        api<UsuarioConPasswordTemporalDto>('POST', '/usuarios', { ...f, email: f.email || null, salarioBase: Number(f.salarioBase) }),
      );
      if (r) alTerminar(r);
    }
  };

  return (
    <Tarjeta titulo={usuario ? `Editar a ${usuario.nombres}` : 'Nuevo usuario'}>
      <div className="pila">
        <div className="fila">
          <label>Documento<input {...campo('documento')} disabled={!!usuario} /></label>
          <label style={{ flex: 2 }}>Nombres y apellidos<input {...campo('nombres')} /></label>
          <label style={{ flex: 2 }}>Correo (opcional)<input type="email" {...campo('email')} /></label>
        </div>
        <div className="fila">
          <label>
            Rol en la app
            <select {...campo('rol')}>
              <option value="ENFERMERO">Enfermero/a</option>
              <option value="COORDINADOR">Coordinador/a</option>
            </select>
          </label>
          <label>
            Cargo
            <select {...campo('cargo')}>
              {Object.values(Cargo).map((c) => <option key={c} value={c}>{NOMBRE_CARGO[c]}</option>)}
            </select>
          </label>
          <label>Fecha de ingreso<input type="date" {...campo('fechaIngreso')} /></label>
          {!usuario && <label>Salario base (COP)<input type="number" min={0} step={1000} {...campo('salarioBase')} /></label>}
        </div>
        {usuario && <small style={{ color: 'var(--suave)' }}>El salario se cambia con "Salario" para conservar el historial.</small>}
        <MensajeError texto={accion.error} />
        <div className="fila">
          <span className="espaciador" />
          <button onClick={() => alTerminar()}>Cancelar</button>
          <button className="primario" disabled={accion.ocupado || !f.documento || !f.nombres || (!usuario && !f.salarioBase)} onClick={() => void guardar()}>
            {usuario ? 'Guardar cambios' : 'Crear usuario'}
          </button>
        </div>
      </div>
    </Tarjeta>
  );
}

function FormSalario({ usuario, alTerminar }: { usuario: UsuarioDto; alTerminar: () => void }) {
  const accion = useAccion();
  const [salario, setSalario] = useState('');
  const [desde, setDesde] = useState(hoy());
  const [advertencias, setAdvertencias] = useState<string[]>([]);
  return (
    <Tarjeta titulo={`Salario de ${usuario.nombres}`}>
      <div className="columnas c2">
        <table>
          <thead><tr><th>Vigente desde</th><th className="num">Salario base</th></tr></thead>
          <tbody>{usuario.salarios.map((s) => <tr key={s.vigenteDesde}><td>{s.vigenteDesde}</td><td className="num">{pesos(s.salarioBase)}</td></tr>)}</tbody>
        </table>
        <div className="pila">
          <div className="fila">
            <label>Nuevo salario (COP)<input type="number" min={0} step={1000} value={salario} onChange={(e) => setSalario(e.target.value)} /></label>
            <label>Vigente desde<input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></label>
          </div>
          <MensajeError texto={accion.error} />
          {advertencias.map((a) => <div key={a} className="alerta-caja aviso">{a}</div>)}
          <div className="fila">
            <span className="espaciador" />
            <button onClick={alTerminar}>Cerrar</button>
            <button
              className="primario"
              disabled={!salario || accion.ocupado}
              onClick={async () => {
                const r = await accion.ejecutar(() => api<{ advertencias: string[] }>('POST', `/usuarios/${usuario.id}/salarios`, { salarioBase: Number(salario), vigenteDesde: desde }));
                if (r?.advertencias.length) setAdvertencias(r.advertencias);
                else if (r) alTerminar();
              }}
            >
              Registrar salario
            </button>
          </div>
        </div>
      </div>
    </Tarjeta>
  );
}

// ---------------------------------------------------------------------------
// Tipos de turno
// ---------------------------------------------------------------------------

function duracion(t: { horaInicio: string; horaFin: string }) {
  const m = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3));
  return ((m(t.horaFin) - m(t.horaInicio) + 1440) % 1440) / 60;
}

function TiposTurno() {
  const { datos, error, recargar } = useDatos<TipoTurnoDto[]>('/tipos-turno?incluirInactivos=true');
  const accion = useAccion();
  const vacio = { codigo: '', nombre: '', horaInicio: '07:00', horaFin: '13:00', color: '#0f7c80' };
  const [form, setForm] = useState<typeof vacio & { id?: string }>(vacio);

  const guardar = async () => {
    const { id, ...cuerpo } = form;
    const r = await accion.ejecutar(() => (id ? api('PATCH', `/tipos-turno/${id}`, cuerpo) : api('POST', '/tipos-turno', cuerpo)));
    if (r) {
      setForm(vacio);
      await recargar();
    }
  };

  return (
    <div className="columnas" style={{ gridTemplateColumns: '2fr 1fr', alignItems: 'start' }}>
      <Tarjeta titulo="Tipos de turno">
        <MensajeError texto={error} />
        <table>
          <thead><tr><th>Código</th><th>Nombre</th><th>Inicio</th><th>Fin</th><th className="num">Duración</th><th>Estado</th><th /></tr></thead>
          <tbody>
            {datos?.map((t) => (
              <tr key={t.id} style={{ opacity: t.activo ? 1 : 0.55 }}>
                <td><span className="chip" style={{ background: t.color }}>{t.codigo}</span></td>
                <td>{t.nombre}</td>
                <td>{t.horaInicio}</td>
                <td>{t.horaFin}{t.horaFin <= t.horaInicio && <small> (+1 día)</small>}</td>
                <td className="num">{duracion(t)} h</td>
                <td>{t.activo ? <span className="pill verde">Activo</span> : <span className="pill gris">Inactivo</span>}</td>
                <td>
                  <div className="fila" style={{ gap: 8, flexWrap: 'nowrap' }}>
                    <button className="enlace" onClick={() => setForm({ id: t.id, codigo: t.codigo, nombre: t.nombre, horaInicio: t.horaInicio, horaFin: t.horaFin, color: t.color })}>Editar</button>
                    <button className="enlace" onClick={() => void accion.ejecutar(() => api('POST', `/tipos-turno/${t.id}/${t.activo ? 'desactivar' : 'activar'}`)).then(recargar)}>
                      {t.activo ? 'Desactivar' : 'Activar'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="sub" style={{ marginTop: 10 }}>Si la hora de fin es menor que la de inicio, el turno termina al día siguiente. Los tipos no se borran porque el cuadro histórico los usa.</p>
      </Tarjeta>
      <Tarjeta titulo={form.id ? `Editar turno ${form.codigo}` : 'Nuevo tipo de turno'}>
        <div className="pila">
          <div className="fila">
            <label style={{ maxWidth: 90 }}>Código<input maxLength={3} value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value.toUpperCase() })} /></label>
            <label>Nombre<input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></label>
          </div>
          <div className="fila">
            <label>Inicio<input type="time" value={form.horaInicio} onChange={(e) => setForm({ ...form, horaInicio: e.target.value })} /></label>
            <label>Fin<input type="time" value={form.horaFin} onChange={(e) => setForm({ ...form, horaFin: e.target.value })} /></label>
            <label style={{ maxWidth: 70 }}>Color<input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} style={{ padding: 2, height: 36 }} /></label>
          </div>
          <small style={{ color: 'var(--suave)' }}>Duración: {duracion(form)} h</small>
          <MensajeError texto={accion.error} />
          <div className="fila">
            <span className="espaciador" />
            {form.id && <button onClick={() => setForm(vacio)}>Cancelar</button>}
            <button className="primario" disabled={!form.codigo || !form.nombre || accion.ocupado} onClick={() => void guardar()}>
              {form.id ? 'Guardar' : 'Crear'}
            </button>
          </div>
        </div>
      </Tarjeta>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Parámetros
// ---------------------------------------------------------------------------

const DESCRIPCION: Partial<Record<keyof typeof PARAMETROS_DEFECTO, string>> = {
  'jornada.inicio_nocturna': 'Inicio de la jornada nocturna',
  'jornada.fin_nocturna': 'Fin de la jornada nocturna',
  'jornada.maxima_semanal_h': 'Jornada máxima semanal (h)',
  'jornada.divisor_mensual_h': 'Horas mensuales para el valor hora',
  'extra.max_diarias_h': 'Máximo de horas extra al día',
  'extra.max_semanales_h': 'Máximo de horas extra a la semana',
  'aptitud.umbral_alerta_pct': 'Alerta de carga (% de la jornada)',
  'aptitud.descanso_minimo_h': 'Descanso mínimo entre turnos (h)',
  'aptitud.max_noches_consecutivas': 'Máximo de noches seguidas',
  'aptitud.max_horas_continuas': 'Máximo de horas continuas',
  'aptitud.dias_descanso_semana': 'Días de descanso por semana',
  'asistencia.tolerancia_retraso_min': 'Tolerancia de retraso (min)',
  'asistencia.minutos_ausente': 'Minutos para marcar ausente',
  'asistencia.ventana_asociacion_h': 'Ventana para asociar marcaciones (h)',
  'asistencia.alerta_salida_min': 'Alerta de salida pendiente (min)',
  'vacaciones.dias_por_anio': 'Días de vacaciones por año',
  'vacaciones.anticipacion_min_dias': 'Anticipación mínima para vacaciones (días)',
  'vacaciones.permitir_anticipadas': 'Permitir vacaciones anticipadas',
  'seguridad.inactividad_min': 'Cierre de sesión por inactividad (min)',
  'chat.minutos_edicion': 'Minutos para editar un mensaje',
  'recargo.nocturno_pct': 'Recargo nocturno (%)',
  'recargo.extra_diurna_pct': 'Recargo hora extra diurna (%)',
  'recargo.extra_nocturna_pct': 'Recargo hora extra nocturna (%)',
  'recargo.dominical_pct': 'Recargo dominical y festivo (%)',
  'nomina.smmlv': 'Salario mínimo de referencia (COP)',
};

const mostrarValor = (v: ParametroDto['valor']) => (typeof v === 'boolean' ? (v ? 'Sí' : 'No') : String(v));

function Parametros() {
  const [fecha, setFecha] = useState(hoy());
  const vigentes = useDatos<ParametroDto[]>(`/parametros?fecha=${fecha}`);
  const historial = useDatos<ParametroDto[]>('/parametros/historial');
  const accion = useAccion();
  const [clave, setClave] = useState<string | null>(null);
  const [valor, setValor] = useState('');
  const [desde, setDesde] = useState(hoy());

  const defecto = clave ? PARAMETROS_DEFECTO[clave as keyof typeof PARAMETROS_DEFECTO] : null;
  const guardar = async () => {
    if (!clave) return;
    const convertido = typeof defecto === 'number' ? (valor.trim() ? Number(valor) : NaN) : typeof defecto === 'boolean' ? valor === 'true' : valor;
    const r = await accion.ejecutar(() => api('POST', '/parametros', { clave, valor: convertido, vigenteDesde: desde }));
    if (r) {
      setClave(null);
      await Promise.all([vigentes.recargar(), historial.recargar()]);
    }
  };

  return (
    <div className="columnas" style={{ gridTemplateColumns: '3fr 2fr', alignItems: 'start' }}>
      <Tarjeta titulo="Valores vigentes" acciones={<label className="check">en la fecha <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={{ width: 'auto' }} /></label>}>
        <MensajeError texto={vigentes.error} />
        <table>
          <thead><tr><th>Parámetro</th><th>Valor</th><th>Vigencia</th><th /></tr></thead>
          <tbody>
            {vigentes.datos?.map((p) => (
              <tr key={p.clave}>
                <td>{DESCRIPCION[p.clave as keyof typeof PARAMETROS_DEFECTO] ?? p.clave}<div><small style={{ color: 'var(--suave)' }}><code>{p.clave}</code></small></div></td>
                <td><b>{mostrarValor(p.valor)}</b></td>
                <td style={{ whiteSpace: 'nowrap' }}><small>{p.vigenteDesde} → {p.vigenteHasta ?? 'sin fin'}</small></td>
                <td><button className="enlace" onClick={() => { setClave(p.clave); setValor(String(p.valor)); setDesde(hoy()); accion.limpiar(); }}>Cambiar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Tarjeta>
      <div className="pila">
        {clave && (
          <Tarjeta titulo="Nueva vigencia">
            <div className="pila">
              <b>{DESCRIPCION[clave as keyof typeof PARAMETROS_DEFECTO] ?? clave}</b>
              <div className="fila">
                <label>
                  Valor
                  {typeof defecto === 'boolean' ? (
                    <select value={valor} onChange={(e) => setValor(e.target.value)}><option value="true">Sí</option><option value="false">No</option></select>
                  ) : (
                    <input type={typeof defecto === 'number' ? 'number' : 'text'} value={valor} onChange={(e) => setValor(e.target.value)} />
                  )}
                </label>
                <label>Vigente desde<input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></label>
              </div>
              <small style={{ color: 'var(--suave)' }}>El valor anterior se conserva: los cálculos de fechas pasadas siguen usando el que regía en ese momento.</small>
              <MensajeError texto={accion.error} />
              <div className="fila">
                <span className="espaciador" />
                <button onClick={() => setClave(null)}>Cancelar</button>
                <button className="primario" disabled={accion.ocupado || valor === ''} onClick={() => void guardar()}>Guardar</button>
              </div>
            </div>
          </Tarjeta>
        )}
        <Tarjeta titulo="Cambios programados y anteriores">
          <table className="nowrap">
            <thead><tr><th>Parámetro</th><th>Valor</th><th>Desde</th><th>Hasta</th></tr></thead>
            <tbody>
              {historial.datos
                ?.filter((p) => historial.datos!.filter((x) => x.clave === p.clave).length > 1)
                .map((p) => (
                  <tr key={`${p.clave}@${p.vigenteDesde}`}>
                    <td><small>{DESCRIPCION[p.clave as keyof typeof PARAMETROS_DEFECTO] ?? p.clave}</small></td>
                    <td>{mostrarValor(p.valor)}</td>
                    <td>{p.vigenteDesde}</td>
                    <td>{p.vigenteHasta ?? '—'}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </Tarjeta>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Festivos
// ---------------------------------------------------------------------------

function Festivos() {
  const [anio, setAnio] = useState(new Date().getFullYear());
  const { datos, error, recargar } = useDatos<FestivoDto[]>(`/festivos?anio=${anio}`);
  const accion = useAccion();
  const [fecha, setFecha] = useState('');
  const [nombre, setNombre] = useState('');

  return (
    <div className="columnas" style={{ gridTemplateColumns: '2fr 1fr', alignItems: 'start' }}>
      <Tarjeta
        titulo={`Festivos ${anio}`}
        acciones={
          <>
            <button onClick={() => setAnio(anio - 1)}>‹ {anio - 1}</button>
            <button onClick={() => setAnio(anio + 1)}>{anio + 1} ›</button>
            <button onClick={() => void accion.ejecutar(() => api('POST', '/festivos/precargar', { anio })).then(recargar)}>Cargar festivos oficiales de {anio}</button>
          </>
        }
      >
        <MensajeError texto={error ?? accion.error} />
        <table>
          <thead><tr><th>Fecha</th><th>Festivo</th><th /></tr></thead>
          <tbody>
            {datos?.map((f) => (
              <tr key={f.fecha}>
                <td>{new Date(`${f.fecha}T12:00:00Z`).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'long', timeZone: 'UTC' })}</td>
                <td>{f.nombre}</td>
                <td><button className="enlace" style={{ color: 'var(--rojo)' }} onClick={() => void accion.ejecutar(() => api('DELETE', `/festivos/${f.fecha}`)).then(recargar)}>Quitar</button></td>
              </tr>
            ))}
            {datos?.length === 0 && <tr><td colSpan={3}>No hay festivos cargados para {anio}.</td></tr>}
          </tbody>
        </table>
      </Tarjeta>
      <Tarjeta titulo="Agregar festivo">
        <div className="pila">
          <label>Fecha<input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></label>
          <label>Nombre<input value={nombre} onChange={(e) => setNombre(e.target.value)} /></label>
          <button
            className="primario"
            disabled={!fecha || !nombre || accion.ocupado}
            onClick={async () => {
              const r = await accion.ejecutar(() => api('POST', '/festivos', { fecha, nombre }));
              if (r) {
                setFecha('');
                setNombre('');
                if (fecha.startsWith(String(anio))) await recargar();
                else setAnio(Number(fecha.slice(0, 4)));
              }
            }}
          >
            Agregar
          </button>
        </div>
      </Tarjeta>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Auditoría
// ---------------------------------------------------------------------------

const ACCIONES: Record<string, string> = {
  LOGIN: 'Inició sesión',
  LOGIN_FALLIDO: 'Intento de inicio de sesión fallido',
  LOGOUT: 'Cerró sesión',
  PASSWORD_CAMBIADA: 'Cambió su contraseña',
  PASSWORD_RESTABLECIDA: 'Restableció una contraseña',
  USUARIO_CREADO: 'Creó un usuario',
  USUARIO_EDITADO: 'Editó un usuario',
  USUARIO_ACTIVADO: 'Activó un usuario',
  USUARIO_DESACTIVADO: 'Desactivó un usuario',
  SALARIO_REGISTRADO: 'Registró un salario',
  TIPO_TURNO_CREADO: 'Creó un tipo de turno',
  TIPO_TURNO_EDITADO: 'Editó un tipo de turno',
  TIPO_TURNO_ACTIVADO: 'Activó un tipo de turno',
  TIPO_TURNO_DESACTIVADO: 'Desactivó un tipo de turno',
  PARAMETRO_CREADO: 'Cambió un parámetro',
  FESTIVO_CREADO: 'Agregó un festivo',
  FESTIVO_ELIMINADO: 'Quitó un festivo',
  FESTIVOS_PRECARGADOS: 'Cargó festivos oficiales',
};

function Auditoria() {
  const { datos, error, recargar } = useDatos<EventoAuditoriaDto[]>('/auditoria?limite=200');
  return (
    <Tarjeta titulo="Últimas 200 acciones" acciones={<button onClick={() => void recargar()}>Actualizar</button>}>
      <MensajeError texto={error} />
      <div className="desplazable">
        <table>
          <thead><tr><th>Fecha y hora</th><th>Quién</th><th>Acción</th><th>Detalle</th></tr></thead>
          <tbody>
            {datos?.map((e, i) => (
              <tr key={i}>
                <td style={{ whiteSpace: 'nowrap' }}>{new Date(e.fecha).toLocaleString('es-CO', { timeZone: 'America/Bogota' })}</td>
                <td>{e.actorNombre ?? '—'}</td>
                <td>{ACCIONES[e.accion] ?? e.accion}</td>
                <td><small style={{ color: 'var(--suave)' }}>{e.despues ? JSON.stringify(e.despues).slice(0, 120) : e.entidadId ?? ''}</small></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Tarjeta>
  );
}
