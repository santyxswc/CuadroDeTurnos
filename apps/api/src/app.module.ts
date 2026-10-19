import { Module, type DynamicModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AlmacenModule } from './almacen/almacen.module';
import { AtencionesController } from './atenciones/atenciones.controller';
import { AuditoriaController } from './auditoria/auditoria.controller';
import { AuditoriaService } from './auditoria/auditoria.service';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { AutenticacionGuard } from './auth/autenticacion.guard';
import { CONFIG, type ConfigSgt } from './config';
import { CuadrosController } from './cuadros/cuadros.controller';
import { CuadrosService } from './cuadros/cuadros.service';
import { FestivosController } from './festivos/festivos.controller';
import { MarcacionesController } from './marcaciones/marcaciones.controller';
import { MarcacionesService } from './marcaciones/marcaciones.service';
import { ParametrosController } from './parametros/parametros.controller';
import { ParametrosService } from './parametros/parametros.service';
import { SaludModule } from './salud/salud.module';
import { EventosGateway } from './tiempo-real/eventos.gateway';
import { TiposTurnoController } from './tipos-turno/tipos-turno.controller';
import { UsuariosController } from './usuarios/usuarios.controller';
import { UsuariosService } from './usuarios/usuarios.service';

@Module({})
export class AppModule {
  static registrar(config: ConfigSgt): DynamicModule {
    return {
      module: AppModule,
      imports: [{ module: ConfigModule, global: true, providers: [{ provide: CONFIG, useValue: config }], exports: [CONFIG] }, AlmacenModule, SaludModule],
      controllers: [
        AuthController,
        UsuariosController,
        TiposTurnoController,
        ParametrosController,
        FestivosController,
        AuditoriaController,
        CuadrosController,
        MarcacionesController,
        AtencionesController,
      ],
      providers: [
        {
          provide: JwtService,
          useFactory: () => new JwtService({ secret: config.secretoJwt, signOptions: { expiresIn: `${config.minutosTokenAcceso}m` } }),
        },
        AuditoriaService,
        EventosGateway,
        ParametrosService,
        CuadrosService,
        MarcacionesService,
        AuthService,
        UsuariosService,
        // Todas las rutas requieren sesión salvo las marcadas con @Publico().
        { provide: APP_GUARD, useClass: AutenticacionGuard },
      ],
    };
  }
}

@Module({})
class ConfigModule {}
