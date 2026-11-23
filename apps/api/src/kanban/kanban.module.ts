import { Module } from '@nestjs/common';
import { KanbanController } from './kanban.controller';

// Agente KANBAN-UNI rellena este modulo; no editar app.module.ts
@Module({
  controllers: [KanbanController],
})
export class KanbanModule {}
