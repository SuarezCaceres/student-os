import type { GoogleCalendarEvent } from '../services/googleCalendar';
import type {
  AssignmentStatus,
  CalendarBlock,
  DailyHabits,
  DayOfWeek,
  GymAttendanceLog,
  GymRoutine,
  UniversityAssignment,
} from '../types';
import { getLocalIsoDate } from './gymAttendance';
import { isStudentOsGymGoogleEvent } from './gymScheduleFilter';
import {
  expandCalendarBlocksToSegments,
  parseTimeToMinutes,
  type ExpandedBlockSegment,
} from './workSchedule';

export const DEFAULT_DAILY_HABITS: DailyHabits = {
  waterMl: 1750,
  targetWaterMl: 2500,
  sleepHours: 7.5,
  targetSleepHours: 8,
  pomodorosDone: 4,
  targetPomodoros: 6,
};

export interface GpaBadgeInfo {
  label: string;
  className: string;
}

export interface AssignmentUrgencyInfo {
  daysDiff: number | null;
  label: string;
  shortLabel: string;
  tone: 'danger' | 'warn' | 'accent' | 'ok' | 'neutral';
  badgeClass: string;
}

export type TodayAgendaEntry =
  | {
      kind: 'local';
      id: string;
      title: string;
      startMinutes: number;
      endMinutes: number;
      isAllDay: false;
      isGym: boolean;
      sortMinutes: number;
      segment: ExpandedBlockSegment;
    }
  | {
      kind: 'google';
      id: string;
      title: string;
      startMinutes: number;
      endMinutes: number;
      isAllDay: boolean;
      isGym: boolean;
      sortMinutes: number;
      event: GoogleCalendarEvent;
    };

export interface ClassifiedTodayAgenda {
  allDayEntries: TodayAgendaEntry[];
  activeEntries: TodayAgendaEntry[];
  upcomingEntries: TodayAgendaEntry[];
  pastEntries: TodayAgendaEntry[];
}

export interface GymTodayStatusSummary {
  label: string;
  tone: 'ok' | 'accent' | 'warn' | 'gym' | 'neutral';
  badgeClass: string;
  scheduledTimeLabel: string | null;
}

/**
 * Calculates the weighted overall GPA (0-20 scale) across all graded assignments.
 */
export function calculateOverallGpa(assignments: UniversityAssignment[]): number | null {
  let weightedSum = 0;
  let weightGraded = 0;

  for (const a of assignments) {
    const weight = a.weightPercentage || 0;
    if (a.gradeObtained !== undefined) {
      weightedSum += a.gradeObtained * weight;
      weightGraded += weight;
    }
  }

  return weightGraded > 0 ? weightedSum / weightGraded : null;
}

/**
 * Maps an overall GPA score to a semantic badge label and CSS class.
 */
export function getGpaBadge(gpa: number | null): GpaBadgeInfo {
  if (gpa === null) {
    return { label: 'Sin notas aún', className: 't-badge' };
  }
  if (gpa >= 17) {
    return { label: 'Sobresaliente', className: 't-badge t-badge-ok' };
  }
  if (gpa >= 14) {
    return { label: 'Aprobado tranquilo', className: 't-badge t-badge-ok' };
  }
  if (gpa >= 11) {
    return { label: 'Ajustado', className: 't-badge t-badge-warn' };
  }
  return { label: 'En riesgo', className: 't-badge t-badge-danger' };
}

/**
 * Parses a YYYY-MM-DD date string into UTC midnight milliseconds.
 */
export function parseIsoDateUtcMs(dateStr: string): number | null {
  if (!dateStr) return null;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return null;
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }
  return Date.UTC(year, month - 1, day);
}

/**
 * Computes day difference between a due date (YYYY-MM-DD) and today's local date.
 */
export function getAssignmentDaysDiff(
  dueDate: string,
  todayIso: string = getLocalIsoDate()
): number | null {
  const targetUtcMs = parseIsoDateUtcMs(dueDate);
  const todayUtcMs = parseIsoDateUtcMs(todayIso);
  if (targetUtcMs === null || todayUtcMs === null) return null;
  return Math.round((targetUtcMs - todayUtcMs) / 86_400_000);
}

/**
 * Classifies assignment urgency relative to today's local date and status.
 */
