import { BadRequestException, HttpException, HttpStatus, Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { RespuestaLoginDto } from '@sgt/shared-types';
import { randomUUID } from 'node:crypto';
import { AlmacenService } from '../almacen/almacen.service';
import type { SesionGuardada, UsuarioGuardado } from '../almacen/modelos';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { CONFIG, type ConfigSgt } from '../config';
import { ParametrosService } from '../parametros/parametros.service';
import { EventosGateway } from '../tiempo-real/eventos.gateway';
import { aUsuarioDto } from '../usuarios/mapeo';
import type { CargaToken } from './autenticacion.guard';
import { cumplePolitica, hashPassword, MENSAJE_POLITICA, sha256, tokenAleatorio, verificarPassword } from './passwords';

const MAX_INTENTOS = 5;
const MINUTOS_BLOQUEO = 5;
const CREDENCIALES_INVALIDAS = 'Usuario o contraseña incorrectos.';

@Injectable()
export class AuthService {
  /** Intentos fallidos por usuario escrito (en memoria: se reinicia con la API). */
  private readonly intentos = new Map<string, { fallos: number; bloqueadoHasta: number }>();

  constructor(
    private readonly almacen: AlmacenService,
    private readonly jwt: JwtService,
    private readonly parametros: ParametrosService,
    private readonly auditoria: AuditoriaService,
    private readonly eventos: EventosGateway,
    @Inject(CONFIG) private readonly config: ConfigSgt,
  ) {}

  async login(identificador: string, password: string, equipo: string | null): Promise<RespuestaLoginDto> {
    const clave = identificador.trim().toLowerCase();
    const intento = this.intentos.get(clave);
    if (intento && intento.bloqueadoHasta > Date.now()) {
      const minutos = Math.ceil((intento.bloqueadoHasta - Date.now()) / 60_000);
      throw new HttpException(`Demasiados intentos fallidos. Intenta de nuevo en ${minutos} min.`, HttpStatus.TOO_MANY_REQUESTS);
    }

    const usuario = this.almacen.usuarios.buscar((u) => u.documento.toLowerCase() === clave || u.email === clave);
    // Se verifica la contraseña aunque el usuario no exista o esté inactivo, para no revelar cuál falló.
    const valida = usuario ? await verificarPassword(usuario.hashPassword, password) : false;
    if (!usuario || !valida || !usuario.activo) {
      const fallos = (intento?.fallos ?? 0) + 1;
      this.intentos.set(clave, { fallos, bloqueadoHasta: fallos >= MAX_INTENTOS ? Date.now() + MINUTOS_BLOQUEO * 60_000 : 0 });
      await this.auditoria.registrar({ actorId: usuario?.id ?? null, accion: 'LOGIN_FALLIDO', entidad: 'sesion', despues: { usuario: identificador, equipo } });
      throw new UnauthorizedException(CREDENCIALES_INVALIDAS);
    }
    this.intentos.delete(clave);

    const ahora = new Date();
    const tokenRefresco = tokenAleatorio();
    const sesion = await this.almacen.sesiones.insertar({
      id: randomUUID(),
      usuarioId: usuario.id,
      hashRefresco: sha256(tokenRefresco),
      equipo,
      creadaEn: ahora.toISOString(),
      ultimoUso: ahora.toISOString(),
      expiraEn: new Date(ahora.getTime() + this.config.horasMaximasSesion * 3_600_000).toISOString(),
      revocadaEn: null,
    });
    await this.auditoria.registrar({ actorId: usuario.id, accion: 'LOGIN', entidad: 'sesion', entidadId: sesion.id, despues: { equipo } });
    return this.respuesta(usuario, sesion, tokenRefresco);
  }

  /** Cambia el token de refresco por uno nuevo (rotación). Falla si la sesión lleva inactiva más del límite (RF-AUT-05). */
  async refrescar(tokenRefresco: string): Promise<RespuestaLoginDto> {
    const hash = sha256(tokenRefresco);
    const sesion = this.almacen.sesiones.buscar((s) => s.hashRefresco === hash);
    const ahora = Date.now();
    const inactividadMs = this.parametros.valor('seguridad.inactividad_min') * 60_000;
    const usuario = sesion && this.almacen.usuarios.obtener(sesion.usuarioId);
    if (
      !sesion ||
      !usuario?.activo ||
      sesion.revocadaEn ||
      Date.parse(sesion.expiraEn) < ahora ||
      Date.parse(sesion.ultimoUso) + inactividadMs < ahora
    ) {
      throw new UnauthorizedException('La sesión expiró. Vuelve a iniciar sesión.');
    }
    const nuevoToken = tokenAleatorio();
    const actualizada = await this.almacen.sesiones.actualizar(sesion.id, (s) => ({
      ...s,
      hashRefresco: sha256(nuevoToken),
      ultimoUso: new Date(ahora).toISOString(),
    }));
    return this.respuesta(usuario, actualizada!, nuevoToken);
  }

  async cerrarSesion(sesionId: string, usuarioId: string) {
    await this.almacen.sesiones.actualizar(sesionId, (s) => ({ ...s, revocadaEn: new Date().toISOString() }));
    this.eventos.cerrarSesion(sesionId);
    await this.auditoria.registrar({ actorId: usuarioId, accion: 'LOGOUT', entidad: 'sesion', entidadId: sesionId });
  }

  async cambiarPassword(usuario: UsuarioGuardado, sesionId: string, actual: string, nueva: string) {
    if (!(await verificarPassword(usuario.hashPassword, actual))) throw new BadRequestException('La contraseña actual no es correcta.');
    if (!cumplePolitica(nueva)) throw new BadRequestException(MENSAJE_POLITICA);
    if (nueva === actual) throw new BadRequestException('La nueva contraseña debe ser distinta de la actual.');
    const hashNuevo = await hashPassword(nueva);
    const actualizado = await this.almacen.usuarios.actualizar(usuario.id, (u) => ({ ...u, hashPassword: hashNuevo, debeCambiarPassword: false }));
    // Las demás sesiones abiertas de esta persona se cierran.
    await this.revocarSesiones(usuario.id, sesionId);
    await this.auditoria.registrar({ actorId: usuario.id, accion: 'PASSWORD_CAMBIADA', entidad: 'usuario', entidadId: usuario.id });
    return aUsuarioDto(actualizado!);
  }

  /** Revoca las sesiones activas de un usuario, excepto la indicada. */
  async revocarSesiones(usuarioId: string, excepto?: string) {
    const ahora = new Date().toISOString();
    for (const s of this.almacen.sesiones.filtrar((x) => x.usuarioId === usuarioId && !x.revocadaEn && x.id !== excepto)) {
      await this.almacen.sesiones.actualizar(s.id, (x) => ({ ...x, revocadaEn: ahora }));
      this.eventos.cerrarSesion(s.id);
    }
  }

  private async respuesta(usuario: UsuarioGuardado, sesion: SesionGuardada, tokenRefresco: string): Promise<RespuestaLoginDto> {
    const carga: CargaToken = { sub: usuario.id, sid: sesion.id, rol: usuario.rol };
    return {
      tokenAcceso: await this.jwt.signAsync(carga),
      tokenRefresco,
      expiraEn: this.config.minutosTokenAcceso * 60,
      usuario: aUsuarioDto(usuario),
    };
  }
}
