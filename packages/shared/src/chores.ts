/**
 * Módulo QUEHACERES DIARIOS (spec 012). Viaja dentro de la colección `calendar`
 * (no hay colección ni migración nuevas), discriminado por `kind`:
 *
 *   chores        -> kind 'chore'         id = chore.id                   (uno por quehacer)
 *   choreDays     -> kind 'choreDay'      id = choreDayRecordId(date)     (uno por día: historial)
 *   choreSettings -> kind 'choreSettings' id = CHORE_SETTINGS_RECORD_ID   (singleton)
 *
 * Solo aditivo: edita únicamente este archivo.
 */
import { z } from 'zod';
import { DayOfWeekSchema } from './common';

/** Máximo de quehaceres por usuario: mantiene usable la tarjeta y el registro de cada día pequeño. */
export const MAX_CHORES = 30;
export const MAX_CHORE_NAME_LENGTH = 80;
/** Cota defensiva de `completed` en un día (los quehaceres borrados a mitad de día siguen contando). */
export const MAX_COMPLETED_PER_DAY = 100;
export const MAX_CHORE_LEVELS = 10;
export const MAX_CHORE_LEVEL_MESSAGE_LENGTH = 120;
export const MAX_CHORE_LEVEL_MIN = 99;

export const CHORE_SETTINGS_RECORD_ID = 'chore-settings';
const CHORE_DAY_RECORD_PREFIX = 'chore-day-';
export const choreDayRecordId = (date: string): string => `${CHORE_DAY_RECORD_PREFIX}${date}`;
/** true si el id de registro pertenece al historial de quehaceres (`chore-day-AAAA-MM-DD`). */
export const isChoreDayRecordId = (id: string): boolean => id.startsWith(CHORE_DAY_RECORD_PREFIX);

const IsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Quehacer de la lista del usuario. `days` son los días de la semana en los que aplica. */
export const ChoreSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(MAX_CHORE_NAME_LENGTH),
  days: z.array(DayOfWeekSchema).max(7),
  order: z.number().int(),
});
export type Chore = z.infer<typeof ChoreSchema>;

/** Motivos opcionales de un «día difícil». */
export const ChoreHardReasonSchema = z.enum(['cansado', 'agobiado', 'enfermo', 'otro']);
export type ChoreHardReason = z.infer<typeof ChoreHardReasonSchema>;

/** Un quehacer completado en un día, con el nombre COPIADO (renombrar o borrar no cambia el pasado). */
export const ChoreCompletionSchema = z.object({
  choreId: z.string().min(1),
  name: z.string().max(MAX_CHORE_NAME_LENGTH),
});
export type ChoreCompletion = z.infer<typeof ChoreCompletionSchema>;

/** Historial de un día: qué se completó y si fue un día difícil («hoy no puedo»). */
export const ChoreDaySchema = z.object({
  date: IsoDateSchema, // fecha local YYYY-MM-DD
  completed: z.array(ChoreCompletionSchema).max(MAX_COMPLETED_PER_DAY),
  hard: z.boolean(),
  reason: ChoreHardReasonSchema.optional(),
});
export type ChoreDay = z.infer<typeof ChoreDaySchema>;

/** Nivel de motivación: al completar `min` quehaceres o más se muestra `message`. */
export const ChoreLevelSchema = z.object({
  min: z.number().int().min(1).max(MAX_CHORE_LEVEL_MIN),
  message: z.string().trim().min(1).max(MAX_CHORE_LEVEL_MESSAGE_LENGTH),
});
export type ChoreLevel = z.infer<typeof ChoreLevelSchema>;

/** Ajustes del módulo. `seeded` evita volver a sembrar la lista base si el usuario la borra. */
export const ChoreSettingsSchema = z.object({
  seeded: z.boolean(),
  levels: z.array(ChoreLevelSchema).max(MAX_CHORE_LEVELS),
});
export type ChoreSettings = z.infer<typeof ChoreSettingsSchema>;
