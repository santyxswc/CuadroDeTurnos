// Pruebas de punta a punta del Sprint 2 y 3: cuadro de turnos, tiempo real y marcaciones.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import type { INestApplication } from '@nestjs/common';
import type {
  AsignacionDto,
  CuadroDto,
  EventoCuadroDto,
  EventoAuditoriaDto,
  IndicadorTurnoDto,
  MarcacionDto,
  MiTurnoDto,
  RespuestaLoginDto,
  ResumenCuadroDto,
  TipoTurnoDto,
  UsuarioConPasswordTemporalDto,
  UsuarioDto,
} from '@sgt/shared-types';
import { io, type Socket } from 'socket.io-client';
import { crearApp } from './app';
import { hoyBogota, lunesDe, sumarDias } from './comun/fechas';
import type { ConfigSgt } from './config';

let app: INestApplication;
let url: string;
let base: string;
let dir: string;

async function llamar<T = unknown>(metodo: string, ruta: string, opciones: { token?: string; cuerpo?: unknown } = {}) {
  const r = await fetch(`${base}${ruta}`, {
    method: metodo,
    headers: {
      'content-type': 'application/json',
      ...(opciones.token && { authorization: `Bearer ${opciones.token}` }),
    },
    body: opciones.cuerpo === undefined ? undefined : JSON.stringify(opciones.cuerpo),
  });
  const texto = await r.text();
  return { estado: r.status, cuerpo: (texto ? JSON.parse(texto) : undefined) as T };
}

const login = (usuario: string, password: string) => llamar<RespuestaLoginDto>('POST', '/auth/login', { cuerpo: { usuario, password } });

/** "HH:mm" local de Bogotá. */
const horaLocal = (d: Date) => new Date(d.getTime() - 5 * 3_600_000).toISOString().slice(11, 16);

