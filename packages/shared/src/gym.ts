/**
 * Módulo GYM. Colección de sync: `gym` (registros heterogéneos, discriminados por `kind`).
 *
 * Mapeo AppState -> registros de sync (todos con `data = { kind, value }`):
 *   gymRoutines                -> kind 'routine'        id = routine.id
 *   gymProfile                 -> kind 'profile'        id = GYM_PROFILE_RECORD_ID (singleton)
 *   weightHistory              -> kind 'weightEntry'    id = weightEntryRecordId(date) (1 por fecha)
 *   gymAttendanceLogs          -> kind 'attendanceLog'  id = log.id
 *   dismissedGymScheduleAlerts -> kind 'dismissedAlert' id = dismissedAlertRecordId(date); value = date
 *   gymDisabled                -> kind 'preference'     id = GYM_PREFERENCE_RECORD_ID (singleton); solo existe si el gym esta desactivado
 *
 * Solo aditivo tras la Ola 1: edita únicamente este archivo.
 */
import { z } from 'zod';
import { DayOfWeekSchema } from './common';

// --- Ejercicios y rutinas ---------------------------------------------------

export const ExerciseHistoryEntrySchema = z.object({
  date: z.string(),
  weightKg: z.number(),
  reps: z.string(),
});
export type ExerciseHistoryEntry = z.infer<typeof ExerciseHistoryEntrySchema>;

export const ExerciseTechniqueGuideSchema = z.object({
  videoUrl: z.string().optional(),
  posterUrl: z.string().optional(),
  muscleGroups: z.array(z.string()),
  setupCues: z.array(z.string()),
  executionCues: z.array(z.string()),
  breathingCues: z.string(),
  commonMistakes: z.array(z.string()),
});
export type ExerciseTechniqueGuide = z.infer<typeof ExerciseTechniqueGuideSchema>;

export const GymExerciseSchema = z.object({
  id: z.string(),
  name: z.string(),
  sets: z.number(),
  reps: z.string(),
  weightKg: z.number().optional(),
  completedSets: z.array(z.boolean()),
  notes: z.string().optional(),
  personalRecordKg: z.number().optional(),
  restSeconds: z.number().optional(),
  history: z.array(ExerciseHistoryEntrySchema).optional(),
  technique: ExerciseTechniqueGuideSchema.optional(),
  thumbnailUrl: z.string().optional(),
});
export type GymExercise = z.infer<typeof GymExerciseSchema>;

export const GymRoutineSchema = z.object({
  id: z.string(),
  name: z.string(),
  dayOfWeek: DayOfWeekSchema,
  tag: z.string(),
  exercises: z.array(GymExerciseSchema),
});
export type GymRoutine = z.infer<typeof GymRoutineSchema>;

// --- Perfil de gym e historial de peso -------------------------------------

export const GymTypeSchema = z.enum(['smart_fit', 'utp', 'barrio', 'casa', 'otro']);
export type GymType = z.infer<typeof GymTypeSchema>;

export const FitnessGoalSchema = z.enum(['hipertrofia', 'fuerza', 'perdida_grasa', 'salud']);
export type FitnessGoal = z.infer<typeof FitnessGoalSchema>;

export const FitnessExperienceSchema = z.enum(['principiante', 'intermedio', 'avanzado']);
export type FitnessExperience = z.infer<typeof FitnessExperienceSchema>;

export const BmiCategorySchema = z.enum(['bajo_peso', 'normal', 'sobrepeso', 'obesidad']);
export type BmiCategory = z.infer<typeof BmiCategorySchema>;

export const GymSessionDurationMinutesSchema = z.union([z.literal(60), z.literal(90), z.literal(120)]);
export type GymSessionDurationMinutes = z.infer<typeof GymSessionDurationMinutesSchema>;

export const UserGymProfileSchema = z.object({
  gymType: GymTypeSchema,
  customGymName: z.string().optional(),
  trainingDaysCount: z.number(), // 2 | 3 | 4 | 5 | 6 (el tipo original es number)
  selectedDays: z.array(DayOfWeekSchema),
  goal: FitnessGoalSchema,
  experience: FitnessExperienceSchema,
  heightCm: z.number(),
  weightKg: z.number(),
  targetWeightKg: z.number().optional(),
  bmi: z.number(),
  bmiCategory: BmiCategorySchema,
  reminderMinutesBefore: z.array(z.number()).optional(),
  defaultSessionMinutes: GymSessionDurationMinutesSchema.optional(),
  configuredAt: z.string(),
});
export type UserGymProfile = z.infer<typeof UserGymProfileSchema>;

