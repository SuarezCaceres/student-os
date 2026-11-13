import { Module } from '@nestjs/common';
import { GoogleController } from './google.controller';

// Agente GOOGLE rellena este modulo; no editar app.module.ts
@Module({
  controllers: [GoogleController],
})
export class GoogleModule {}
