# Política de seguridad

## Mantenedor

| Rol | Nombre | GitHub |
|-----|--------|--------|
| Mantenedor principal | Santiago Caicedo | [@santyxswc](https://github.com/santyxswc) |

Santiago Caicedo es el autor y mantenedor principal de TurnoCare (SGT) y quien recibe, evalúa y corrige los reportes de seguridad.

## Versiones soportadas

| Versión | Soporte |
|---------|---------|
| 0.1.x (rama `main` / última release) | Sí |

## Reportar una vulnerabilidad

TurnoCare maneja datos de personal de enfermería y de pacientes, así que los problemas de seguridad se tratan con prioridad. **No** abras un issue público con los detalles.

- Usa el reporte privado de GitHub: [**Report a vulnerability**](https://github.com/santyxswc/CuadroDeTurnos/security/advisories/new), o
- escribe directamente al mantenedor principal, [@santyxswc](https://github.com/santyxswc), por un canal privado.

Incluye, si es posible: pasos para reproducir, componente afectado (app de escritorio o API), impacto estimado y versión.

### Qué esperar

- Confirmación de recibido en un máximo de **72 horas**.
- Una primera evaluación (si se acepta y su gravedad) en un máximo de **7 días**.
- Las correcciones se publican en una nueva release del instalador y, cuando aplica, con un aviso de seguridad (GitHub Security Advisory) que da crédito a quien reportó, si así lo desea.

## Alcance

Son de especial interés los reportes sobre:

- Inicio de sesión, sesiones y control de roles (coordinador / enfermero) en la API.
- Almacenamiento de contraseñas (Argon2id).
- Cifrado de datos de pacientes (AES-256-GCM) y manejo de la llave.
- Acceso a los archivos de datos sin pasar por la API.

## Secretos

- No incluyas la llave de cifrado, contraseñas ni archivos de la carpeta de datos en issues, PRs ni mensajes.
- La llave de cifrado va en una variable de entorno, nunca en el repositorio ni en la carpeta de datos.
- Si publicas una credencial por error, rótala de inmediato.
