import { BadRequestException, Injectable } from '@nestjs/common';
import { PARAMETROS_DEFECTO, type ClaveParametro, type ParametroDto, type ValorParametro } from '@sgt/shared-types';
import { AlmacenService } from '../almacen/almacen.service';
import type { ParametroGuardado } from '../almacen/modelos';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { diaAnterior, hoyBogota } from '../comun/fechas';

const aDto = ({ clave, valor, vigenteDesde, vigenteHasta }: ParametroGuardado): ParametroDto => ({ clave, valor, vigenteDesde, vigenteHasta });

/** Parámetros laborales con vigencia (ADR-004, RF-ADM-01). */
const MAYORES_QUE_CERO = new Set<string>([
  'jornada.maxima_semanal_h',
  'jornada.divisor_mensual_h',
  'aptitud.max_horas_continuas',
  'seguridad.inactividad_min',
  'nomina.smmlv',
]);

@Injectable()
export class ParametrosService {
  constructor(
    private readonly almacen: AlmacenService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /** Valor vigente en una fecha; si no hay registro, el valor por defecto. */
  valor<K extends ClaveParametro>(clave: K, fecha = hoyBogota()): (typeof PARAMETROS_DEFECTO)[K] {
    const p = this.almacen.parametros.buscar(
      (x) => x.clave === clave && x.vigenteDesde <= fecha && (x.vigenteHasta === null || x.vigenteHasta >= fecha),
    );
    return (p?.valor ?? PARAMETROS_DEFECTO[clave]) as (typeof PARAMETROS_DEFECTO)[K];
  }

  vigentes(fecha = hoyBogota()): ParametroDto[] {
    return (Object.keys(PARAMETROS_DEFECTO) as ClaveParametro[]).map((clave) => {
      const p = this.almacen.parametros.buscar(
        (x) => x.clave === clave && x.vigenteDesde <= fecha && (x.vigenteHasta === null || x.vigenteHasta >= fecha),
      );
      return p ? aDto(p) : { clave, valor: PARAMETROS_DEFECTO[clave], vigenteDesde: '2025-01-01', vigenteHasta: null };
    });
  }

  historial(): ParametroDto[] {
    return this.almacen.parametros
      .todos()
      .sort((a, b) => a.clave.localeCompare(b.clave) || a.vigenteDesde.localeCompare(b.vigenteDesde))
      .map(aDto);
  }

  /**
   * Crea una nueva vigencia. No se sobrescribe la historia: la vigencia anterior se cierra el día antes
   * y, si ya hay una posterior programada (ej. recargo dominical 100 % en 2027), la nueva termina antes de ella.
   */
  async crear(clave: string, valor: ValorParametro, vigenteDesde: string, actorId: string): Promise<ParametroDto> {
    if (!(clave in PARAMETROS_DEFECTO)) throw new BadRequestException(`El parámetro "${clave}" no existe.`);
    const defecto = PARAMETROS_DEFECTO[clave as ClaveParametro];
    if (typeof valor !== typeof defecto) {
      throw new BadRequestException(`El valor de "${clave}" debe ser de tipo ${typeof defecto === 'number' ? 'número' : typeof defecto === 'boolean' ? 'sí/no' : 'texto'}.`);
    }
    if (typeof valor === 'number' && (!Number.isFinite(valor) || valor < 0)) throw new BadRequestException('El valor no puede ser negativo.');
    // Con 0 en estos, el valor de la hora sería infinito o la sesión se cerraría al instante.
    if (typeof valor === 'number' && valor === 0 && MAYORES_QUE_CERO.has(clave)) throw new BadRequestException(`El valor de "${clave}" debe ser mayor que 0.`);
    if (typeof defecto === 'string' && /^\d{2}:\d{2}$/.test(defecto) && !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(valor))) {
      throw new BadRequestException('La hora debe tener el formato HH:mm.');
    }

    const existentes = this.almacen.parametros.filtrar((p) => p.clave === clave).sort((a, b) => a.vigenteDesde.localeCompare(b.vigenteDesde));
    if (existentes.some((p) => p.vigenteDesde === vigenteDesde)) {
      throw new BadRequestException(`Ya existe una vigencia de "${clave}" que empieza el ${vigenteDesde}.`);
    }
    const anterior = existentes.filter((p) => p.vigenteDesde < vigenteDesde).at(-1);
    const siguiente = existentes.find((p) => p.vigenteDesde > vigenteDesde);

    if (anterior) await this.almacen.parametros.actualizar(anterior.id, (p) => ({ ...p, vigenteHasta: diaAnterior(vigenteDesde) }));
    const nuevo = await this.almacen.parametros.insertar({
      id: `${clave}@${vigenteDesde}`,
      clave,
      valor,
      vigenteDesde,
      vigenteHasta: siguiente ? diaAnterior(siguiente.vigenteDesde) : null,
    });
    await this.auditoria.registrar({ actorId, accion: 'PARAMETRO_CREADO', entidad: 'parametro', entidadId: nuevo.id, antes: anterior && aDto(anterior), despues: aDto(nuevo) });
    return aDto(nuevo);
  }
}