export function getAssignmentUrgency(
  dueDate: string,
  status: AssignmentStatus,
  todayIso: string = getLocalIsoDate()
): AssignmentUrgencyInfo {
  if (status === 'entregado') {
    return {
      daysDiff: getAssignmentDaysDiff(dueDate, todayIso),
      label: 'Entregada',
      shortLabel: 'Entregada',
      tone: 'ok',
      badgeClass: 't-badge t-badge-ok',
    };
  }

  const daysDiff = getAssignmentDaysDiff(dueDate, todayIso);
  if (daysDiff === null) {
    const label = status === 'en_progreso' ? 'En progreso' : 'Pendiente';
    return {
      daysDiff: null,
      label,
      shortLabel: label,
      tone: 'neutral',
      badgeClass: 't-badge',
    };
  }

  if (daysDiff < 0) {
    const lateDays = Math.abs(daysDiff);
    return {
      daysDiff,
      label: `Vencida hace ${lateDays} ${lateDays === 1 ? 'día' : 'días'}`,
      shortLabel: lateDays === 1 ? 'Vencida ayer' : `Vencida ${lateDays}d`,
      tone: 'danger',
      badgeClass: 't-badge t-badge-danger t-num',
    };
  }

  if (daysDiff === 0) {
    return {
      daysDiff,
      label: 'Vence hoy',
      shortLabel: 'Hoy',
      tone: 'danger',
      badgeClass: 't-badge t-badge-danger',
    };
  }

  if (daysDiff === 1) {
    return {
      daysDiff,
      label: 'Vence mañana',
      shortLabel: 'Mañana',
      tone: 'warn',
      badgeClass: 't-badge t-badge-warn',
    };
  }

  if (daysDiff <= 3) {
    return {
      daysDiff,
      label: `En ${daysDiff} días`,
      shortLabel: `En ${daysDiff} d`,
      tone: 'warn',
      badgeClass: 't-badge t-badge-warn t-num',
    };
  }

  if (status === 'en_progreso') {
    return {
      daysDiff,
      label: `En progreso · ${daysDiff} días`,
      shortLabel: `En ${daysDiff} d`,
      tone: 'accent',
      badgeClass: 't-badge t-badge-accent t-num',
    };
  }

  return {
    daysDiff,
    label: `En ${daysDiff} días`,
    shortLabel: `En ${daysDiff} d`,
    tone: 'neutral',
    badgeClass: 't-badge t-num',
  };
}

/**
 * Merges local calendar segments and non-mirrored Google Calendar events for today.
 */
export function buildTodayAgendaEntries(params: {
  calendarBlocks: CalendarBlock[];
  googleEvents?: GoogleCalendarEvent[];
  todayDay: DayOfWeek;
  todayDateIso: string;
}): TodayAgendaEntry[] {
  const { calendarBlocks, googleEvents = [], todayDay, todayDateIso } = params;
  const todaySegments = expandCalendarBlocksToSegments(calendarBlocks)
    .filter((seg) => seg.day === todayDay)
    .sort((a, b) => parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime));

  const mirroredGoogleIds = new Set(
    calendarBlocks.map((b) => b.googleEventId).filter((id): id is string => Boolean(id))
  );

  const todayGoogleEvents = googleEvents.filter(
    (ev) =>
      !mirroredGoogleIds.has(ev.id) &&
      (ev.dateIso ? ev.dateIso === todayDateIso : ev.day === todayDay)
  );

  const entries: TodayAgendaEntry[] = [
    ...todaySegments.map((segment) => {
      const startMinutes = parseTimeToMinutes(segment.startTime);
      const rawEnd = parseTimeToMinutes(segment.endTime);
      const endMinutes = rawEnd > startMinutes ? rawEnd : Math.min(1440, startMinutes + 30);
      return {
        kind: 'local' as const,
        id: segment.segmentId,
        title: segment.block.title,
        startMinutes,
        endMinutes,
        isAllDay: false as const,
        isGym: segment.block.category === 'gym',
        sortMinutes: startMinutes,
        segment,
      };
    }),
    ...todayGoogleEvents.map((event) => {
      const startMinutes = event.isAllDay ? 0 : parseTimeToMinutes(event.startTime);
      const rawEnd = event.isAllDay ? 1440 : parseTimeToMinutes(event.endTime);
      const endMinutes = event.isAllDay
        ? 1440
        : rawEnd > startMinutes
          ? rawEnd
          : event.endTime.trim() === '00:00' || rawEnd < startMinutes
            ? 1440
            : Math.min(1440, startMinutes + 30);
      return {
        kind: 'google' as const,
        id: `gcal-${event.id}-${event.dateIso}`,
        title: event.title,
        startMinutes,
        endMinutes,
        isAllDay: Boolean(event.isAllDay),
        isGym: isStudentOsGymGoogleEvent(event),
        sortMinutes: event.isAllDay ? -1 : startMinutes,
        event,
      };
    }),
  ];

  return entries.sort((a, b) => a.sortMinutes - b.sortMinutes);
}

/**
 * Partitions today's agenda entries against the current local time in minutes.
 */
export function classifyTodayAgenda(
  entries: TodayAgendaEntry[],
  nowMinutes: number
): ClassifiedTodayAgenda {
  const allDayEntries: TodayAgendaEntry[] = [];
  const activeEntries: TodayAgendaEntry[] = [];
  const upcomingEntries: TodayAgendaEntry[] = [];
  const pastEntries: TodayAgendaEntry[] = [];

  for (const entry of entries) {
    if (entry.isAllDay) {
      allDayEntries.push(entry);
      continue;
    }
    if (entry.startMinutes <= nowMinutes && nowMinutes < entry.endMinutes) {
      activeEntries.push(entry);
    } else if (entry.startMinutes > nowMinutes) {
      upcomingEntries.push(entry);
    } else {
      pastEntries.push(entry);
    }
  }

  return {
    allDayEntries,
    activeEntries,
    upcomingEntries,
    pastEntries,
  };
}

