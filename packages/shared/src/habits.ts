/**
 * Módulo HÁBITOS DIARIOS (`AppState.dailyHabits`). Se sincroniza dentro de la
 * colección `calendar` como registro singleton (kind 'dailyHabits', id = DAILY_HABITS_RECORD_ID).
 * Solo aditivo tras la Ola 1: edita únicamente este archivo.
 */
import { z } from 'zod';

export const DailyHabitsSchema = z.object({
  waterMl: z.number(),
  targetWaterMl: z.number(),
  sleepHours: z.number(),
  targetSleepHours: z.number(),
  pomodorosDone: z.number(),
  targetPomodoros: z.number(),
  lastUpdatedDate: z.string().optional(),
});
export type DailyHabits = z.infer<typeof DailyHabitsSchema>;

export const DAILY_HABITS_RECORD_ID = 'daily-habits';
