import type {
  DayOfWeek,
  FitnessGoal,
  GymAttendanceLog,
  GymRoutine,
  GymType,
  MissReasonId,
  UserGymProfile,
} from '../types';
import { getGymDisplayName, ORDERED_DAYS } from './routineGenerator';

const JS_DAYS_MAP: DayOfWeek[] = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
];

export const TARGET_WORKOUT_MINUTES = 120; // ~2 horas por sesión

export interface MissReasonOption {
  id: MissReasonId;
  label: string;
  description: string;
}

export const MISS_REASON_OPTIONS: MissReasonOption[] = [
  {
    id: 'estudios_examenes',
    label: 'Parciales o carga académica',
    description: 'Priorizaste entregas, laboratorios o exámenes de la universidad.',
  },
  {
    id: 'cansancio_sueno',
    label: 'Cansancio o falta de sueño',
    description: 'El cuerpo necesitaba descanso real para rendir sin lesionarse.',
  },
  {
    id: 'trabajo_horarios',
    label: 'Cruce con trabajo o prácticas',
    description: 'Se extendió la jornada o surgió un compromiso laboral.',
  },
  {
    id: 'salud_lesion',
    label: 'Malestar físico o salud',
    description: 'Resfrío, dolor articular o recuperación preventiva.',
  },
  {
    id: 'tiempo_transporte',
    label: 'Falta de tiempo o tráfico',
    description: 'El día se complicó en traslados o imprevistos.',
  },
  {
    id: 'otro',
    label: 'Otro motivo personal',
    description: 'Una situación puntual que te impidió ir esta vez.',
  },
];

export interface EncouragementFeedback {
  headline: string;
  body: string;
  tip: string;
}

export interface PendingMissedDay {
  dayOfWeek: DayOfWeek;
  date: string;
  routine: GymRoutine;
}

export type RescheduleMode = 'move_to_rest' | 'shift_schedule';

export interface RescheduleOption {
  targetDay: DayOfWeek;
  targetDate: string;
  mode: RescheduleMode;
  badge: string;
  title: string;
  subtitle: string;
  recommended: boolean;
  shiftSummary?: string[];
}

export interface RescheduleResult {
  updatedRoutines: GymRoutine[];
  rescheduledToDay: DayOfWeek;
  rescheduledToDate: string;
  movedRoutineName: string;
}

