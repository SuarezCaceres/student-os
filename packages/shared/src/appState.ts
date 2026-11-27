/**
 * Esquema completo de `AppState` (equivalente a `AppState` de `src/types/index.ts`).
 * Es solo composición: no define entidades nuevas. Solo aditivo tras la Ola 1.
 *
 * Los esquemas por defecto descartan claves desconocidas (modo "strip" de zod).
 */
import { z } from 'zod';
import { DailyHabitsSchema } from './habits';
import { GymAttendanceLogSchema, GymRoutineSchema, UserGymProfileSchema, WeightHistoryEntrySchema } from './gym';
import { CalendarBlockSchema } from './calendar';
import { ChoreDaySchema, ChoreSchema, ChoreSettingsSchema } from './chores';
import { KanbanItemSchema } from './kanban';
import { WeeklyReflectionsMapSchema } from './learning';
import { ProfileSchema } from './profile';
import { UniversityAssignmentSchema } from './university';
import { WorkShiftConfigSchema } from './workShift';

export const AppStateSchema = z.object({
  // profile
  ...ProfileSchema.shape,
  // calendar
  dailyHabits: DailyHabitsSchema.optional(),
  workShift: WorkShiftConfigSchema.optional(),
  calendarBlocks: z.array(CalendarBlockSchema),
  // quehaceres diarios (spec 012; viajan por la colección `calendar`)
  chores: z.array(ChoreSchema).optional(),
  choreDays: z.array(ChoreDaySchema).optional(),
  choreSettings: ChoreSettingsSchema.optional(),
  // gym
  gymProfile: UserGymProfileSchema.optional(),
  weightHistory: z.array(WeightHistoryEntrySchema).optional(),
  gymAttendanceLogs: z.array(GymAttendanceLogSchema).optional(),
  dismissedGymScheduleAlerts: z.array(z.string()).optional(),
  /** `true` = el usuario dijo que no va al gimnasio (spec 011). Ausente o `false` = gym activo. */
  gymDisabled: z.boolean().optional(),
  gymRoutines: z.array(GymRoutineSchema),
  // learning
  weeklyReflections: WeeklyReflectionsMapSchema.optional(),
  // kanban
  kanbanItems: z.array(KanbanItemSchema),
  // university
  universityAssignments: z.array(UniversityAssignmentSchema),
});
export type AppState = z.infer<typeof AppStateSchema>;

/** Nombres de todos los campos de nivel superior de `AppState` (derivado del esquema). */
export const APP_STATE_FIELDS = Object.keys(AppStateSchema.shape) as ReadonlyArray<keyof AppState>;
