import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import type { Env } from './config/env.schema';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  configureApp(app);

  const port = app.get(ConfigService<Env, true>).get('PORT', { infer: true });
  // 0.0.0.0: Render necesita escuchar en todas las interfaces.
  await app.listen(port, '0.0.0.0');
  app.get(Logger).log(`API escuchando en el puerto ${port}`, 'Bootstrap');
}

bootstrap().catch((error: unknown) => {
  // Fallo de arranque (p. ej. entorno invalido): mensaje legible y salida con codigo != 0.
  // eslint-disable-next-line no-console
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