function padTwo(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Formats a Date into a location-agnostic local calendar string YYYY-MM-DD
 * without UTC offset drift (prevents late-evening west-of-UTC off-by-one days).
 */
export function getLocalIsoDate(referenceDate?: Date): string {
  if (!referenceDate) {
    const maybeTemporal = (
      globalThis as {
        Temporal?: { Now?: { plainDateISO?: () => { toString: () => string } } };
      }
    ).Temporal;
    const plainToday = maybeTemporal?.Now?.plainDateISO?.();
    if (plainToday) {
      return plainToday.toString();
    }
  }
  const d = referenceDate ?? new Date();
  return `${d.getFullYear()}-${padTwo(d.getMonth() + 1)}-${padTwo(d.getDate())}`;
}

/**
 * Converts an ISO timestamp or YYYY-MM-DD string to local YYYY-MM-DD.
 */
export function getLocalIsoDateFromTimestamp(value?: string): string | undefined {
  if (!value) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return getLocalIsoDate(parsed);
}

/**
 * Returns today's DayOfWeek in Spanish using the user's local clock.
 */
export function getTodayDayOfWeek(referenceDate = new Date()): DayOfWeek {
  return JS_DAYS_MAP[referenceDate.getDay()];
}

/**
 * Maps Lunes..Domingo of the current Mon-Sun week to local YYYY-MM-DD dates.
 */
export function getCurrentWeekDateMap(referenceDate = new Date()): Record<DayOfWeek, string> {
  const anchor = new Date(referenceDate);
  anchor.setHours(0, 0, 0, 0);
  const jsDay = anchor.getDay(); // 0=Sun, 1=Mon...
  const mondayOffset = jsDay === 0 ? -6 : 1 - jsDay;
  const monday = new Date(anchor);
  monday.setDate(anchor.getDate() + mondayOffset);

  const map = {} as Record<DayOfWeek, string>;
  ORDERED_DAYS.forEach((dayName, idx) => {
    const dayDate = new Date(monday);
    dayDate.setDate(monday.getDate() + idx);
    map[dayName] = getLocalIsoDate(dayDate);
  });

  return map;
}

/**
 * Formats an integer YYYY-MM-DD into a concise Spanish readable date like "Lun 12 nov".
 */
export function formatShortSpanishDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map((part) => Number(part));
  if (!y || !m || !d) return isoDate;
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${d} ${months[m - 1] ?? ''}`.trim();
}

/**
 * Formats elapsed seconds as HH:MM:SS for the live 2-hour workout timer.
 */
export function formatElapsedSeconds(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return `${padTwo(hours)}:${padTwo(minutes)}:${padTwo(seconds)}`;
}

/**
 * Builds an in_progress or completed attendance log entry outside component render scope.
 */
export function buildSessionAttendanceLog(params: {
  date: string;
  dayOfWeek: DayOfWeek;
  routineId: string;
  routineName: string;
  status: 'in_progress' | 'completed';
  durationMinutes?: number;
}): { nowMs: number; log: GymAttendanceLog } {
  const now = new Date();
  const nowIso = now.toISOString();
  return {
    nowMs: now.getTime(),
    log: {
      id: `att-${params.date}-${params.routineId}`,
      date: params.date,
      dayOfWeek: params.dayOfWeek,
      routineId: params.routineId,
      routineName: params.routineName,
      status: params.status,
      startedAt: params.status === 'in_progress' ? nowIso : undefined,
      finishedAt: params.status === 'completed' ? nowIso : undefined,
      durationMinutes: params.durationMinutes,
      streakProtected: params.status === 'completed' ? true : undefined,
    },
  };
}

/**
 * Computes empathetic motivation aligned with the missed reason and fitness goal.
 */
export function getEncouragementFeedback(
  reason: MissReasonId,
  goal?: FitnessGoal,
  gymType?: GymType,
  customGymName?: string,
  dayLabel?: DayOfWeek
): EncouragementFeedback {
  const gymLabel = gymType ? getGymDisplayName(gymType, customGymName) : 'el gimnasio';
  const dayContext = dayLabel ? `del ${dayLabel}` : 'de hoy';

  const goalClosing: Record<FitnessGoal, string> = {
    hipertrofia:
      'La masa muscular responde al volumen acumulado del mes y del ciclo, nunca a una sola sesión aislada.',
    fuerza:
      'Llegar fresco al próximo entreno te va a permitir mover tus cargas clave con mejor técnica que forzando hoy.',
    perdida_grasa:
      'Mantener el rumbo en tu alimentación y mover la sesión a otro día libre protege tu déficit semanal sin desgaste extra.',
    salud:
      'El objetivo es construir un hábito sostenible junto a la universidad, no exigirte perfección todos los días.',
  };

  const byReason: Record<MissReasonId, Omit<EncouragementFeedback, 'tip'>> = {
    estudios_examenes: {
      headline: 'Primero tus parciales, luego vuelves con todo a la barra.',
      body: `Darle prioridad a tu carrera cuando toca entrega o examen habla bien de tu disciplina. Tu progreso ${dayContext} en ${gymLabel} no se borra por reprogramar una sesión.`,
    },
    cansancio_sueno: {
      headline: 'Descansar también es parte del entrenamiento inteligente.',
      body: `Forzar 2 horas de entreno con el tanque vacío solo dispara fatiga y riesgo de lesión. Recuperar el sueño hoy hará que tu vuelta a ${gymLabel} rinda el doble.`,
    },
    trabajo_horarios: {
      headline: 'Estudiar, trabajar y entrenar ya es un mérito enorme.',
      body: `No todos los días cuadra el reloj entre chamba y clases. Lo importante es no soltar el hábito ${dayContext} sino reubicar tu espacio de 2 horas esta misma semana.`,
    },
    salud_lesion: {
      headline: 'Escuchar a tu cuerpo hoy te ahorra semanas parado después.',
      body: `Cuidar tu salud o una molestia a tiempo es la decisión más inteligente. Recupérate tranquilo y retomamos ${gymLabel} cuando te sientas al 100%.`,
    },
    tiempo_transporte: {
      headline: 'Un mal día de tráfico o tiempos no define tu semana.',
      body: `Que el reloj haya jugado en contra ${dayContext} pasa seguido. Tienes días por delante para rescatar esta rutina y proteger tu constancia.`,
    },
    otro: {
      headline: 'No pasa nada: la constancia gana a la perfección.',
      body: `Faltar un día no arruina meses de esfuerzo. Reubica este bloque ${dayContext} en tu semana o sigue con el siguiente día con cero culpa.`,
    },
  };

  return {
    ...byReason[reason],
    tip: goal ? goalClosing[goal] : goalClosing.hipertrofia,
  };
}

/**
 * Finds earlier scheduled days in the current week that were never started,
 * completed, or logged as missed/rescheduled (excluding days before gymProfile.configuredAt).
 */
export function findPendingMissedDays(
  gymProfile: UserGymProfile | undefined,
  routines: GymRoutine[],
  logs: GymAttendanceLog[] = [],
  weekDates: Record<DayOfWeek, string>,
  todayIso: string
): PendingMissedDay[] {
  if (!gymProfile || gymProfile.selectedDays.length === 0) return [];

  const configuredDate = getLocalIsoDateFromTimestamp(gymProfile.configuredAt);
  const pending: PendingMissedDay[] = [];

  for (const day of ORDERED_DAYS) {
    const dayDate = weekDates[day];
    if (!dayDate || dayDate >= todayIso) continue;
    if (configuredDate && dayDate < configuredDate) continue;

    const isScheduledOrRescheduled =
      gymProfile.selectedDays.includes(day) ||
      logs.some((l) => l.rescheduledToDate === dayDate);
    if (!isScheduledOrRescheduled) continue;

    const routine = routines.find((r) => r.dayOfWeek === day);
    if (!routine || routine.exercises.length === 0) continue;

    const existingLog = logs.find((l) => l.date === dayDate);
    if (
      existingLog &&
      (existingLog.status === 'completed' ||
        existingLog.status === 'missed' ||
        existingLog.status === 'rescheduled')
    ) {
      continue;
    }

    const allSetsDone = routine.exercises.every(
      (ex) => ex.completedSets.length > 0 && ex.completedSets.every(Boolean)
    );
    if (allSetsDone) continue;

    pending.push({
      dayOfWeek: day,
      date: dayDate,
      routine,
    });
  }

  return pending;
}

interface ShiftAssignment {
  destinationDay: DayOfWeek;
  sourceRoutine: GymRoutine;
  label: string;
}

/**
 * Shared planner for shifting a missed session onto targetDayIndex and sliding
 * remaining scheduled routines forward into remaining days of the same week.
 */
function computeShiftAssignments(
  fromRoutine: GymRoutine,
  targetDayIndex: number,
  routines: GymRoutine[],
  gymProfile: UserGymProfile | undefined
): { valid: boolean; assignments: ShiftAssignment[]; summary: string[] } {
  const downstreamRoutines: GymRoutine[] = [];

  for (let i = targetDayIndex; i < ORDERED_DAYS.length; i++) {
    const day = ORDERED_DAYS[i];
    const r = routines.find((item) => item.dayOfWeek === day);
    const hasExercises = Boolean(r && r.exercises.length > 0);
    const isScheduled = gymProfile ? gymProfile.selectedDays.includes(day) : hasExercises;
    if (r && (isScheduled || i === targetDayIndex) && hasExercises) {
      downstreamRoutines.push(r);
    }
  }

  if (downstreamRoutines.length === 0) {
    return { valid: false, assignments: [], summary: [] };
  }

  const remainingDays = ORDERED_DAYS.slice(targetDayIndex);
  const totalNeeded = downstreamRoutines.length + 1;
  if (totalNeeded > remainingDays.length) {
    return { valid: false, assignments: [], summary: [] };
  }

  const queue = [fromRoutine, ...downstreamRoutines];
  const assignments: ShiftAssignment[] = queue.map((sourceRoutine, idx) => ({
    destinationDay: remainingDays[idx],
    sourceRoutine,
    label: `${sourceRoutine.dayOfWeek} → ${remainingDays[idx]}`,
  }));

  const summary = assignments
    .filter((a) => a.sourceRoutine.dayOfWeek !== a.destinationDay)
    .map((a) => a.label);

  return { valid: true, assignments, summary };
}

/**
 * Generates candidate days for Phase 1 rescheduling within the current week:
 * prioritizes free rest days (never doubling workouts), and offers safe rotation shifts if helpful.
 */
export function getRescheduleOptions(
  fromDay: DayOfWeek,
  routines: GymRoutine[],
  gymProfile: UserGymProfile | undefined,
  weekDates: Record<DayOfWeek, string>,
  todayIso: string
): RescheduleOption[] {
  const fromRoutine = routines.find((r) => r.dayOfWeek === fromDay);
  if (!fromRoutine) return [];

  const options: RescheduleOption[] = [];

  for (let idx = 0; idx < ORDERED_DAYS.length; idx++) {
    const candidateDay = ORDERED_DAYS[idx];
    const candidateDate = weekDates[candidateDay];
    if (!candidateDate || candidateDate < todayIso || candidateDay === fromDay) continue;

    const existingRoutine = routines.find((r) => r.dayOfWeek === candidateDay);
    const hasExercises = Boolean(existingRoutine && existingRoutine.exercises.length > 0);
    const isConfiguredDay = gymProfile ? gymProfile.selectedDays.includes(candidateDay) : hasExercises;
    const dayTitle = candidateDate === todayIso ? `Hoy (${candidateDay})` : candidateDay;

    if (!isConfiguredDay || !hasExercises) {
      options.push({
        targetDay: candidateDay,
        targetDate: candidateDate,
        mode: 'move_to_rest',
        badge: 'Día libre',
        title: dayTitle,
        subtitle: `Mover "${fromRoutine.name}" a este día de descanso (~2h) sin doblar carga.`,
        recommended: true,
      });
    } else {
      const shift = computeShiftAssignments(fromRoutine, idx, routines, gymProfile);
      if (shift.valid) {
        options.push({
          targetDay: candidateDay,
          targetDate: candidateDate,
          mode: 'shift_schedule',
          badge: 'Correr semana',
          title: dayTitle,
          subtitle: `Tomar "${fromRoutine.name}" el ${candidateDay} y recorrer los demás entrenos sin perder ninguno.`,
          recommended: false,
          shiftSummary: shift.summary,
        });
      }
    }
  }

  // Sort recommended free rest days before shift options while preserving chronological order
  return options.sort((a, b) => {
    if (a.recommended !== b.recommended) return a.recommended ? -1 : 1;
    return a.targetDate.localeCompare(b.targetDate);
  });
}

function resetExerciseCompletion(routine: GymRoutine): GymRoutine {
  return {
    ...routine,
    exercises: routine.exercises.map((ex) => ({
      ...ex,
      completedSets: Array(ex.sets).fill(false),
    })),
  };
}

/**
 * Applies a Phase 1 workout reschedule across gymRoutines without stacking two workouts on one day.
 */
export function applyRoutineReschedule(params: {
  fromDay: DayOfWeek;
  toDay: DayOfWeek;
  mode: RescheduleMode;
  routines: GymRoutine[];
  gymProfile?: UserGymProfile;
  weekDates: Record<DayOfWeek, string>;
}): RescheduleResult {
  const { fromDay, toDay, mode, routines, gymProfile, weekDates } = params;

  const routineMap = new Map<DayOfWeek, GymRoutine>();
  for (const day of ORDERED_DAYS) {
    const found = routines.find((r) => r.dayOfWeek === day);
    routineMap.set(
      day,
      found ?? {
        id: `gym-${day.toLowerCase()}`,
        name: 'Día de Descanso Activo',
        dayOfWeek: day,
        tag: 'Descanso',
        exercises: [],
      }
    );
  }

  const sourceRoutine = routineMap.get(fromDay)!;
  const cleanSourcePayload = resetExerciseCompletion(sourceRoutine);

  if (mode === 'move_to_rest') {
    const destRoutine = routineMap.get(toDay)!;
    routineMap.set(toDay, {
      ...cleanSourcePayload,
      id: destRoutine.id || `gym-${toDay.toLowerCase()}`,
      dayOfWeek: toDay,
      tag: sourceRoutine.tag.includes('Reprogramado')
        ? sourceRoutine.tag
        : `${sourceRoutine.tag} · Reprogramado`,
    });

    routineMap.set(fromDay, {
      id: sourceRoutine.id,
      name: `Sesión reprogramada al ${toDay}`,
      dayOfWeek: fromDay,
      tag: 'Reprogramado',
      exercises: [],
    });
  } else {
    const toIndex = ORDERED_DAYS.indexOf(toDay);
    const shift = computeShiftAssignments(cleanSourcePayload, toIndex, routines, gymProfile);

    routineMap.set(fromDay, {
      id: sourceRoutine.id,
      name: `Sesión reprogramada al ${toDay}`,
      dayOfWeek: fromDay,
      tag: 'Reprogramado',
      exercises: [],
    });

    if (shift.valid) {
      shift.assignments.forEach((assignment, idx) => {
        const cleanPayload = resetExerciseCompletion(assignment.sourceRoutine);
        const prevDest = routineMap.get(assignment.destinationDay)!;
        routineMap.set(assignment.destinationDay, {
          ...cleanPayload,
          id: prevDest.id || `gym-${assignment.destinationDay.toLowerCase()}`,
          dayOfWeek: assignment.destinationDay,
          tag:
            idx === 0 && !cleanPayload.tag.includes('Reprogramado')
              ? `${cleanPayload.tag} · Reprogramado`
              : cleanPayload.tag,
        });
      });
    }
  }

  const updatedRoutines = ORDERED_DAYS.map((day) => routineMap.get(day)!);

  return {
    updatedRoutines,
    rescheduledToDay: toDay,
    rescheduledToDate: weekDates[toDay],
    movedRoutineName: sourceRoutine.name,
  };
}
