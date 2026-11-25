/**
 * Módulo CALENDARIO. Colección de sync: `calendar` (registros heterogéneos, discriminados por `kind`).
 *
 * Mapeo AppState -> registros de sync (todos con `data = { kind, value }`):
 *   calendarBlocks -> kind 'block'       id = block.id
 *   workShift      -> kind 'workShift'   id = WORK_SHIFT_RECORD_ID   (singleton, ver workShift.ts)
 *   dailyHabits    -> kind 'dailyHabits' id = DAILY_HABITS_RECORD_ID (singleton, ver habits.ts)
 *   chores         -> kind 'chore'         id = chore.id                   (spec 012, ver chores.ts)
 *   choreDays      -> kind 'choreDay'      id = choreDayRecordId(date)     (ver chores.ts)
 *   choreSettings  -> kind 'choreSettings' id = CHORE_SETTINGS_RECORD_ID   (singleton, ver chores.ts)
 *
 * Solo aditivo tras la Ola 1: edita únicamente este archivo.
 */
import { z } from 'zod';
import { CategorySchema, DayOfWeekSchema } from './common';
import { ChoreDaySchema, ChoreSchema, ChoreSettingsSchema } from './chores';
import { DailyHabitsSchema } from './habits';
import { WorkShiftConfigSchema } from './workShift';

export const CalendarBlockSchema = z.object({
  id: z.string(),
  day: DayOfWeekSchema,
  startTime: z.string(),
  endTime: z.string(),
  title: z.string(),
  category: CategorySchema,
  location: z.string().optional(),
  googleEventId: z.string().optional(),
  googleHtmlLink: z.string().optional(),
  reminderMinutes: z.array(z.number()).optional(),
  syncWithGoogle: z.boolean().optional(),
  isRecurringWorkShift: z.boolean().optional(),
});
export type CalendarBlock = z.infer<typeof CalendarBlockSchema>;

export const CALENDAR_RECORD_KINDS = ['block', 'workShift', 'dailyHabits', 'chore', 'choreDay', 'choreSettings'] as const;
export type CalendarRecordKind = (typeof CALENDAR_RECORD_KINDS)[number];

/** Esquema de `SyncRecord.data` para la colección `calendar`. */
export const CalendarRecordDataSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('block'), value: CalendarBlockSchema }),
  z.object({ kind: z.literal('workShift'), value: WorkShiftConfigSchema }),
  z.object({ kind: z.literal('dailyHabits'), value: DailyHabitsSchema }),
  z.object({ kind: z.literal('chore'), value: ChoreSchema }),
  z.object({ kind: z.literal('choreDay'), value: ChoreDaySchema }),
  z.object({ kind: z.literal('choreSettings'), value: ChoreSettingsSchema }),
]);
export type CalendarRecordData = z.infer<typeof CalendarRecordDataSchema>;
