import type { GoogleCalendarEvent } from '../services/googleCalendar';
import type {
  CalendarBlock,
  DayOfWeek,
  GymAttendanceLog,
  GymRoutine,
  GymSessionDurationMinutes,
  UserGymProfile,
} from '../types';
import { isStudentOsGymGoogleEvent } from './gymScheduleFilter';
import { ORDERED_DAYS } from './routineGenerator';

export interface GymDaySlotSummary {
  startTime: string;
  endTime: string;
  durationMinutes?: GymSessionDurationMinutes;
}

export interface MissingScheduledGymDay {
  dayOfWeek: DayOfWeek;
  dateIso: string;
  routineName: string;
  exerciseCount: number;
  isPastDay: boolean;
  isRescheduledInstance: boolean;
  preferredSlot?: GymDaySlotSummary;
}

export interface FindMissingGymDaysParams {
  gymProfile?: UserGymProfile;
  routines: GymRoutine[];
  attendanceLogs?: GymAttendanceLog[];
  calendarBlocks?: CalendarBlock[];
  googleEvents?: GoogleCalendarEvent[];
  snapshotGoogleEvents?: GoogleCalendarEvent[] | null;
  isGoogleConnected: boolean;
  isGoogleMetaConnected?: boolean;
  hasGoogleWeekReady: boolean;
  isGoogleSyncing?: boolean;
  weekDates: Record<DayOfWeek, string>;
  todayIso: string;
  dismissedDates?: string[];
  deletedDatesThisSession?: string[];
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Shifts a YYYY-MM-DD local ISO date string by a signed integer number of days.
 */
export function addIsoDays(isoDate: string, deltaDays: number): string {
  const parts = isoDate.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return isoDate;
  const dt = new Date(parts[0], parts[1] - 1, parts[2] + deltaDays);
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
}

function getLocalIsoFromTimestamp(ts?: string): string | null {
  if (!ts) return null;
  const parsed = new Date(ts);
  if (Number.isNaN(parsed.getTime())) return null;
  return `${parsed.getFullYear()}-${pad2(parsed.getMonth() + 1)}-${pad2(parsed.getDate())}`;
}

/**
 * Resolves the local YYYY-MM-DD calendar date for a Google Calendar event.
 */
export function toLocalIsoDateFromGoogleEvent(event: GoogleCalendarEvent): string | null {
  return event.dateIso ? event.dateIso.slice(0, 10) : null;
}

function isLocalGymBlock(block: CalendarBlock): boolean {
  return (
    block.category === 'gym' ||
    block.id.startsWith('cal-gym-') ||
    block.title.toLowerCase().startsWith('gym:')
  );
}

/**
 * Detects configured (or currently rescheduled) gym days in the visible week that no longer
 * have a corresponding gym block/event in the user's calendar (local or Google Calendar).
 */
export function findMissingScheduledGymDays(
  params: FindMissingGymDaysParams
): MissingScheduledGymDay[] {
  const {
    gymProfile,
    routines,
    attendanceLogs = [],
    calendarBlocks = [],
    googleEvents = [],
    snapshotGoogleEvents = null,
    isGoogleConnected,
    isGoogleMetaConnected = false,
    hasGoogleWeekReady,
    isGoogleSyncing = false,
    weekDates,
    todayIso,
    dismissedDates = [],
    deletedDatesThisSession = [],
  } = params;

  if (!gymProfile || gymProfile.selectedDays.length === 0) return [];
  if (isGoogleSyncing) return [];
  if (isGoogleConnected && !hasGoogleWeekReady) return [];

  const localGymBlocks = calendarBlocks.filter(isLocalGymBlock);
  if (
    !isGoogleConnected &&
    isGoogleMetaConnected &&
    snapshotGoogleEvents === null &&
    localGymBlocks.length === 0
  ) {
    return [];
  }

  const presentCalendarDays = new Set<DayOfWeek>();
  const presentCalendarDates = new Set<string>();
  const linkedGymGoogleIds = new Set<string>();

  for (const block of localGymBlocks) {
    presentCalendarDays.add(block.day);
    const blockDate = weekDates[block.day];
    if (blockDate) presentCalendarDates.add(blockDate);
    if (block.googleEventId) linkedGymGoogleIds.add(block.googleEventId);
  }

  const effectiveGoogleEvents = isGoogleConnected
    ? googleEvents
    : snapshotGoogleEvents ?? [];

  for (const ev of effectiveGoogleEvents) {
    if (!isStudentOsGymGoogleEvent(ev, linkedGymGoogleIds)) continue;
    const evDate = toLocalIsoDateFromGoogleEvent(ev);
    if (evDate) {
      presentCalendarDates.add(evDate);
    }
  }

  const configuredDate = getLocalIsoFromTimestamp(gymProfile.configuredAt);
  const dismissedSet = new Set(dismissedDates);
  const deletedSet = new Set(deletedDatesThisSession);
  const mondayIso = weekDates.Lunes;
  const sundayIso = weekDates.Domingo;
  const missing: MissingScheduledGymDay[] = [];
  const seenDays = new Set<DayOfWeek>();

  for (const day of ORDERED_DAYS) {
    if (!gymProfile.selectedDays.includes(day)) continue;
    const dateIso = weekDates[day];
    if (!dateIso) continue;
    if (dismissedSet.has(dateIso)) continue;
    if (configuredDate && dateIso < configuredDate && !deletedSet.has(dateIso)) {
      continue;
    }

    const log = attendanceLogs.find((item) => item.date === dateIso);
    if (
      log &&
      (log.status === 'completed' || log.status === 'rescheduled' || log.status === 'missed')
    ) {
      continue;
    }

    const routine = routines.find((r) => r.dayOfWeek === day);
    const allSetsDone = Boolean(
      routine &&
        routine.exercises.length > 0 &&
        routine.exercises.every((ex) => ex.completedSets.length > 0 && ex.completedSets.every(Boolean))
    );
    if (allSetsDone) continue;

    if (presentCalendarDates.has(dateIso) || presentCalendarDays.has(day)) {
      continue;
    }

    seenDays.add(day);
    missing.push({
      dayOfWeek: day,
      dateIso,
      routineName: routine?.name ?? `Entrenamiento del ${day}`,
      exerciseCount: routine?.exercises.length ?? 0,
      isPastDay: dateIso < todayIso,
      isRescheduledInstance: false,
    });
  }

  for (const log of attendanceLogs) {
    if (
      log.status !== 'rescheduled' ||
      !log.rescheduledToDay ||
      !log.rescheduledToDate ||
      !mondayIso ||
      !sundayIso
    ) {
      continue;
    }
    if (log.rescheduledToDate < mondayIso || log.rescheduledToDate > sundayIso) continue;
    if (seenDays.has(log.rescheduledToDay) || dismissedSet.has(log.rescheduledToDate)) continue;

    const hadScheduledCalendarBlock =
      Boolean(log.rescheduledSlotStart) ||
      Boolean(log.rescheduledCalendarBlockId) ||
      deletedSet.has(log.rescheduledToDate);
    if (!hadScheduledCalendarBlock) continue;

    const targetLog = attendanceLogs.find((item) => item.date === log.rescheduledToDate);
    if (targetLog && (targetLog.status === 'completed' || targetLog.status === 'missed')) {
      continue;
    }

    const targetRoutine = routines.find((r) => r.dayOfWeek === log.rescheduledToDay);
    const allSetsDone = Boolean(
      targetRoutine &&
        targetRoutine.exercises.length > 0 &&
        targetRoutine.exercises.every(
          (ex) => ex.completedSets.length > 0 && ex.completedSets.every(Boolean)
        )
    );
    if (allSetsDone) continue;

    if (
      presentCalendarDates.has(log.rescheduledToDate) ||
      presentCalendarDays.has(log.rescheduledToDay)
    ) {
      continue;
    }

    seenDays.add(log.rescheduledToDay);
    missing.push({
      dayOfWeek: log.rescheduledToDay,
      dateIso: log.rescheduledToDate,
      routineName: targetRoutine?.name ?? log.routineName ?? `Sesión de ${log.rescheduledToDay}`,
      exerciseCount: targetRoutine?.exercises.length ?? 0,
      isPastDay: log.rescheduledToDate < todayIso,
      isRescheduledInstance: true,
      preferredSlot:
        log.rescheduledSlotStart && log.rescheduledSlotEnd
          ? { startTime: log.rescheduledSlotStart, endTime: log.rescheduledSlotEnd }
          : undefined,
    });
  }

  return missing;
}

/**
 * Lists weekdays currently not configured as fixed gym training days.
 */
export function findFreePermanentDayCandidates(
  selectedDays: DayOfWeek[],
  fromDay: DayOfWeek
): DayOfWeek[] {
  return ORDERED_DAYS.filter((day) => day !== fromDay && !selectedDays.includes(day));
}

/**
 * Swaps a missing fixed weekday for a new weekday in the profile and transfers its
 * routine (including exercise weights and PR history) without losing progress.
 */
export function applyFixedGymDaySwap(params: {
  profile: UserGymProfile;
  routines: GymRoutine[];
  fromDay: DayOfWeek;
  toDay: DayOfWeek;
  slot: {
    startTime: string;
    endTime: string;
    durationMinutes?: GymSessionDurationMinutes;
  };
}): {
  nextProfile: UserGymProfile;
  nextRoutines: GymRoutine[];
  movedRoutineName: string;
} {
  const { profile, routines, fromDay, toDay } = params;
  const nextSelectedDays = ORDERED_DAYS.filter(
    (day) => day === toDay || (day !== fromDay && profile.selectedDays.includes(day))
  );

  const nextProfile: UserGymProfile = {
    ...profile,
    selectedDays: nextSelectedDays,
    trainingDaysCount: nextSelectedDays.length,
  };

  const sourceRoutine = routines.find((r) => r.dayOfWeek === fromDay);
  const destRoutine = routines.find((r) => r.dayOfWeek === toDay);
  const cleanTag = (sourceRoutine?.tag ?? 'Entrenamiento')
    .replace(/\s*·\s*Reprogramado/gi, '')
    .trim();
  const movedRoutineName = sourceRoutine?.name ?? `Entrenamiento de ${toDay}`;

  const routineMap = new Map<DayOfWeek, GymRoutine>();
  for (const day of ORDERED_DAYS) {
    const existing = routines.find((r) => r.dayOfWeek === day);
    routineMap.set(
      day,
      existing ?? {
        id: `gym-${day.toLowerCase()}`,
        name: 'Día de Descanso Activo',
        dayOfWeek: day,
        tag: 'Descanso',
        exercises: [],
      }
    );
  }

  routineMap.set(toDay, {
    id: destRoutine?.id || `gym-${toDay.toLowerCase()}`,
    name: movedRoutineName,
    dayOfWeek: toDay,
    tag: cleanTag || 'Entrenamiento',
    exercises: (sourceRoutine?.exercises ?? []).map((ex) => ({
      ...ex,
      completedSets: Array(ex.sets).fill(false),
    })),
  });

  if (fromDay !== toDay) {
    routineMap.set(fromDay, {
      id: sourceRoutine?.id || `gym-${fromDay.toLowerCase()}`,
      name: 'Día de Descanso Activo',
      dayOfWeek: fromDay,
      tag: 'Descanso',
      exercises: [],
    });
  }

  return {
    nextProfile,
    nextRoutines: ORDERED_DAYS.map((day) => routineMap.get(day)!),
    movedRoutineName,
  };
}

/**
 * Permanently removes a weekday from the fixed gym plan when >= 2 active days exist.
 * Returns null if removing the day would leave zero training days.
 */
export function applyFixedGymDayRemoval(params: {
  profile: UserGymProfile;
  routines: GymRoutine[];
  dayToRemove: DayOfWeek;
}): {
  nextProfile: UserGymProfile;
  nextRoutines: GymRoutine[];
} | null {
  const { profile, routines, dayToRemove } = params;
  const remainingDays = ORDERED_DAYS.filter(
    (day) => day !== dayToRemove && profile.selectedDays.includes(day)
  );
  if (remainingDays.length === 0) return null;

  const nextProfile: UserGymProfile = {
    ...profile,
    selectedDays: remainingDays,
    trainingDaysCount: remainingDays.length,
  };

  const nextRoutines = routines.map((r) =>
    r.dayOfWeek === dayToRemove
      ? {
          ...r,
          name: 'Día de Descanso Activo',
          tag: 'Descanso',
          exercises: [],
        }
      : r
  );

  return { nextProfile, nextRoutines };
}
