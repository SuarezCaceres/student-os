import { Module } from '@nestjs/common';
import { SyncController } from './sync.controller';

// Agente SYNC-API rellena este modulo; no editar app.module.ts
@Module({
  controllers: [SyncController],
})
export class SyncModule {}
