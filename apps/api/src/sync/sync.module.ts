import { Module } from '@nestjs/common';
import { ProfileModule } from '../profile/profile.module';
import { PrismaSyncRepository } from './prisma-sync.repository';
import { SYNC_REPOSITORY } from './sync.constants';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';

/**
 * Motor de sync. Exporta `SyncService` (con `deleteAllForUser(userId)`) para el agente PUBLIC.
 * El repositorio es intercambiable via el token `SYNC_REPOSITORY` (los tests usan la version en memoria).
 */
@Module({
  imports: [ProfileModule],
  controllers: [SyncController],
  providers: [SyncService, { provide: SYNC_REPOSITORY, useClass: PrismaSyncRepository }],
  exports: [SyncService],
})
export class SyncModule {}