/**
 * Formats a positive minute offset into a concise Spanish relative countdown.
 */
export function formatMinutesUntil(diffMinutes: number): string {
  const safe = Math.max(0, Math.round(diffMinutes));
  if (safe < 1) return 'Ahora';
  if (safe < 60) return `En ${safe} min`;
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  return mins === 0 ? `En ${hours} h` : `En ${hours} h ${mins} min`;
}

/**
 * Formats a minute-of-day integer (0-1440) as HH:mm.
 */
export function formatMinutesAsClock(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(1440, Math.round(totalMinutes)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Calculates overall daily habits completion percentage (0-100) using the same formula in Hero & Card.
 */
export function calculateDailyHabitsPercent(habits?: DailyHabits): number {
  const h = habits ?? DEFAULT_DAILY_HABITS;
  const waterPercent = Math.min(
    100,
    Math.round((h.waterMl / Math.max(1, h.targetWaterMl)) * 100)
  );
  const sleepPercent = Math.min(
    100,
    Math.round((h.sleepHours / Math.max(0.5, h.targetSleepHours)) * 100)
  );
  const pomodoroPercent = Math.min(
    100,
    Math.round((h.pomodorosDone / Math.max(1, h.targetPomodoros)) * 100)
  );
  return Math.round((waterPercent + sleepPercent + pomodoroPercent) / 3);
}

/**
 * Resets daily counters (water & focus blocks) on calendar day rollover while keeping user targets.
 * Legacy state without lastUpdatedDate is stamped with todayIso without discarding current values.
 */
export function normalizeDailyHabitsForDate(
  habits: DailyHabits | undefined,
  todayIso: string
): { habits: DailyHabits; changed: boolean } {
  const base = habits ?? DEFAULT_DAILY_HABITS;
  if (!base.lastUpdatedDate) {
    return {
      habits: { ...base, lastUpdatedDate: todayIso },
      changed: true,
    };
  }
  if (base.lastUpdatedDate !== todayIso) {
    return {
      habits: {
        ...base,
        waterMl: 0,
        pomodorosDone: 0,
        lastUpdatedDate: todayIso,
      },
      changed: true,
    };
  }
  return { habits: base, changed: false };
}

/**
 * Resolves today's Gym attendance status and scheduled time window from agenda + logs.
 */
export function getTodayGymSessionSummary(params: {
  todayRoutine?: GymRoutine;
  todayDateIso: string;
  attendanceLogs?: GymAttendanceLog[];
  todayAgendaEntries?: TodayAgendaEntry[];
}): GymTodayStatusSummary {
  const { todayRoutine, todayDateIso, attendanceLogs = [], todayAgendaEntries = [] } = params;
  const scheduledGymEntry = todayAgendaEntries.find((entry) => entry.isGym && !entry.isAllDay);

  let scheduledTimeLabel: string | null = null;
  if (scheduledGymEntry) {
    if (scheduledGymEntry.kind === 'google') {
      scheduledTimeLabel = `${scheduledGymEntry.event.startTime}–${scheduledGymEntry.event.endTime}`;
    } else {
      scheduledTimeLabel = `${scheduledGymEntry.segment.startTime}–${scheduledGymEntry.segment.endTime}`;
    }
  }

  const todayLog = attendanceLogs.find((log) => log.date === todayDateIso);
  if (todayLog) {
    switch (todayLog.status) {
      case 'completed':
        return {
          label: 'Completada',
          tone: 'ok',
          badgeClass: 't-badge t-badge-ok',
          scheduledTimeLabel,
        };
      case 'in_progress':
        return {
          label: 'En curso',
          tone: 'gym',
          badgeClass: 't-badge t-badge-gym',
          scheduledTimeLabel,
        };
      case 'rescheduled':
        return {
          label: todayLog.rescheduledToDay
            ? `Reprogramada (${todayLog.rescheduledToDay.slice(0, 3)})`
            : 'Reprogramada',
          tone: 'accent',
          badgeClass: 't-badge t-badge-accent',
          scheduledTimeLabel,
        };
      case 'missed':
        return {
          label: 'Falta registrada',
          tone: 'warn',
          badgeClass: 't-badge t-badge-warn',
          scheduledTimeLabel,
        };
      default:
        break;
    }
  }

  if (!todayRoutine || todayRoutine.exercises.length === 0) {
    return {
      label: 'Descanso',
      tone: 'neutral',
      badgeClass: 't-badge',
      scheduledTimeLabel,
    };
  }

  const allSetsDone = todayRoutine.exercises.every(
    (ex) => ex.sets > 0 && ex.completedSets.slice(0, ex.sets).every(Boolean)
  );
  if (allSetsDone) {
    return {
      label: 'Series listas',
      tone: 'ok',
      badgeClass: 't-badge t-badge-ok',
      scheduledTimeLabel,
    };
  }

  return {
    label: 'Sin iniciar',
    tone: 'neutral',
    badgeClass: 't-badge',
    scheduledTimeLabel,
  };
}
