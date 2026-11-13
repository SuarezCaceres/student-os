import { Module } from '@nestjs/common';
import { GymController } from './gym.controller';

// Agente GYM rellena este modulo; no editar app.module.ts
@Module({
  controllers: [GymController],
})
export class GymModule {}
