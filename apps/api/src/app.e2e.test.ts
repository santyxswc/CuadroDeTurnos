// Pruebas de punta a punta: la API real, por HTTP, con una carpeta de datos temporal.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import type { INestApplication } from '@nestjs/common';
import { festivosColombia } from '@sgt/rules-engine';
import type { RespuestaLoginDto, UsuarioConPasswordTemporalDto, UsuarioDto } from '@sgt/shared-types';
import { crearApp } from './app';
import type { ConfigSgt } from './config';

let app: INestApplication;
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

describe('API SGT · Sprint 1', () => {
  let coord: string; // token del coordinador ya con contraseña definitiva
  let enfermero: UsuarioDto;
  let tokenEnfermero: string;

  before(async () => {
    dir = await mkdtemp(join(tmpdir(), 'sgt-api-'));
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
    base = `${await app.getUrl()}/api`.replace('[::1]', 'localhost');
  });

  after(async () => {
    await app.close();
    await rm(dir, { recursive: true, force: true });
  });

  describe('semilla inicial', () => {
    it('crea el primer coordinador, tipos de turno, parámetros y festivos en archivos JSON', async () => {
      const usuarios = JSON.parse(await readFile(join(dir, 'usuarios.json'), 'utf8'));
      assert.equal(usuarios.length, 1);
      assert.equal(usuarios[0].rol, 'COORDINADOR');
      assert.match(usuarios[0].hashPassword, /^\$argon2id\$/);
      assert.equal(JSON.parse(await readFile(join(dir, 'tipos-turno.json'), 'utf8')).length, 4);
      assert.ok(JSON.parse(await readFile(join(dir, 'festivos.json'), 'utf8')).length >= 34);
    });

    it('la salud es pública', async () => {
      assert.equal((await llamar('GET', '/salud')).estado, 200);
    });
  });

  describe('autenticación', () => {
    it('rechaza rutas sin sesión', async () => {
      assert.equal((await llamar('GET', '/usuarios')).estado, 401);
    });

    it('rechaza credenciales incorrectas con un mensaje genérico', async () => {
      const r = await login('admin', 'mala');
      assert.equal(r.estado, 401);
      assert.equal((r.cuerpo as unknown as { message: string }).message, 'Usuario o contraseña incorrectos.');
    });

    it('RF-AUT-04: con contraseña temporal solo puede cambiarla', async () => {
      const r = await login('admin', 'Temporal123');
      assert.equal(r.estado, 200);
      assert.equal(r.cuerpo.usuario.debeCambiarPassword, true);
      const token = r.cuerpo.tokenAcceso;

      const bloqueado = await llamar<{ codigo: string }>('GET', '/usuarios', { token });
      assert.equal(bloqueado.estado, 403);
      assert.equal(bloqueado.cuerpo.codigo, 'DEBE_CAMBIAR_PASSWORD');

      const debil = await llamar('POST', '/auth/cambiar-password', { token, cuerpo: { actual: 'Temporal123', nueva: 'corta' } });
      assert.equal(debil.estado, 400);

      const ok = await llamar<UsuarioDto>('POST', '/auth/cambiar-password', { token, cuerpo: { actual: 'Temporal123', nueva: 'Coordina2026' } });
      assert.equal(ok.estado, 200);
      assert.equal(ok.cuerpo.debeCambiarPassword, false);
      assert.equal((await llamar('GET', '/usuarios', { token })).estado, 200);
      coord = token;
    });

    it('bloquea tras 5 intentos fallidos', async () => {
      for (let i = 0; i < 5; i++) await login('nadie', 'x');
      assert.equal((await login('nadie', 'x')).estado, 429);
    });

    it('rota el token de refresco y no deja reutilizar el anterior', async () => {
      const r = await login('admin', 'Coordina2026');
      const primero = r.cuerpo.tokenRefresco;
      const refrescado = await llamar<RespuestaLoginDto>('POST', '/auth/refrescar', { cuerpo: { tokenRefresco: primero } });
      assert.equal(refrescado.estado, 200);
      assert.notEqual(refrescado.cuerpo.tokenRefresco, primero);
      assert.equal((await llamar('POST', '/auth/refrescar', { cuerpo: { tokenRefresco: primero } })).estado, 401);
    });

    it('al cerrar sesión el token deja de servir', async () => {
      const { tokenAcceso } = (await login('admin', 'Coordina2026')).cuerpo;
      assert.equal((await llamar('POST', '/auth/logout', { token: tokenAcceso })).estado, 204);
      assert.equal((await llamar('GET', '/auth/yo', { token: tokenAcceso })).estado, 401);
    });
  });

  describe('usuarios (RF-AUT-02/03)', () => {
    it('el coordinador crea un enfermero con contraseña temporal y advertencia de salario', async () => {
      const r = await llamar<UsuarioConPasswordTemporalDto>('POST', '/usuarios', {
        token: coord,
        cuerpo: { documento: '1020345678', nombres: 'Camila Torres', email: 'Camila@Clinica.co', rol: 'ENFERMERO', cargo: 'AUXILIAR', fechaIngreso: '2024-06-03', salarioBase: 1150000 },
      });
      assert.equal(r.estado, 201);
      assert.equal(r.cuerpo.usuario.email, 'camila@clinica.co');
      assert.equal(r.cuerpo.advertencias.length, 1);
      enfermero = r.cuerpo.usuario;

      // Entra con el correo, cambia la contraseña temporal.
      const l = await login('camila@clinica.co', r.cuerpo.passwordTemporal);
      assert.equal(l.estado, 200);
      await llamar('POST', '/auth/cambiar-password', { token: l.cuerpo.tokenAcceso, cuerpo: { actual: r.cuerpo.passwordTemporal, nueva: 'Enfermera2026' } });
      tokenEnfermero = l.cuerpo.tokenAcceso;
    });

    it('valida los datos y no permite documentos repetidos', async () => {
      const invalido = await llamar<{ message: string[] }>('POST', '/usuarios', { token: coord, cuerpo: { documento: 'a b', nombres: '', rol: 'JEFE' } });
      assert.equal(invalido.estado, 400);
      assert.ok(invalido.cuerpo.message.length >= 3);
      const repetido = await llamar('POST', '/usuarios', {
        token: coord,
        cuerpo: { documento: '1020345678', nombres: 'Otra', rol: 'ENFERMERO', cargo: 'AUXILIAR', fechaIngreso: '2024-01-01', salarioBase: 2000000 },
      });
      assert.equal(repetido.estado, 409);
    });

    it('el enfermero ve solo el resumen de sus compañeros y no puede administrar', async () => {
      const lista = await llamar<Record<string, unknown>[]>('GET', '/usuarios', { token: tokenEnfermero });
      assert.equal(lista.estado, 200);
      assert.ok(lista.cuerpo.every((u) => !('documento' in u) && !('salarios' in u)));
      assert.equal((await llamar('POST', '/tipos-turno', { token: tokenEnfermero, cuerpo: { codigo: 'X', nombre: 'X', horaInicio: '01:00', horaFin: '02:00', color: '#000000' } })).estado, 403);
      assert.equal((await llamar('GET', '/auditoria', { token: tokenEnfermero })).estado, 403);
    });

    it('registra un nuevo salario con vigencia y conserva el historial', async () => {
      const r = await llamar<{ usuario: UsuarioDto }>('POST', `/usuarios/${enfermero.id}/salarios`, { token: coord, cuerpo: { salarioBase: 1800000, vigenteDesde: '2026-10-01' } });
      assert.equal(r.estado, 201);
      assert.deepEqual(r.cuerpo.usuario.salarios.map((s) => s.salarioBase), [1150000, 1800000]);
    });

    it('al desactivar un usuario se cierran sus sesiones y no puede entrar', async () => {
      assert.equal((await llamar('POST', `/usuarios/${enfermero.id}/desactivar`, { token: coord })).estado, 200);
      assert.equal((await llamar('GET', '/auth/yo', { token: tokenEnfermero })).estado, 401);
      assert.equal((await login('1020345678', 'Enfermera2026')).estado, 401);
      await llamar('POST', `/usuarios/${enfermero.id}/activar`, { token: coord });
      assert.equal((await login('1020345678', 'Enfermera2026')).estado, 200);
    });

    it('no deja al servicio sin coordinador', async () => {
      const yo = await llamar<UsuarioDto>('GET', '/auth/yo', { token: coord });
      const r = await llamar<{ message: string }>('PATCH', `/usuarios/${yo.cuerpo.id}`, { token: coord, cuerpo: { rol: 'ENFERMERO' } });
      assert.equal(r.estado, 400);
      assert.equal(r.cuerpo.message, 'Debe quedar al menos un coordinador activo.');
    });

    it('restablecer la contraseña obliga a cambiarla de nuevo', async () => {
      const r = await llamar<UsuarioConPasswordTemporalDto>('POST', `/usuarios/${enfermero.id}/restablecer-password`, { token: coord });
      assert.equal(r.cuerpo.usuario.debeCambiarPassword, true);
      assert.equal((await login('1020345678', 'Enfermera2026')).estado, 401);
      assert.equal((await login('1020345678', r.cuerpo.passwordTemporal)).estado, 200);
    });
  });

  describe('configuración', () => {
    it('tipos de turno: crea, rechaza código repetido y desactiva', async () => {
      const r = await llamar<{ id: string }>('POST', '/tipos-turno', { token: coord, cuerpo: { codigo: 'C', nombre: 'Corrido', horaInicio: '07:00', horaFin: '15:00', color: '#123456' } });
      assert.equal(r.estado, 201);
      assert.equal((await llamar('POST', '/tipos-turno', { token: coord, cuerpo: { codigo: 'C', nombre: 'Otro', horaInicio: '08:00', horaFin: '09:00', color: '#123456' } })).estado, 409);
      await llamar('POST', `/tipos-turno/${r.cuerpo.id}/desactivar`, { token: coord });
      const activos = await llamar<{ codigo: string }[]>('GET', '/tipos-turno', { token: coord });
      assert.ok(!activos.cuerpo.some((t) => t.codigo === 'C'));
    });

    it('parámetros: usa el valor vigente en cada fecha (ADR-004)', async () => {
      const valor = async (fecha: string, clave: string) =>
        (await llamar<{ clave: string; valor: unknown }[]>('GET', `/parametros?fecha=${fecha}`, { token: coord })).cuerpo.find((p) => p.clave === clave)?.valor;
      assert.equal(await valor('2025-12-24', 'jornada.inicio_nocturna'), '21:00');
      assert.equal(await valor('2025-12-25', 'jornada.inicio_nocturna'), '19:00');
      assert.equal(await valor('2026-10-01', 'recargo.dominical_pct'), 90);
      assert.equal(await valor('2027-07-01', 'recargo.dominical_pct'), 100);
    });

    it('parámetros: una nueva vigencia cierra la anterior sin tocar la futura', async () => {
      const r = await llamar('POST', '/parametros', { token: coord, cuerpo: { clave: 'recargo.dominical_pct', valor: 95, vigenteDesde: '2027-01-01' } });
      assert.equal(r.estado, 201);
      const historial = (await llamar<{ clave: string; valor: number; vigenteDesde: string; vigenteHasta: string | null }[]>('GET', '/parametros/historial', { token: coord })).cuerpo.filter(
        (p) => p.clave === 'recargo.dominical_pct',
      );
      assert.deepEqual(
        historial.map((p) => [p.valor, p.vigenteDesde, p.vigenteHasta]),
        [
          [80, '2025-07-01', '2026-06-30'],
          [90, '2026-07-01', '2026-12-31'],
          [95, '2027-01-01', '2027-06-30'],
          [100, '2027-07-01', null],
        ],
      );
      assert.equal((await llamar('POST', '/parametros', { token: coord, cuerpo: { clave: 'recargo.dominical_pct', valor: 'mucho', vigenteDesde: '2027-02-01' } })).estado, 400);
      assert.equal((await llamar('POST', '/parametros', { token: coord, cuerpo: { clave: 'no.existe', valor: 1, vigenteDesde: '2027-02-01' } })).estado, 400);
      // Con divisor 0 el valor de la hora sería infinito.
      assert.equal((await llamar('POST', '/parametros', { token: coord, cuerpo: { clave: 'jornada.divisor_mensual_h', valor: 0, vigenteDesde: '2027-02-01' } })).estado, 400);
    });

    it('festivos: lista por año, agrega, elimina y precarga', async () => {
      const f2026 = await llamar<{ fecha: string }[]>('GET', '/festivos?anio=2026', { token: coord });
      assert.equal(f2026.cuerpo.length, 18);
      assert.equal((await llamar('POST', '/festivos', { token: coord, cuerpo: { fecha: '2026-12-31', nombre: 'Cierre de año' } })).estado, 201);
      assert.equal((await llamar('DELETE', '/festivos/2026-12-31', { token: coord })).estado, 204);
      const pre = await llamar<{ agregados: number }>('POST', '/festivos/precargar', { token: coord, cuerpo: { anio: 2030 } });
      // 2030 tiene 17 fechas: San Pedro y Sagrado Corazón caen ambos el lunes 1 de julio.
      assert.equal(pre.cuerpo.agregados, festivosColombia(2030).length);
      assert.equal(pre.cuerpo.agregados, 17);
    });
  });

  describe('auditoría (RF-ADM-03)', () => {
    it('registra las acciones sin guardar contraseñas ni hashes', async () => {
      const eventos = await llamar<{ accion: string }[]>('GET', '/auditoria?limite=500', { token: coord });
      const acciones = new Set(eventos.cuerpo.map((e) => e.accion));
      for (const a of ['LOGIN', 'LOGIN_FALLIDO', 'PASSWORD_CAMBIADA', 'USUARIO_CREADO', 'USUARIO_DESACTIVADO', 'PARAMETRO_CREADO', 'TIPO_TURNO_CREADO', 'FESTIVO_ELIMINADO']) {
        assert.ok(acciones.has(a), `falta ${a}`);
      }
      const archivo = await readFile(join(dir, 'auditoria.jsonl'), 'utf8');
      assert.ok(!archivo.includes('argon2'));
      assert.ok(!archivo.includes('Enfermera2026'));
    });
  });
});
