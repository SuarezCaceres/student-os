/**
 * Módulo TURNO LABORAL (`AppState.workShift`). Se sincroniza dentro de la
 * colección `calendar` como registro singleton (kind 'workShift', id = WORK_SHIFT_RECORD_ID).
 * Solo aditivo tras la Ola 1: edita únicamente este archivo.
 */
import { z } from 'zod';
import { DayOfWeekSchema } from './common';

export const WorkShiftConfigSchema = z.object({
  enabled: z.boolean(),
  title: z.string(),
  startTime: z.string(), // HH:mm
  endTime: z.string(), // HH:mm (<= startTime indica turno nocturno que termina al día siguiente)
  restDay: DayOfWeekSchema.nullable(), // Noche en que NO empieza turno (p. ej. Jueves 22:00 -> Viernes 06:00)
  location: z.string().optional(),
  reminderMinutes: z.array(z.number()).optional(),
  syncWithGoogle: z.boolean().optional(),
});
export type WorkShiftConfig = z.infer<typeof WorkShiftConfigSchema>;

export const WORK_SHIFT_RECORD_ID = 'work-shift';
