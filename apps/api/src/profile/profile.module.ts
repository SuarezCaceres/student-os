import { Module } from '@nestjs/common';
import { ProfileController } from './profile.controller';

// Agente SYNC-API rellena este modulo; no editar app.module.ts
@Module({
  controllers: [ProfileController],
})
export class ProfileModule {}