describe('API SGT · cuadro de turnos, tiempo real y marcaciones', () => {
  let coord: string;
  let ana: { usuario: UsuarioDto; token: string };
  let beto: { usuario: UsuarioDto; token: string };
  let tipos: TipoTurnoDto[];
  let cuadro: CuadroDto;
  const hoy = hoyBogota();
  // Miércoles de la próxima semana: siempre dentro del período de prueba y con el jueves en la misma semana.
  const d = sumarDias(lunesDe(hoy), 9);
  const tipo = (codigo: string) => tipos.find((t) => t.codigo === codigo)!;

  async function crearEnfermero(documento: string, nombres: string) {
    const r = await llamar<UsuarioConPasswordTemporalDto>('POST', '/usuarios', {
      token: coord,
      cuerpo: { documento, nombres, rol: 'ENFERMERO', cargo: 'PROFESIONAL', fechaIngreso: '2023-01-02', salarioBase: 2_500_000 },
    });
    const l = await login(documento, r.cuerpo.passwordTemporal);
    await llamar('POST', '/auth/cambiar-password', { token: l.cuerpo.tokenAcceso, cuerpo: { actual: r.cuerpo.passwordTemporal, nueva: 'Enfermera2026' } });
    return { usuario: r.cuerpo.usuario, token: l.cuerpo.tokenAcceso };
  }

  before(async () => {
    dir = await mkdtemp(join(tmpdir(), 'sgt-cuadros-'));
    const config: ConfigSgt = {
      directorioDatos: dir,
      secretoJwt: 'secreto-de-pruebas',
      minutosTokenAcceso: 10,
      horasMaximasSesion: 12,
      documentoAdmin: 'admin',
      passwordAdmin: 'Temporal123',
    };
    app = await crearApp(config, { logs: false });
    await app.listen(0);
    url = (await app.getUrl()).replace('[::1]', 'localhost');
    base = `${url}/api`;

    const l = await login('admin', 'Temporal123');
    await llamar('POST', '/auth/cambiar-password', { token: l.cuerpo.tokenAcceso, cuerpo: { actual: 'Temporal123', nueva: 'Coordina2026' } });
    coord = l.cuerpo.tokenAcceso;
    ana = await crearEnfermero('1001', 'Ana Prueba');
    beto = await crearEnfermero('1002', 'Beto Prueba');
    tipos = (await llamar<TipoTurnoDto[]>('GET', '/tipos-turno', { token: coord })).cuerpo;
  });

  after(async () => {
    await app.close();
    await rm(dir, { recursive: true, force: true });
  });

  describe('cuadro de turnos (RF-CUA-02 a 06)', () => {
    it('el coordinador crea un borrador y no se permiten períodos que se crucen', async () => {
      const r = await llamar<CuadroDto>('POST', '/cuadros', { token: coord, cuerpo: { periodoInicio: sumarDias(hoy, -3), periodoFin: sumarDias(hoy, 10) } });
      assert.equal(r.estado, 201);
      assert.equal(r.cuerpo.estado, 'BORRADOR');
      assert.equal(r.cuerpo.versionActual, 0);
      cuadro = r.cuerpo;

      const cruce = await llamar('POST', '/cuadros', { token: coord, cuerpo: { periodoInicio: sumarDias(hoy, 5), periodoFin: sumarDias(hoy, 20) } });
      assert.equal(cruce.estado, 409);
      const largo = await llamar('POST', '/cuadros', { token: coord, cuerpo: { periodoInicio: sumarDias(hoy, 30), periodoFin: sumarDias(hoy, 120) } });
      assert.equal(largo.estado, 400);
    });

    it('los enfermeros no ven borradores ni pueden crear cuadros', async () => {
      assert.deepEqual((await llamar<ResumenCuadroDto[]>('GET', '/cuadros', { token: ana.token })).cuerpo, []);
      assert.equal((await llamar('GET', `/cuadros/${cuadro.id}`, { token: ana.token })).estado, 404);
      assert.equal((await llamar('POST', '/cuadros', { token: ana.token, cuerpo: { periodoInicio: '2030-01-01', periodoFin: '2030-01-31' } })).estado, 403);
    });

    it('asigna turnos y advierte descanso insuficiente sin bloquear (RF-CUA-03)', async () => {
      const r = await llamar<CuadroDto>('PUT', `/cuadros/${cuadro.id}/celdas`, {
        token: coord,
        cuerpo: {
          cambios: [
            { usuarioId: ana.usuario.id, fecha: d, tipoTurnoId: tipo('N').id },
            { usuarioId: ana.usuario.id, fecha: sumarDias(d, 1), tipoTurnoId: tipo('M').id },
            { usuarioId: beto.usuario.id, fecha: d, tipoTurnoId: tipo('D').id },
          ],
        },
      });
      assert.equal(r.estado, 200);
      assert.equal(r.cuerpo.asignaciones.length, 3);
      const manana = r.cuerpo.asignaciones.find((a) => a.codigo === 'M')!;
      const advertencia = r.cuerpo.advertencias.find((a) => a.asignacionId === manana.id);
      assert.equal(advertencia?.clasificacion, 'NO_APTO');
      assert.match(advertencia!.motivos.join(' '), /Descanso de 0 h/);
      // La noche termina al día siguiente a las 07:00 (hora de Bogotá).
      const noche = r.cuerpo.asignaciones.find((a) => a.codigo === 'N')!;
      assert.equal(noche.fin, new Date(`${sumarDias(d, 1)}T07:00:00-05:00`).toISOString());
      assert.ok(r.cuerpo.semanas.some((s) => s.usuarioId === ana.usuario.id && s.horas === 18 && s.maximaH === 42));
    });

    it('cambiar una celda reemplaza el turno y vaciarla lo quita; valida fechas del período', async () => {
      const r = await llamar<CuadroDto>('PUT', `/cuadros/${cuadro.id}/celdas`, {
        token: coord,
        cuerpo: { cambios: [{ usuarioId: ana.usuario.id, fecha: sumarDias(d, 1), tipoTurnoId: null }] },
      });
      assert.equal(r.cuerpo.asignaciones.length, 2);
      assert.equal(r.cuerpo.advertencias.length, 0);

      const fuera = await llamar('PUT', `/cuadros/${cuadro.id}/celdas`, {
        token: coord,
        cuerpo: { cambios: [{ usuarioId: ana.usuario.id, fecha: sumarDias(hoy, 40), tipoTurnoId: tipo('M').id }] },
      });
      assert.equal(fuera.estado, 400);
    });

    it('publica: queda en versión 1 y todo el equipo lo ve (RF-CUA-04)', async () => {
      const r = await llamar<CuadroDto>('POST', `/cuadros/${cuadro.id}/publicar`, { token: coord });
      assert.equal(r.estado, 200);
      assert.equal(r.cuerpo.estado, 'PUBLICADO');
      assert.equal(r.cuerpo.versionActual, 1);
      assert.equal((await llamar('POST', `/cuadros/${cuadro.id}/publicar`, { token: coord })).estado, 400);

      const vista = await llamar<CuadroDto>('GET', `/cuadros/${cuadro.id}`, { token: ana.token });
      assert.equal(vista.estado, 200);
      assert.deepEqual(vista.cuerpo.advertencias, []);
      const semana = await llamar<AsignacionDto[]>('GET', `/cuadros/asignaciones?desde=${d}&hasta=${sumarDias(d, 1)}`, { token: ana.token });
      assert.equal(semana.cuerpo.length, 2);
    });

    it('un cambio sobre el cuadro publicado exige motivo y crea una nueva versión (RF-CUA-05)', async () => {
      const cambio = { usuarioId: beto.usuario.id, fecha: d, tipoTurnoId: tipo('T').id };
      const sinMotivo = await llamar('PUT', `/cuadros/${cuadro.id}/celdas`, { token: coord, cuerpo: { cambios: [cambio] } });
      assert.equal(sinMotivo.estado, 400);

      const r = await llamar<CuadroDto>('PUT', `/cuadros/${cuadro.id}/celdas`, { token: coord, cuerpo: { cambios: [cambio], motivo: 'Beto pidió la tarde' } });
      assert.equal(r.cuerpo.versionActual, 2);
      const v = r.cuerpo.versiones.at(-1)!;
      assert.equal(v.motivo, 'Beto pidió la tarde');
      assert.equal(v.autorNombre, 'Coordinador/a');
      assert.deepEqual(v.cambios, [{ usuarioId: beto.usuario.id, fecha: d, antes: 'D', despues: 'T' }]);
      // El turno anterior no se borra pero ya no aparece como vigente.
      assert.deepEqual(r.cuerpo.asignaciones.filter((a) => a.usuarioId === beto.usuario.id).map((a) => a.codigo), ['T']);

      const auditoria = await llamar<EventoAuditoriaDto[]>('GET', '/auditoria', { token: coord });
      assert.ok(auditoria.cuerpo.some((e) => e.accion === 'CUADRO_MODIFICADO'));
      assert.ok(auditoria.cuerpo.some((e) => e.accion === 'CUADRO_PUBLICADO'));
    });

    it('no se cierra antes de que termine el período ni se descarta lo publicado', async () => {
      assert.equal((await llamar('POST', `/cuadros/${cuadro.id}/cerrar`, { token: coord })).estado, 400);
      assert.equal((await llamar('DELETE', `/cuadros/${cuadro.id}`, { token: coord })).estado, 400);
      assert.equal((await llamar('PUT', `/cuadros/${cuadro.id}/celdas`, { token: ana.token, cuerpo: { cambios: [] } })).estado, 403);
    });

    it('un borrador sí se puede descartar', async () => {
      const r = await llamar<CuadroDto>('POST', '/cuadros', { token: coord, cuerpo: { periodoInicio: sumarDias(hoy, 40), periodoFin: sumarDias(hoy, 50) } });
      assert.equal((await llamar('DELETE', `/cuadros/${r.cuerpo.id}`, { token: coord })).estado, 204);
      assert.equal((await llamar('GET', `/cuadros/${r.cuerpo.id}`, { token: coord })).estado, 404);
    });
  });

  describe('tiempo real (RF-MAIN-05)', () => {
    const conectar = (token?: string) =>
      new Promise<Socket>((resolve, reject) => {
        const s = io(url, { auth: token ? { token } : {}, transports: ['websocket'], reconnection: false });
        s.on('connect', () => setTimeout(() => (s.connected ? resolve(s) : reject(new Error('desconectado'))), 100));
        s.on('disconnect', () => reject(new Error('desconectado')));
        s.on('connect_error', reject);
      });

    it('rechaza conexiones sin token válido', async () => {
      await assert.rejects(conectar());
      await assert.rejects(conectar('token-falso'));
    });

    it('avisa al equipo cuando cambia el cuadro publicado', async () => {
      const s = await conectar(ana.token);
      try {
        const evento = new Promise<EventoCuadroDto>((resolve) => s.once('cuadro.actualizado', resolve));
        await llamar('PUT', `/cuadros/${cuadro.id}/celdas`, {
          token: coord,
          cuerpo: { cambios: [{ usuarioId: ana.usuario.id, fecha: sumarDias(hoy, 8), tipoTurnoId: tipo('M').id }], motivo: 'Refuerzo' },
        });
        const e = await evento;
        assert.equal(e.cuadroId, cuadro.id);
        assert.equal(e.versionActual, 3);
      } finally {
        s.disconnect();
      }
    });
  });

  describe('marcaciones (RF-ASI-01 a 04, RF-MAIN-02/04)', () => {
    let turnoBeto: AsignacionDto;

    before(async () => {
      // Turno de prueba que empezó hace 30 minutos y dura 4 horas.
      const inicio = new Date(Date.now() - 30 * 60_000);
      const fin = new Date(inicio.getTime() + 4 * 3_600_000);
      const t = await llamar<TipoTurnoDto>('POST', '/tipos-turno', {
        token: coord,
        cuerpo: { codigo: 'Z9', nombre: 'Prueba', horaInicio: horaLocal(inicio), horaFin: horaLocal(fin), color: '#123456' },
      });
      const r = await llamar<CuadroDto>('PUT', `/cuadros/${cuadro.id}/celdas`, {
        token: coord,
        cuerpo: { cambios: [{ usuarioId: beto.usuario.id, fecha: hoyBogota(inicio), tipoTurnoId: t.cuerpo.id }], motivo: 'Turno de prueba' },
      });
      turnoBeto = r.cuerpo.asignaciones.find((a) => a.codigo === 'Z9')!;
    });

    it('antes de marcar, el turno aparece como retrasado y el botón ofrece la entrada', async () => {
      const r = await llamar<MiTurnoDto>('GET', '/marcaciones/mi-turno', { token: beto.token });
      assert.equal(r.cuerpo.siguiente, 'ENTRADA');
      assert.equal(r.cuerpo.turno?.asignacionId, turnoBeto.id);
      assert.equal(r.cuerpo.turno?.estado, 'RETRASADO');
    });

    it('la entrada usa la hora del servidor, se asocia al turno y no se duplica', async () => {
      const antes = Date.now();
      const r = await llamar<MarcacionDto>('POST', '/marcaciones', { token: beto.token, cuerpo: { equipo: 'Estación 2' } });
      assert.equal(r.estado, 201);
      assert.equal(r.cuerpo.tipo, 'ENTRADA');
      assert.equal(r.cuerpo.asignacionId, turnoBeto.id);
      assert.ok(Date.parse(r.cuerpo.hora) >= antes - 1000);
      assert.equal((await llamar('POST', '/marcaciones', { token: beto.token, cuerpo: {} })).estado, 409);

      const estado = await llamar<IndicadorTurnoDto[]>('GET', '/marcaciones/estado-actual', { token: ana.token });
      assert.equal(estado.cuerpo.find((i) => i.asignacionId === turnoBeto.id)?.estado, 'EN_TURNO');
      assert.equal((await llamar<MiTurnoDto>('GET', '/marcaciones/mi-turno', { token: beto.token })).cuerpo.siguiente, 'SALIDA');
    });

    it('sin turno cercano la marcación queda "sin turno" para revisión', async () => {
      const r = await llamar<MarcacionDto>('POST', '/marcaciones', { token: ana.token, cuerpo: {} });
      assert.equal(r.cuerpo.tipo, 'ENTRADA');
      assert.equal(r.cuerpo.asignacionId, null);
    });

    it('el coordinador corrige con motivo y queda auditado; un enfermero no puede', async () => {
      const cuerpo = { usuarioId: beto.usuario.id, asignacionId: turnoBeto.id, tipo: 'SALIDA', hora: new Date().toISOString(), motivo: 'Olvidó marcar la salida' };
      assert.equal((await llamar('POST', '/marcaciones/correcciones', { token: beto.token, cuerpo })).estado, 403);
      assert.equal((await llamar('POST', '/marcaciones/correcciones', { token: coord, cuerpo: { ...cuerpo, motivo: '' } })).estado, 400);

      const r = await llamar<MarcacionDto>('POST', '/marcaciones/correcciones', { token: coord, cuerpo });
      assert.equal(r.estado, 201);
      assert.equal(r.cuerpo.corregida, true);
      const estado = await llamar<IndicadorTurnoDto[]>('GET', '/marcaciones/estado-actual', { token: coord });
      assert.equal(estado.cuerpo.find((i) => i.asignacionId === turnoBeto.id)?.estado, 'FINALIZADO');
      const auditoria = await llamar<EventoAuditoriaDto[]>('GET', '/auditoria', { token: coord });
      assert.ok(auditoria.cuerpo.some((e) => e.accion === 'MARCACION_CREADA_POR_COORDINADOR'));
    });

    it('cada enfermero solo consulta sus propias marcaciones', async () => {
      const r = await llamar<MarcacionDto[]>('GET', `/marcaciones?desde=${sumarDias(hoy, -1)}&hasta=${sumarDias(hoy, 1)}&usuarioId=${beto.usuario.id}`, { token: ana.token });
      assert.ok(r.cuerpo.length >= 1);
      assert.ok(r.cuerpo.every((m) => m.usuarioId === ana.usuario.id));
    });
  });
});
