import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WebSocketGateway, WebSocketServer, type OnGatewayConnection } from '@nestjs/websockets';
import type { EventoTiempoReal } from '@sgt/shared-types';
import type { Server, Socket } from 'socket.io';
import { AlmacenService } from '../almacen/almacen.service';
import type { CargaToken } from '../auth/autenticacion.guard';

/**
 * Actualizaciones en tiempo real (RF-MAIN-05). El servidor solo empuja eventos; los cambios se hacen por HTTP.
 * La conexión usa el mismo token de acceso que la API y se cierra cuando la sesión se revoca.
 */
@WebSocketGateway({ cors: true })
export class EventosGateway implements OnGatewayConnection {
  private readonly logger = new Logger('TiempoReal');
  @WebSocketServer() private readonly servidor?: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly almacen: AlmacenService,
  ) {}

  async handleConnection(socket: Socket) {
    try {
      const token = (socket.handshake.auth as { token?: unknown } | undefined)?.token;
      if (typeof token !== 'string') throw new Error('Sin token');
      const carga = await this.jwt.verifyAsync<CargaToken>(token);
      const usuario = this.almacen.usuarios.obtener(carga.sub);
      const sesion = this.almacen.sesiones.obtener(carga.sid);
      if (!usuario?.activo || !sesion || sesion.revocadaEn || usuario.debeCambiarPassword) throw new Error('Sesión no válida');
      await socket.join([`usuario:${usuario.id}`, `sesion:${sesion.id}`, `rol:${usuario.rol}`]);
    } catch (e) {
      this.logger.debug(`Conexión rechazada: ${(e as Error).message}`);
      socket.disconnect(true);
    }
  }

  aTodos(evento: EventoTiempoReal, datos: unknown) {
    this.servidor?.to(['rol:COORDINADOR', 'rol:ENFERMERO']).emit(evento, datos);
  }

  /** Eventos de borradores: solo los ve quien puede editar el cuadro. */
  aCoordinadores(evento: EventoTiempoReal, datos: unknown) {
    this.servidor?.to('rol:COORDINADOR').emit(evento, datos);
  }

  cerrarSesion(sesionId: string) {
    this.servidor?.in(`sesion:${sesionId}`).disconnectSockets(true);
  }
}
