import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { CategoriaPermiso, TipoSolicitud } from '@sgt/shared-types';
import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import type { UsuarioGuardado } from '../almacen/modelos';
import { Roles, UsuarioActual } from '../comun/decoradores';
import { SolicitudesService } from './solicitudes.service';

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

export class NuevaSolicitudEntradaDto {
  @IsIn(Object.values(TipoSolicitud), { message: 'Tipo de solicitud no válido.' })
  tipo: TipoSolicitud;

  @IsOptional() @IsUUID('4') companeroId?: string;
  @IsOptional() @IsUUID('4') asignacionId?: string;
  @IsOptional() @IsUUID('4') asignacionDestinoId?: string;
  @IsOptional() @Matches(FECHA, { message: 'La fecha debe tener el formato YYYY-MM-DD.' }) desde?: string;
  @IsOptional() @Matches(FECHA, { message: 'La fecha debe tener el formato YYYY-MM-DD.' }) hasta?: string;
  @IsOptional() @IsIn(Object.values(CategoriaPermiso), { message: 'Motivo no válido.' }) categoria?: CategoriaPermiso;
  @IsOptional() @IsString() @MaxLength(300) comentario?: string;
}

export class RespuestaDto {
  @IsBoolean()
  acepta: boolean;
}

export class ResolucionDto {
  @IsBoolean()
  aprueba: boolean;

  @IsOptional() @IsString() @MaxLength(300) respuesta?: string;
}

@Controller('solicitudes')
export class SolicitudesController {
  constructor(private readonly solicitudes: SolicitudesService) {}

  /** Coordinador: todas · enfermero: las suyas y las que le piden. */
  @Get()
  listar(@UsuarioActual() usuario: UsuarioGuardado) {
    return this.solicitudes.listar(usuario);
  }

  @Post()
  crear(@Body() dto: NuevaSolicitudEntradaDto, @UsuarioActual() usuario: UsuarioGuardado) {
    return this.solicitudes.crear(dto, usuario);
  }

  @Post(':id/responder')
  @HttpCode(200)
  responder(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RespuestaDto, @UsuarioActual() usuario: UsuarioGuardado) {
    return this.solicitudes.responder(id, dto.acepta, usuario);
  }

  @Roles('COORDINADOR')
  @Post(':id/resolver')
  @HttpCode(200)
  resolver(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ResolucionDto, @UsuarioActual() usuario: UsuarioGuardado) {
    return this.solicitudes.resolver(id, dto.aprueba, dto.respuesta, usuario);
  }

  @Post(':id/cancelar')
  @HttpCode(200)
  cancelar(@Param('id', ParseUUIDPipe) id: string, @UsuarioActual() usuario: UsuarioGuardado) {
    return this.solicitudes.cancelar(id, usuario);
  }
}
