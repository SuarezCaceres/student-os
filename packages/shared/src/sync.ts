/**
 * Protocolo de sync común (web <-> api). Solo aditivo tras la Ola 1.
 *
 * Modelo: cada entidad (o singleton) de `AppState` viaja como un `SyncRecord`
 * dentro de una de las 6 colecciones. El servidor manda: última edición gana
 * por `updatedAt`; el borrado es lógico (`deletedAt`); el cliente es idempotente
 * por `id` + `collection`.
 *
 * Reglas de id: el `id` del registro es el id de la entidad ya existente
 * (p. ej. `k1`, `cb-1`, `gym-mon`) o un UUID para entidades nuevas. NO se impone
 * uuid porque el estado inicial/legacy no los usa; solo string no vacío.
 * Unicidad en servidor: (userId, collection, id).
 */
import { z } from 'zod';
import type { AppState } from './appState';
import { CalendarRecordDataSchema } from './calendar';
import { GymRecordDataSchema } from './gym';
import { KanbanRecordDataSchema } from './kanban';
import { LearningRecordDataSchema } from './learning';
import { ProfileRecordDataSchema } from './profile';
import { UniversityRecordDataSchema } from './university';

// --- Colecciones ------------------------------------------------------------

export const COLLECTIONS = ['profile', 'kanban', 'university', 'learning', 'gym', 'calendar'] as const;
export const CollectionSchema = z.enum(COLLECTIONS);
export type Collection = z.infer<typeof CollectionSchema>;

/** Colección a la que pertenece cada campo de nivel superior de `AppState`. */
export const APP_STATE_TO_COLLECTION: Record<keyof AppState, Collection> = {
  // profile
  studentName: 'profile',
  career: 'profile',
  currentAcademicWeek: 'profile',
  streak: 'profile',
  theme: 'profile',
  // kanban
  kanbanItems: 'kanban',
  // university
  universityAssignments: 'university',
  // learning
  weeklyReflections: 'learning',
  // gym
  gymRoutines: 'gym',
  gymProfile: 'gym',
  weightHistory: 'gym',
  gymAttendanceLogs: 'gym',
  dismissedGymScheduleAlerts: 'gym',
  gymDisabled: 'gym',
  // calendar
  calendarBlocks: 'calendar',
  workShift: 'calendar',
  dailyHabits: 'calendar',
  chores: 'calendar',
  choreDays: 'calendar',
  choreSettings: 'calendar',
};

/** Esquema de `SyncRecord.data` por colección. */
export const COLLECTION_DATA_SCHEMA = {
  profile: ProfileRecordDataSchema,
  kanban: KanbanRecordDataSchema,
  university: UniversityRecordDataSchema,
  learning: LearningRecordDataSchema,
  gym: GymRecordDataSchema,
  calendar: CalendarRecordDataSchema,
} as const satisfies Record<Collection, z.ZodType>;

// --- Límites ----------------------------------------------------------------

export const MAX_RECORD_ID_LENGTH = 200;
/** Máximo de cambios por `POST /sync/push`. */
export const MAX_PUSH_CHANGES = 500;
/** Máximo de registros por página de `GET /sync/pull`. */
export const MAX_PULL_LIMIT = 1000;

// --- SyncRecord -------------------------------------------------------------

const RecordIdSchema = z.string().min(1).max(MAX_RECORD_ID_LENGTH);
const IsoDateTimeSchema = z.iso.datetime({ offset: true });

/**
 * Envoltorio SIN validar `data` (barato; útil para colas/logs).
 * Preferir `SyncRecordSchema`, que valida `data` según `collection`.
 */
export const SyncRecordEnvelopeSchema = z.object({
  id: RecordIdSchema,
  collection: CollectionSchema,
  data: z.unknown(),
  updatedAt: IsoDateTimeSchema,
  deletedAt: IsoDateTimeSchema.nullable(),
  rev: z.number().int().nonnegative(),
});

/**
 * Registro de sync. `data` se valida con `COLLECTION_DATA_SCHEMA[collection]`,
 * salvo en tombstones (`deletedAt !== null`), donde `data` puede ser `null`
 * o la última versión conocida y no se valida.
 */
export const SyncRecordSchema = SyncRecordEnvelopeSchema.superRefine((record, ctx) => {
  if (record.deletedAt !== null) return;
  const result = COLLECTION_DATA_SCHEMA[record.collection].safeParse(record.data);
  if (!result.success) {
    for (const issue of result.error.issues) {
      ctx.addIssue({
        code: 'custom',
        message: issue.message,
        path: ['data', ...issue.path],
      });
    }
  }
});
export type SyncRecord = z.infer<typeof SyncRecordSchema>;

/** Valida `data` de una colección; devuelve el resultado de `safeParse` de zod. */
export function validateRecordData(collection: Collection, data: unknown) {
  return COLLECTION_DATA_SCHEMA[collection].safeParse(data);
}

// --- Pull -------------------------------------------------------------------

/** Query de `GET /sync/pull`. `since` es un cursor opaco devuelto por el pull previo. */
export const SyncPullQuerySchema = z.object({
  since: z.string().min(1).optional(),
  collection: CollectionSchema.optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PULL_LIMIT).optional(),
});
export type SyncPullQuery = z.infer<typeof SyncPullQuerySchema>;

export const SyncPullResponseSchema = z.object({
  records: z.array(SyncRecordSchema),
  /** Cursor opaco para el siguiente pull (`since`). */
  cursor: z.string(),
  /** true si hay más registros por traer (repetir el pull con `cursor`). */
  hasMore: z.boolean().default(false),
});
export type SyncPullResponse = z.infer<typeof SyncPullResponseSchema>;

// --- Push -------------------------------------------------------------------

export const SyncPushRequestSchema = z.object({
  changes: z.array(SyncRecordSchema).max(MAX_PUSH_CHANGES),
});
export type SyncPushRequest = z.infer<typeof SyncPushRequestSchema>;

export const SyncPushResponseSchema = z.object({
  /** Ids de los cambios aplicados (idempotente: reenviar un cambio ya aplicado también lo lista). */
  applied: z.array(RecordIdSchema),
  /** Versión vigente del servidor para los cambios rechazados por ser más antiguos. */
  conflicts: z.array(SyncRecordSchema),
});
export type SyncPushResponse = z.infer<typeof SyncPushResponseSchema>;
