import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { AuthenticatedRequest, AuthUser } from './auth.types';

/**
 * Inyecta el usuario autenticado. `@CurrentUser()` devuelve `{ id, email }`;
 * `@CurrentUser('id')` devuelve solo ese campo.
 * Solo valido en rutas protegidas (no `@Public()`).
 */
export const CurrentUser = createParamDecorator(
  (field: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('Token de acceso requerido');
    }
    return field ? user[field] : user;
  },
);
