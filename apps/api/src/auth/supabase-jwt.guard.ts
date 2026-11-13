import { CanActivate, ExecutionContext, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedRequest } from './auth.types';
import { JwtVerifierService } from './jwt-verifier.service';
import { IS_PUBLIC_KEY } from './public.decorator';

/** Guard global: exige `Authorization: Bearer <access token de Supabase>` salvo en rutas `@Public()`. */
@Injectable()
export class SupabaseJwtGuard implements CanActivate {
  private readonly logger = new Logger(SupabaseJwtGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly verifier: JwtVerifierService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') {
      return true;
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractBearerToken(request.headers.authorization);
    if (!token) {
      throw new UnauthorizedException('Token de acceso requerido');
    }

    try {
      request.user = await this.verifier.verify(token);
      return true;
    } catch (error) {
      // El motivo exacto (expirado, aud/iss incorrecto, firma) va al log, nunca a la respuesta.
      const reason = error instanceof Error ? error.name : 'Error';
      this.logger.debug(`JWT rechazado: ${reason}`);
      throw new UnauthorizedException('Token invalido o expirado');
    }
  }

  private extractBearerToken(header: string | undefined): string | null {
    if (!header) return null;
    const [scheme, token, ...rest] = header.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token || rest.length > 0) return null;
    return token;
  }
}
