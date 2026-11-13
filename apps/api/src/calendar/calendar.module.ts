import { Module } from '@nestjs/common';
import { CalendarController } from './calendar.controller';

// Agente CALENDAR rellena este modulo; no editar app.module.ts
@Module({
  controllers: [CalendarController],
})
export class CalendarModule {}
