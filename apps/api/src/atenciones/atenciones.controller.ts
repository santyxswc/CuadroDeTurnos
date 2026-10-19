import { BadRequestException, Body, Controller, ForbiddenException, Get, NotFoundException, Param, ParseUUIDPipe, Put, Query } from '@nestjs/common';
import type { AtencionDto } from '@sgt/shared-types';
import { IsInt, Max, Min } from 'class-validator';
import { AlmacenService } from '../almacen/almacen.service';
import type { UsuarioGuardado } from '../almacen/modelos';
import { UsuarioActual } from '../comun/decoradores';
import { esFechaValida } from '../comun/fechas';

export class AtencionEntradaDto {
  @IsInt({ message: 'La cantidad debe ser un número entero.' })
  @Min(0, { message: 'La cantidad no puede ser negativa.' })
  @Max(200, { message: 'La cantidad parece demasiado alta.' })
  cantidad: number;
}

/** Pacientes atendidos por turno (RF-PAC-01/02). Solo se guarda el número, nunca datos de pacientes. */
@Controller('atenciones')
export class AtencionesController {
  constructor(private readonly almacen: AlmacenService) {}

  /** Coordinador: las de todos · enfermero: las propias. */
  @Get()
  listar(@UsuarioActual() usuario: UsuarioGuardado, @Query('desde') desde: string, @Query('hasta') hasta: string): AtencionDto[] {
    if (!esFechaValida(desde ?? '') || !esFechaValida(hasta ?? '')) throw new BadRequestException('Indica desde y hasta con el formato YYYY-MM-DD.');
    const turnos = new Map(this.turnosPublicados().map((a) => [a.id, a]));
    return this.almacen.atenciones
      .filtrar((x) => usuario.rol === 'COORDINADOR' || x.usuarioId === usuario.id)
      .flatMap((x) => {
        const a = turnos.get(x.id);
        return a && a.fecha >= desde && a.fecha <= hasta ? [{ asignacionId: a.id, usuarioId: a.usuarioId, fecha: a.fecha, codigo: a.codigo, cantidad: x.cantidad }] : [];
      });
  }

  /** La persona del turno (o el coordinador) registra cuántos pacientes atendió, una vez empezado el turno. */
  @Put(':asignacionId')
  async registrar(@Param('asignacionId', ParseUUIDPipe) asignacionId: string, @Body() dto: AtencionEntradaDto, @UsuarioActual() usuario: UsuarioGuardado) {
    const a = this.turnosPublicados().find((x) => x.id === asignacionId);
    if (!a) throw new NotFoundException('El turno no existe.');
    if (usuario.rol !== 'COORDINADOR' && a.usuarioId !== usuario.id) throw new ForbiddenException('Solo puedes registrar pacientes de tus propios turnos.');
    if (Date.parse(a.inicio) > Date.now()) throw new BadRequestException('El turno todavía no ha empezado.');

    const datos = { usuarioId: a.usuarioId, cantidad: dto.cantidad, registradaPor: usuario.id, actualizadaEn: new Date().toISOString() };
    if (this.almacen.atenciones.obtener(asignacionId)) await this.almacen.atenciones.actualizar(asignacionId, (x) => ({ ...x, ...datos }));
    else await this.almacen.atenciones.insertar({ id: asignacionId, ...datos });
    return { asignacionId, usuarioId: a.usuarioId, fecha: a.fecha, codigo: a.codigo, cantidad: dto.cantidad } satisfies AtencionDto;
  }

  private turnosPublicados() {
    return this.almacen.cuadros.filtrar((c) => c.estado !== 'BORRADOR').flatMap((c) => c.asignaciones.filter((a) => a.estado === 'ACTIVA'));
  }
}
