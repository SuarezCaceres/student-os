import type { AppState, CalendarBlock, DayOfWeek, WorkShiftConfig } from '../types';
import { ORDERED_DAYS } from './routineGenerator';

export const WORK_SHIFT_INIT_FLAG_KEY = 'student_os_work_shift_v1';
export const WORK_SHIFT_BLOCK_ID_PREFIX = 'work-shift-';

export const DEFAULT_NIGHT_WORK_SHIFT: WorkShiftConfig = {
  enabled: true,
  title: 'Trabajo nocturno',
  startTime: '22:00',
  endTime: '06:00',
  restDay: 'Jueves',
  location: 'Turno madrugada',
  reminderMinutes: [30],
  syncWithGoogle: true,
};

export interface ExpandedBlockSegment {
  segmentId: string;
  block: CalendarBlock;
  day: DayOfWeek;
  startTime: string; // HH:mm within [00:00, 24:00]
  endTime: string; // HH:mm within [00:00, 24:00]
  isOvernight: boolean;
  segmentRole: 'single' | 'overnight_start' | 'overnight_continuation';
  originDay: DayOfWeek;
  displayRangeLabel: string;
}

/**
 * Converts an HH:mm string into minutes since 00:00, supporting 24:00 as 1440.
 */
export function parseTimeToMinutes(timeStr: string): number {
  const [hRaw = '0', mRaw = '0'] = timeStr.trim().split(':');
  const hours = Number.parseInt(hRaw, 10);
  const minutes = Number.parseInt(mRaw, 10);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;
  const clampedH = Math.max(0, Math.min(24, hours));
  const clampedM = clampedH === 24 ? 0 : Math.max(0, Math.min(59, minutes));
  return clampedH * 60 + clampedM;
}

/**
 * Returns true when an interval crosses midnight onto the following day (e.g. 22:00 -> 06:00).
 */
export function isOvernightTimeRange(startTime: string, endTime: string): boolean {
  if (endTime.trim() === '24:00') return false;
  const startMin = parseTimeToMinutes(startTime);
  const endMin = parseTimeToMinutes(endTime);
  return endMin < startMin;
}

export function getNextDayOfWeek(day: DayOfWeek): DayOfWeek {
  const idx = ORDERED_DAYS.indexOf(day);
  if (idx < 0) return ORDERED_DAYS[0];
  return ORDERED_DAYS[(idx + 1) % ORDERED_DAYS.length];
}

export function getPreviousDayOfWeek(day: DayOfWeek): DayOfWeek {
  const idx = ORDERED_DAYS.indexOf(day);
  if (idx < 0) return ORDERED_DAYS[0];
  return ORDERED_DAYS[(idx - 1 + ORDERED_DAYS.length) % ORDERED_DAYS.length];
}

/**
 * Returns formatted duration label (e.g. "8h" or "8h 30m") for daytime or overnight shifts.
 */
export function formatShiftDurationLabel(startTime: string, endTime: string): string {
  const startMin = parseTimeToMinutes(startTime);
  const endMin = parseTimeToMinutes(endTime);
  const totalMinutes = endMin > startMin ? endMin - startMin : 24 * 60 - startMin + endMin;
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return mins === 0 ? `${hours}h` : `${hours}h ${mins}m`;
}

/**
 * Expands a single CalendarBlock into 1 (same-day) or 2 (cross-midnight) per-day segments
 * bounded inside [00:00, 24:00] so grids, conflict solvers, and daily lists stay accurate.
 */
export function expandCalendarBlockToSegments(block: CalendarBlock): ExpandedBlockSegment[] {
  if (!isOvernightTimeRange(block.startTime, block.endTime)) {
    return [
      {
        segmentId: block.id,
        block,
        day: block.day,
        startTime: block.startTime,
        endTime: block.endTime,
        isOvernight: false,
        segmentRole: 'single',
        originDay: block.day,
        displayRangeLabel: `${block.startTime} – ${block.endTime}`,
      },
    ];
  }

  const nextDay = getNextDayOfWeek(block.day);
  const segments: ExpandedBlockSegment[] = [
    {
      segmentId: `${block.id}::start`,
      block,
      day: block.day,
      startTime: block.startTime,
      endTime: '24:00',
      isOvernight: true,
      segmentRole: 'overnight_start',
      originDay: block.day,
      displayRangeLabel: `${block.startTime} – 24:00 (termina ${nextDay} ${block.endTime})`,
    },
  ];

  if (parseTimeToMinutes(block.endTime) > 0) {
    segments.push({
      segmentId: `${block.id}::cont`,
      block,
      day: nextDay,
      startTime: '00:00',
      endTime: block.endTime,
      isOvernight: true,
      segmentRole: 'overnight_continuation',
      originDay: block.day,
      displayRangeLabel: `00:00 – ${block.endTime} (desde ${block.day} ${block.startTime})`,
    });
  }

  return segments;
}

/**
 * Expands an array of CalendarBlocks into normalized per-day timeline segments.
 */
export function expandCalendarBlocksToSegments(blocks: CalendarBlock[]): ExpandedBlockSegment[] {
  return blocks.flatMap((block) => expandCalendarBlockToSegments(block));
}

