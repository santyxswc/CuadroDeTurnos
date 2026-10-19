import { BadRequestException, Body, Controller, Get, Ip, Post, Query } from '@nestjs/common';
import { TipoMarcacion } from '@sgt/shared-types';
import { IsIn, IsISO8601, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import type { UsuarioGuardado } from '../almacen/modelos';
import { Roles, UsuarioActual } from '../comun/decoradores';
import { esFechaValida } from '../comun/fechas';
import { MarcacionesService } from './marcaciones.service';

export class MarcarDto {
  /** Nombre del equipo desde el que se marca (RF-ASI-06). */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  equipo?: string | null;
}

export class CorreccionDto {
  @IsUUID('4', { message: 'Persona no válida.' })
  usuarioId: string;

  @IsOptional()
  @IsUUID('4', { message: 'Turno no válido.' })
  asignacionId?: string | null;

  @IsIn(Object.values(TipoMarcacion), { message: 'El tipo debe ser ENTRADA o SALIDA.' })
  tipo: TipoMarcacion;

  @IsISO8601({}, { message: 'La hora debe ser una fecha y hora ISO 8601.' })
  hora: string;

  @IsString()
  @IsNotEmpty({ message: 'Escribe el motivo de la corrección.' })
  @MinLength(5, { message: 'El motivo debe tener al menos 5 caracteres.' })
  @MaxLength(300)
  motivo: string;
}

@Controller('marcaciones')
export class MarcacionesController {
  constructor(private readonly marcaciones: MarcacionesService) {}

  /** Cada persona marca por sí misma; la hora es la del servidor. */
  @Post()
  marcar(@Body() dto: MarcarDto, @UsuarioActual() usuario: UsuarioGuardado, @Ip() ip: string) {
    return this.marcaciones.marcar(usuario, dto.equipo ?? null, ip || null);
  }

  @Get('mi-turno')
  miTurno(@UsuarioActual() usuario: UsuarioGuardado) {
    return this.marcaciones.miTurno(usuario);
  }

  /** Indicadores de la página principal: visibles para todo el equipo (RF-MAIN-02). */
  @Get('estado-actual')
  estadoActual() {
    return this.marcaciones.estadoActual();
  }

  /** El coordinador ve las de todos; un enfermero solo las suyas. */
  @Get()
  listar(@UsuarioActual() usuario: UsuarioGuardado, @Query('desde') desde: string, @Query('hasta') hasta: string, @Query('usuarioId') usuarioId?: string) {
    if (!esFechaValida(desde ?? '') || !esFechaValida(hasta ?? '')) throw new BadRequestException('Indica desde y hasta con el formato YYYY-MM-DD.');
    return this.marcaciones.listar({ desde, hasta, usuarioId: usuario.rol === 'COORDINADOR' ? usuarioId : usuario.id });
  }

  @Roles('COORDINADOR')
  @Post('correcciones')
  corregir(@Body() dto: CorreccionDto, @UsuarioActual() actor: UsuarioGuardado) {
    return this.marcaciones.corregir({ ...dto, asignacionId: dto.asignacionId ?? null }, actor.id);
  }
}