export const WeightHistoryEntrySchema = z.object({
  date: z.string(), // YYYY-MM-DD
  weightKg: z.number(),
  bmi: z.number(),
});
export type WeightHistoryEntry = z.infer<typeof WeightHistoryEntrySchema>;

// --- Asistencia -------------------------------------------------------------

export const MissReasonIdSchema = z.enum([
  'estudios_examenes',
  'cansancio_sueno',
  'trabajo_horarios',
  'salud_lesion',
  'tiempo_transporte',
  'otro',
]);
export type MissReasonId = z.infer<typeof MissReasonIdSchema>;

export const GymSessionStatusSchema = z.enum([
  'idle',
  'in_progress',
  'completed',
  'missed',
  'rescheduled',
]);
export type GymSessionStatus = z.infer<typeof GymSessionStatusSchema>;

export const GymAttendanceLogSchema = z.object({
  id: z.string(),
  date: z.string(), // hora local YYYY-MM-DD
  dayOfWeek: DayOfWeekSchema,
  routineId: z.string(),
  routineName: z.string(),
  status: GymSessionStatusSchema,
  startedAt: z.string().optional(),
  finishedAt: z.string().optional(),
  durationMinutes: z.number().optional(),
  missReason: MissReasonIdSchema.optional(),
  missNote: z.string().optional(),
  encouragementMessage: z.string().optional(),
  rescheduledToDay: DayOfWeekSchema.optional(),
  rescheduledToDate: z.string().optional(),
  rescheduledSlotStart: z.string().optional(),
  rescheduledSlotEnd: z.string().optional(),
  rescheduledCalendarBlockId: z.string().optional(),
  googleEventId: z.string().optional(),
  reminderMinutes: z.array(z.number()).optional(),
  streakProtected: z.boolean().optional(),
});
export type GymAttendanceLog = z.infer<typeof GymAttendanceLogSchema>;

// --- Alertas descartadas ----------------------------------------------------

/** Fecha ISO `YYYY-MM-DD` de una alerta de agenda de gym descartada (semántica de conjunto). */
export const DismissedGymScheduleAlertSchema = z.string();
export type DismissedGymScheduleAlert = z.infer<typeof DismissedGymScheduleAlertSchema>;

// --- Registros de sync de la colección `gym` -------------------------------

/** Preferencia del usuario sobre el modulo de gym (`gymDisabled` en AppState). Ausente = gym activo. */
export const GymPreferenceSchema = z.object({ disabled: z.boolean() });
export type GymPreference = z.infer<typeof GymPreferenceSchema>;

export const GYM_PROFILE_RECORD_ID = 'gym-profile';
export const GYM_PREFERENCE_RECORD_ID = 'gym-preference';
export const weightEntryRecordId = (date: string): string => `weight-${date}`;
export const dismissedAlertRecordId = (date: string): string => `dismissed-${date}`;

export const GYM_RECORD_KINDS = [
  'routine',
  'profile',
  'weightEntry',
  'attendanceLog',
  'dismissedAlert',
  'preference',
] as const;
export type GymRecordKind = (typeof GYM_RECORD_KINDS)[number];

/** Esquema de `SyncRecord.data` para la colección `gym`. */
export const GymRecordDataSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('routine'), value: GymRoutineSchema }),
  z.object({ kind: z.literal('profile'), value: UserGymProfileSchema }),
  z.object({ kind: z.literal('weightEntry'), value: WeightHistoryEntrySchema }),
  z.object({ kind: z.literal('attendanceLog'), value: GymAttendanceLogSchema }),
  z.object({ kind: z.literal('dismissedAlert'), value: DismissedGymScheduleAlertSchema }),
  z.object({ kind: z.literal('preference'), value: GymPreferenceSchema }),
]);
export type GymRecordData = z.infer<typeof GymRecordDataSchema>;
