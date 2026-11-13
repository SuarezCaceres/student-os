import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import type { Env } from './config/env.schema';

/**
 * Configuracion HTTP compartida por `main.ts` y los tests e2e (para probar lo mismo que corre).
 * Las rutas NO llevan prefijo `/api`: son `/health`, `/sync/...`, etc.
 */
export function configureApp(app: INestApplication): void {
  const nestApp = app as NestExpressApplication;
  const config = app.get(ConfigService<Env, true>);

  app.useLogger(app.get(Logger));

  // Render termina TLS en un proxy: sin esto, el rate limit veria siempre la IP del proxy.
  nestApp.set('trust proxy', 1);

  nestApp.disable('x-powered-by');
  app.use(helmet());

  // Limite de cuerpo explicito (SYNC-API lo ajusta por ruta si necesita mas).
  nestApp.useBodyParser('json', { limit: '1mb' });

  // CORS por lista blanca. Autenticacion por cabecera Bearer (sin cookies) => credentials desactivado.
  app.enableCors({
    origin: config.get('WEB_ORIGINS', { infer: true }),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'Accept', 'X-Request-Id'],
    exposedHeaders: ['Retry-After'],
    credentials: false,
    maxAge: 600,
  });

  app.enableShutdownHooks();
}
