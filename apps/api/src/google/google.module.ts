import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleApiClient } from './google-api.client';
import { GoogleConfig } from './google.config';
import { GOOGLE_CLOCK, GOOGLE_REPOSITORY } from './google.constants';
import { GoogleController } from './google.controller';
import { GoogleService } from './google.service';
import { PrismaGoogleRepository } from './prisma-google.repository';

/**
 * Sync persistente de Google Calendar: el servidor guarda el refresh token cifrado (AES-256-GCM) y llama a Calendar.
 * `GoogleService` registra su gancho de borrado de cuenta (`registerAccountDeletionHook`) en `onModuleInit`.
 * Repositorio y reloj son intercambiables por token (pruebas).
 */
@Module({
  controllers: [GoogleController],
  providers: [
    GoogleConfig,
    GoogleApiClient,
    GoogleService,
    {
      provide: GOOGLE_REPOSITORY,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => new PrismaGoogleRepository(prisma),
    },
    { provide: GOOGLE_CLOCK, useValue: () => Date.now() },
  ],
  exports: [GoogleService],
})
export class GoogleModule {}
