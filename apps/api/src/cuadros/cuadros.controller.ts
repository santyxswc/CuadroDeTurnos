import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsOptional, IsString, IsUUID, Matches, MaxLength, ValidateNested } from 'class-validator';
import type { UsuarioGuardado } from '../almacen/modelos';
import { Roles, UsuarioActual } from '../comun/decoradores';
import { CuadrosService } from './cuadros.service';

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

export class CrearCuadroDto {
  @Matches(FECHA, { message: 'La fecha de inicio debe tener el formato YYYY-MM-DD.' })
  periodoInicio: string;

  @Matches(FECHA, { message: 'La fecha de fin debe tener el formato YYYY-MM-DD.' })
  periodoFin: string;
}

export class CeldaDto {
  @IsUUID('4', { message: 'Persona no válida.' })
  usuarioId: string;

  @Matches(FECHA, { message: 'La fecha debe tener el formato YYYY-MM-DD.' })
  fecha: string;

  /** null deja el día libre. */
  @IsOptional()
  @IsUUID('4', { message: 'Tipo de turno no válido.' })
  tipoTurnoId: string | null;
}

export class CambiarCeldasDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2000)
  @ValidateNested({ each: true })
  @Type(() => CeldaDto)
  cambios: CeldaDto[];

  /** Obligatorio si el cuadro ya está publicado. */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  motivo?: string;
}

/** Lectura: todos (los enfermeros no ven borradores) · escritura: coordinador. */
@Controller('cuadros')
export class CuadrosController {
  constructor(private readonly cuadros: CuadrosService) {}

  @Get()
  listar(@UsuarioActual() usuario: UsuarioGuardado) {
    return this.cuadros.listar(usuario.rol);
  }

  /** Turnos publicados en un rango (página principal, RF-MAIN-01). */
  @Get('asignaciones')
  asignaciones(@Query('desde') desde: string, @Query('hasta') hasta: string) {
    return this.cuadros.asignacionesPublicadas(desde ?? '', hasta ?? '');
  }

  @Get(':id')
  obtener(@Param('id', ParseUUIDPipe) id: string, @UsuarioActual() usuario: UsuarioGuardado) {
    return this.cuadros.obtener(id, usuario.rol);
  }

  @Roles('COORDINADOR')
  @Post()
  crear(@Body() dto: CrearCuadroDto, @UsuarioActual() actor: UsuarioGuardado) {
    return this.cuadros.crear(dto.periodoInicio, dto.periodoFin, actor.id);
  }

  @Roles('COORDINADOR')
  @Put(':id/celdas')
  cambiarCeldas(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CambiarCeldasDto, @UsuarioActual() actor: UsuarioGuardado) {
    return this.cuadros.cambiarCeldas(
      id,
      dto.cambios.map((c) => ({ usuarioId: c.usuarioId, fecha: c.fecha, tipoTurnoId: c.tipoTurnoId ?? null })),
      dto.motivo,
      actor.id,
    );
  }

  @Roles('COORDINADOR')
  @Post(':id/publicar')
  @HttpCode(200)
  publicar(@Param('id', ParseUUIDPipe) id: string, @UsuarioActual() actor: UsuarioGuardado) {
    return this.cuadros.publicar(id, actor.id);
  }

  @Roles('COORDINADOR')
  @Post(':id/cerrar')
  @HttpCode(200)
  cerrar(@Param('id', ParseUUIDPipe) id: string, @UsuarioActual() actor: UsuarioGuardado) {
    return this.cuadros.cerrar(id, actor.id);
  }

  @Roles('COORDINADOR')
  @Delete(':id')
  @HttpCode(204)
  async eliminar(@Param('id', ParseUUIDPipe) id: string, @UsuarioActual() actor: UsuarioGuardado) {
    await this.cuadros.eliminar(id, actor.id);
  }
}