/**
 * Checks whether two calendar blocks overlap on any day (including cross-midnight continuations).
 */
export function doCalendarBlocksCollide(a: CalendarBlock, b: CalendarBlock): boolean {
  if (a.id === b.id) return false;
  const segsA = expandCalendarBlockToSegments(a);
  const segsB = expandCalendarBlockToSegments(b);

  for (const sa of segsA) {
    for (const sb of segsB) {
      if (sa.day !== sb.day) continue;
      const startA = parseTimeToMinutes(sa.startTime);
      const endA = parseTimeToMinutes(sa.endTime);
      const startB = parseTimeToMinutes(sb.startTime);
      const endB = parseTimeToMinutes(sb.endTime);
      if (startA < endB && startB < endA) {
        return true;
      }
    }
  }

  return false;
}

function getWorkShiftBlockId(day: DayOfWeek): string {
  const slug = day
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return `${WORK_SHIFT_BLOCK_ID_PREFIX}${slug}`;
}

export function isManagedWorkShiftBlock(block: CalendarBlock): boolean {
  return Boolean(block.isRecurringWorkShift) || block.id.startsWith(WORK_SHIFT_BLOCK_ID_PREFIX);
}

/**
 * Builds recurring CalendarBlocks for a WorkShiftConfig while preserving linked Google IDs per day.
 */
export function buildWorkShiftBlocks(
  config: WorkShiftConfig,
  existingBlocks: CalendarBlock[] = []
): CalendarBlock[] {
  if (!config.enabled) return [];

  const existingByDay = new Map<DayOfWeek, CalendarBlock>();
  for (const block of existingBlocks) {
    if (isManagedWorkShiftBlock(block)) {
      existingByDay.set(block.day, block);
    }
  }

  const workingDays = ORDERED_DAYS.filter((day) => day !== config.restDay);
  const title = config.title.trim() || DEFAULT_NIGHT_WORK_SHIFT.title;
  const location = config.location?.trim() || undefined;

  return workingDays.map((day) => {
    const prev = existingByDay.get(day);
    return {
      id: getWorkShiftBlockId(day),
      day,
      startTime: config.startTime,
      endTime: config.endTime,
      title,
      category: 'trabajo',
      location,
      reminderMinutes: config.reminderMinutes ?? [30],
      syncWithGoogle: config.syncWithGoogle ?? true,
      isRecurringWorkShift: true,
      googleEventId: prev?.googleEventId,
      googleHtmlLink: prev?.googleHtmlLink,
    };
  });
}

/**
 * Replaces managed work shift blocks in `existingBlocks` according to `config`,
 * returning any orphaned Google Event IDs that should be removed from Google Calendar.
 */
export function applyWorkShiftConfigToBlocks(
  existingBlocks: CalendarBlock[],
  config: WorkShiftConfig
): {
  blocks: CalendarBlock[];
  removedGoogleEventIds: string[];
  shiftBlocks: CalendarBlock[];
} {
  const nonShiftBlocks = existingBlocks.filter((block) => !isManagedWorkShiftBlock(block));
  const previousShiftBlocks = existingBlocks.filter((block) => isManagedWorkShiftBlock(block));
  const nextShiftBlocks = buildWorkShiftBlocks(config, previousShiftBlocks);

  const keptGoogleIds = new Set(
    nextShiftBlocks.map((b) => b.googleEventId).filter((id): id is string => Boolean(id))
  );

  const removedGoogleEventIds = previousShiftBlocks
    .map((b) => b.googleEventId)
    .filter((id): id is string => Boolean(id))
    .filter((id) => !keptGoogleIds.has(id));

  return {
    blocks: [...nonShiftBlocks, ...nextShiftBlocks],
    removedGoogleEventIds,
    shiftBlocks: nextShiftBlocks,
  };
}

/**
 * Ensures authenticated real accounts receive the default 22:00-06:00 night work shift
 * (6 nights/week, resting Thursday) on first initialization, without overwriting user edits.
 */
export function ensureDefaultWorkShiftForRealAccount(state: AppState): AppState {
  if (state.workShift !== undefined) {
    return state;
  }

  const hasExistingManagedShifts = state.calendarBlocks.some((block) =>
    isManagedWorkShiftBlock(block)
  );
  const nextConfig: WorkShiftConfig = { ...DEFAULT_NIGHT_WORK_SHIFT };

  if (hasExistingManagedShifts) {
    return {
      ...state,
      workShift: nextConfig,
    };
  }

  const { blocks } = applyWorkShiftConfigToBlocks(state.calendarBlocks, nextConfig);
  return {
    ...state,
    workShift: nextConfig,
    calendarBlocks: blocks,
  };
}

/**
 * Returns the date YYYY-MM-DD shifted by `dayDelta` days without UTC drift.
 */
export function shiftIsoDate(dateIso: string, dayDelta: number): string {
  const [y = 2026, m = 1, d = 1] = dateIso.split('-').map((n) => Number.parseInt(n, 10));
  const date = new Date(y, m - 1, d + dayDelta, 12, 0, 0, 0);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
