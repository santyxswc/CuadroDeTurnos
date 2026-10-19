import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EventoTiempoReal, type MensajeChatDto } from '@sgt/shared-types';
import { randomUUID } from 'node:crypto';
import { AlmacenService } from '../almacen/almacen.service';
import type { MensajeGuardado, UsuarioGuardado } from '../almacen/modelos';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { ParametrosService } from '../parametros/parametros.service';
import { EventosGateway } from '../tiempo-real/eventos.gateway';

const aDto = ({ id, autorId, contenido, esNovedad, creadoEn }: MensajeGuardado): MensajeChatDto => ({ id, autorId, contenido, esNovedad, creadoEn });

/** Chat general del equipo (RF-CHAT-01 a 05). */
@Injectable()
export class ChatService {
  constructor(
    private readonly almacen: AlmacenService,
    private readonly auditoria: AuditoriaService,
    private readonly parametros: ParametrosService,
    private readonly eventos: EventosGateway,
  ) {}

  /** Los mensajes más recientes en orden cronológico; `antes` pide la página anterior. */
  listar(antes: string | undefined, limite: number): MensajeChatDto[] {
    return this.almacen.mensajes
      .filtrar((m) => !m.ocultoPor && (!antes || m.creadoEn < antes))
      .sort((a, b) => a.creadoEn.localeCompare(b.creadoEn))
      .slice(-limite)
      .map(aDto);
  }

  async enviar(contenido: string, esNovedad: boolean, autor: UsuarioGuardado): Promise<MensajeChatDto> {
    const texto = contenido.trim();
    if (!texto) throw new BadRequestException('Escribe un mensaje.');
    return this.guardar({ autorId: autor.id, contenido: texto, esNovedad });
  }

  /** Mensaje automático, por ejemplo cuando un turno queda sin cobertura (RF-CHAT-05). */
  sistema(contenido: string) {
    return this.guardar({ autorId: null, contenido, esNovedad: true });
  }

  /** El autor borra su mensaje en los primeros minutos; el coordinador puede ocultar cualquiera y queda auditado. */
  async eliminar(id: string, usuario: UsuarioGuardado) {
    const m = this.almacen.mensajes.obtener(id);
    if (!m || m.ocultoPor) throw new NotFoundException('El mensaje no existe.');
    if (usuario.rol === 'COORDINADOR') {
      await this.almacen.mensajes.actualizar(id, (x) => ({ ...x, ocultoPor: usuario.id }));
      await this.auditoria.registrar({ actorId: usuario.id, accion: 'MENSAJE_OCULTADO', entidad: 'mensaje', entidadId: id, antes: { autorId: m.autorId, contenido: m.contenido } });
    } else {
      if (m.autorId !== usuario.id) throw new ForbiddenException('Solo puedes borrar tus propios mensajes.');
      const minutos = this.parametros.valor('chat.minutos_edicion');
      if (Date.now() - Date.parse(m.creadoEn) > minutos * 60_000) throw new BadRequestException(`Solo se puede borrar en los primeros ${minutos} minutos.`);
      await this.almacen.mensajes.eliminar(id);
    }
    this.eventos.aTodos(EventoTiempoReal.CHAT_ACTUALIZADO, { id });
  }

  private async guardar(datos: Pick<MensajeGuardado, 'autorId' | 'contenido' | 'esNovedad'>) {
    const m = await this.almacen.mensajes.insertar({ id: randomUUID(), ...datos, creadoEn: new Date().toISOString(), ocultoPor: null });
    const dto = aDto(m);
    this.eventos.aTodos(EventoTiempoReal.CHAT_ACTUALIZADO, dto);
    return dto;
  }
}
