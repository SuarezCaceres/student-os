import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Response } from 'express';
import { Observable } from 'rxjs';

/**
 * Cabeceras de seguridad ADICIONALES a las de `helmet` (que ya pone HSTS, nosniff, frameguard, COOP/CORP,
 * `Referrer-Policy: no-referrer`, etc. en `app.setup.ts`):
 *
 *  - `Cache-Control: no-store` si la ruta no definio otra: las respuestas autenticadas llevan datos personales
 *    y no deben quedar en caches compartidas ni en el historial del navegador.
 *  - `Permissions-Policy`: una API JSON no necesita ningun permiso del navegador.
 *  - `X-Robots-Tag: noindex, nofollow`: la API no debe indexarse.
 *
 * No cambia el comportamiento ni el cuerpo de ninguna ruta. Uso: `@UseInterceptors(SecurityHeadersInterceptor)`
 * en un controlador, o `APP_INTERCEPTOR` si el Integrador decide aplicarlo a toda la API.
 */
export const EXTRA_SECURITY_HEADERS: Readonly<Record<string, string>> = {
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  'X-Robots-Tag': 'noindex, nofollow',
};

export function applyExtraSecurityHeaders(response: Pick<Response, 'setHeader' | 'getHeader'>): void {
  for (const [name, value] of Object.entries(EXTRA_SECURITY_HEADERS)) {
    response.setHeader(name, value);
  }
  if (response.getHeader('Cache-Control') === undefined) {
    response.setHeader('Cache-Control', 'no-store');
  }
}

@Injectable()
export class SecurityHeadersInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() === 'http') {
      applyExtraSecurityHeaders(context.switchToHttp().getResponse<Response>());
    }
    return next.handle();
  }
}
