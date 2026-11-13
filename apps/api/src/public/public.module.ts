import { Module } from '@nestjs/common';
import { PublicController } from './public.controller';

// Agente PUBLIC rellena este modulo; no editar app.module.ts
@Module({
  controllers: [PublicController],
})
export class PublicModule {}
