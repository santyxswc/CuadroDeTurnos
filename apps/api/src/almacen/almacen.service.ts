import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { join } from 'node:path';
import { CONFIG, type ConfigSgt } from '../config';
import { ColeccionJson, RegistroJsonl } from './archivo-json';
import type {
  CuadroGuardado,
  EventoAuditoria,
  FestivoGuardado,
  MarcacionGuardada,
  ParametroGuardado,
  SesionGuardada,
  TipoTurnoGuardado,
  UsuarioGuardado,
} from './modelos';
import { sembrar } from './semilla';

/** Punto único de acceso a los archivos de la carpeta de datos. */
@Injectable()
export class AlmacenService implements OnModuleInit {
  private readonly logger = new Logger('Almacen');
  readonly usuarios: ColeccionJson<UsuarioGuardado>;
  readonly sesiones: ColeccionJson<SesionGuardada>;
  readonly tiposTurno: ColeccionJson<TipoTurnoGuardado>;
  readonly parametros: ColeccionJson<ParametroGuardado>;
  readonly festivos: ColeccionJson<FestivoGuardado>;
  readonly cuadros: ColeccionJson<CuadroGuardado>;
  readonly marcaciones: ColeccionJson<MarcacionGuardada>;
  readonly auditoria: RegistroJsonl<EventoAuditoria>;

  constructor(@Inject(CONFIG) private readonly config: ConfigSgt) {
    const ruta = (archivo: string) => join(config.directorioDatos, archivo);
    this.usuarios = new ColeccionJson(ruta('usuarios.json'));
    this.sesiones = new ColeccionJson(ruta('sesiones.json'));
    this.tiposTurno = new ColeccionJson(ruta('tipos-turno.json'));
    this.parametros = new ColeccionJson(ruta('parametros.json'));
    this.festivos = new ColeccionJson(ruta('festivos.json'));
    this.cuadros = new ColeccionJson(ruta('cuadros.json'));
    this.marcaciones = new ColeccionJson(ruta('marcaciones.json'));
    this.auditoria = new RegistroJsonl(ruta('auditoria.jsonl'));
  }

  async onModuleInit() {
    await Promise.all([this.usuarios, this.sesiones, this.tiposTurno, this.parametros, this.festivos, this.cuadros, this.marcaciones].map((c) => c.cargar()));
    this.logger.log(`Datos cargados desde ${this.config.directorioDatos}`);
    await sembrar(this, this.config, this.logger);
  }
}
