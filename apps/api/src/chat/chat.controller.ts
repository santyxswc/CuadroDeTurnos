import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import type { UsuarioGuardado } from '../almacen/modelos';
import { UsuarioActual } from '../comun/decoradores';
import { ChatService } from './chat.service';

export class NuevoMensajeEntradaDto {
  @IsString()
  @MaxLength(1000, { message: 'El mensaje es demasiado largo (máximo 1000 caracteres).' })
  contenido: string;

  @IsOptional() @IsBoolean() esNovedad?: boolean;
}

@Controller('chat')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  /** Historial paginado: los últimos `limite` mensajes antes de `antes` (ISO). */
  @Get()
  listar(@Query('antes') antes?: string, @Query('limite') limite?: string) {
    return this.chat.listar(antes, Math.min(Math.max(Number(limite) || 50, 1), 200));
  }

  @Post()
  enviar(@Body() dto: NuevoMensajeEntradaDto, @UsuarioActual() usuario: UsuarioGuardado) {
    return this.chat.enviar(dto.contenido, dto.esNovedad ?? false, usuario);
  }

  @Delete(':id')
  @HttpCode(204)
  eliminar(@Param('id', ParseUUIDPipe) id: string, @UsuarioActual() usuario: UsuarioGuardado) {
    return this.chat.eliminar(id, usuario);
  }
}
