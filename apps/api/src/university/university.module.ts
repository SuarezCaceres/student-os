import { Module } from '@nestjs/common';
import { UniversityController } from './university.controller';

// Agente KANBAN-UNI rellena este modulo; no editar app.module.ts
@Module({
  controllers: [UniversityController],
})
export class UniversityModule {}
