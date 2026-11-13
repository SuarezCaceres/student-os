import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { AuthenticatedRequest } from '../../auth/auth.types';

/** Nombre del limitador por usuario. Distinto de `default` (el global por IP) para no mezclar contadores. */
export const USER_THROTTLER = 'user';

/** Limite general por usuario cuando el guard se registra globalmente (peticiones por minuto). */
export const USER_THROTTLER_DEFAULT = { ttl: 60_000, limit: 300 } as const;

const TOO_MANY_REQUESTS_MESSAGE = 'Demasiadas solicitudes. Espera un poco e intentalo de nuevo.';

/**
 * Limitador de frecuencia POR USUARIO. Extiende el `ThrottlerGuard` de Nest:
 *
 *  - Tracker = `user:<sub del JWT>`; si la peticion aun no esta autenticada, respaldo por IP (`ip:<ip>`).
 *    El `sub` SOLO se toma de `request.user`, que rellena `SupabaseJwtGuard` tras verificar la firma:
 *    jamas se lee un token sin verificar (permitiria elegir el tracker y agotar el cupo de otro usuario).
 *  - Usa su propio limitador `user` y sus propios contadores, asi que NO se suma al limite global por IP
 *    (`default`) y es independiente de la configuracion de `ThrottlerModule` del modulo donde se instancie.
 *    Limites por ruta: `@Throttle({ user: { limit: 5, ttl: 600_000 } })`.
 *  - `Retry-After` estandar en las respuestas 429 (el limitador con nombre emitiria `Retry-After-user`).
 *
 * ORDEN: debe ejecutarse DESPUES de `SupabaseJwtGuard`. Los guards de controlador (`@UseGuards`) siempre van
 * despues de los globales, asi que `@UseGuards(UserThrottlerGuard)` es correcto; si se registra como
 * `APP_GUARD`, declararlo despues de `SupabaseJwtGuard` (ver docs/agent-notes/PUBLIC.md).
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected override errorMessage = TOO_MANY_REQUESTS_MESSAGE;

  override async onModuleInit(): Promise<void> {
    await super.onModuleInit();
    // Configuracion propia: ignora los limitadores del modulo anfitrion (p. ej. `default` de AppModule).
    this.throttlers = [{ name: USER_THROTTLER, ...USER_THROTTLER_DEFAULT }];
  }

  protected override async getTracker(req: Record<string, unknown>): Promise<string> {
    const userId = (req as unknown as AuthenticatedRequest).user?.id;
    if (typeof userId === 'string' && userId.length > 0) {
      return `user:${userId}`;
    }
    return `ip:${await super.getTracker(req)}`;
  }

  protected override setResponseHeader(res: Record<string, unknown>, name: string, value: string | number): void {
    super.setResponseHeader(res, name === `Retry-After-${USER_THROTTLER}` ? 'Retry-After' : name, value);
  }

  protected override async getErrorMessage(_context: ExecutionContext): Promise<string> {
    return TOO_MANY_REQUESTS_MESSAGE;
  }
}
