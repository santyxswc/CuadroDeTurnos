import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  /** Documento o correo. */
  @IsString()
  @IsNotEmpty({ message: 'Escribe tu usuario.' })
  @MaxLength(120)
  usuario: string;

  @IsString()
  @IsNotEmpty({ message: 'Escribe tu contraseña.' })
  @MaxLength(200)
  password: string;

  /** Nombre del equipo desde el que se entra (control, RF-ASI-06). */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  equipo?: string;
}

export class RefrescarDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  tokenRefresco: string;
}

export class CambiarPasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'Escribe tu contraseña actual.' })
  @MaxLength(200)
  actual: string;

  @IsString()
  @MaxLength(200)
  nueva: string;
}
