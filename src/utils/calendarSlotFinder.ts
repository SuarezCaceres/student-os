import type { CalendarBlock, DayOfWeek } from '../types';
import { getCurrentWeekDateMap } from './gymAttendance';

export const CALENDAR_START_HOUR = 7; // 07:00 (matches CalendarTimelineGrid)
export const CALENDAR_END_HOUR = 22; // 22:00 (matches CalendarTimelineGrid)
export const CALENDAR_START_MINUTES = CALENDAR_START_HOUR * 60; // 420
export const CALENDAR_END_MINUTES = CALENDAR_END_HOUR * 60; // 1320

export interface BusyInterval {
  startTime: string;
  endTime: string;
  title: string;
  source: 'local' | 'google';
  dateIso?: string;
  day?: DayOfWeek;
}

export interface FreeTwoHourSlot {
  id: string;
  day: DayOfWeek;
  dateIso: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  periodLabel: 'Mañana' | 'Tarde' | 'Noche';
  sourceBadge: string;
  description: string;
  score: number;
}

export interface SlotFinderOptions {
  daysCandidate: DayOfWeek[];
  calendarBlocks: CalendarBlock[];
  externalBusyByDate?: Record<string, BusyInterval[]>;
  weekDates?: Record<DayOfWeek, string>;
  preferredDurationMinutes?: number;
  bufferMinutes?: number;
  limit?: number;
  hasGoogleSync?: boolean;
  minStartMinutesByDay?: Partial<Record<DayOfWeek, number>>;
}

interface MinuteRange {
  start: number;
  end: number;
  title: string;
}

interface CandidateSlotInternal extends FreeTwoHourSlot {
  startMin: number;
  endMin: number;
  dayOrder: number;
}

/**
 * Converts a 24h "HH:mm" time string into minutes from midnight.
 */
export function timeStringToMinutes(timeStr: string): number {
  const [hPart, mPart] = timeStr.trim().split(':');
  const hours = Number.parseInt(hPart ?? '0', 10);
  const minutes = Number.parseInt(mPart ?? '0', 10);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;
  const clampedHours = Math.max(0, Math.min(24, hours));
  const clampedMinutes = clampedHours === 24 ? 0 : Math.max(0, Math.min(59, minutes));
  return clampedHours * 60 + clampedMinutes;
}

/**
 * Formats minutes from midnight into zero-padded 24h "HH:mm".
 */
export function minutesToTimeString(totalMinutes: number): string {
  const safe = Math.max(0, Math.min(24 * 60, Math.round(totalMinutes)));
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function getPeriodLabel(startMinutes: number): 'Mañana' | 'Tarde' | 'Noche' {
  if (startMinutes < 12 * 60) return 'Mañana';
  if (startMinutes < 18 * 60) return 'Tarde';
  return 'Noche';
}

function mergeMinuteRanges(ranges: MinuteRange[]): MinuteRange[] {
  if (ranges.length === 0) return [];
  const sorted = [...ranges].sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: MinuteRange[] = [{ ...sorted[0] }];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];
    if (current.start <= last.end) {
      last.end = Math.max(last.end, current.end);
      if (current.title && !last.title.includes(current.title)) {
        last.title = `${last.title} / ${current.title}`;
      }
    } else {
      merged.push({ ...current });
    }
  }

  return merged;
}

function buildSlotDescription(
  startMin: number,
  endMin: number,
  rawBusy: MinuteRange[],
  usedTightFallback: boolean
): string {
  let prevBlock: MinuteRange | undefined;
  let nextBlock: MinuteRange | undefined;

  for (const item of rawBusy) {
    if (item.end <= startMin) {
      prevBlock = item;
    } else if (!nextBlock && item.start >= endMin) {
      nextBlock = item;
    }
  }

  const tightSuffix = usedTightFallback ? ' (ajuste exacto entre bloques)' : '';

  if (prevBlock && nextBlock) {
    return `Entre "${prevBlock.title}" (${minutesToTimeString(prevBlock.end)}) y "${nextBlock.title}" (${minutesToTimeString(nextBlock.start)})${tightSuffix}.`;
  }
  if (prevBlock) {
    return `Libre después de "${prevBlock.title}" (termina ${minutesToTimeString(prevBlock.end)})${tightSuffix}.`;
  }
  if (nextBlock) {
    return `Despejado antes de "${nextBlock.title}" (inicia ${minutesToTimeString(nextBlock.start)})${tightSuffix}.`;
  }
  if (rawBusy.length === 0) {
    return 'Día completamente libre dentro de la franja 07:00 – 22:00.';
  }
  return 'Ventana continua de 2 horas sin cruces en tu agenda.';
}

function scoreCandidateSlot(params: {
  startMin: number;
  endMin: number;
  dayStartBound: number;
  dayOrder: number;
  bufferMinutes: number;
  rawBusy: MinuteRange[];
}): number {
  const { startMin, endMin, dayStartBound, dayOrder, bufferMinutes, rawBusy } = params;
  let score = 60;

  // Clean clock-hour starts are easiest to plan around
  if (startMin % 60 === 0) {
    score += 8;
  } else if (startMin % 30 === 0) {
    score += 3;
  }

  // Light natural preference for balanced student training windows without excluding morning/evening
  if (startMin >= 16 * 60 && startMin <= 19 * 60 + 30) {
    score += 16;
  } else if (startMin >= 8 * 60 && startMin <= 10 * 60 + 30) {
    score += 13;
  } else if (startMin >= 14 * 60 && startMin < 16 * 60) {
    score += 12;
  } else if (startMin >= 20 * 60) {
    score += 9;
  } else {
    score += 6;
  }

  // Reward breathing room before and after adjacent blocks
  let prevEnd = dayStartBound;
  let nextStart = CALENDAR_END_MINUTES;
  for (const item of rawBusy) {
    if (item.end <= startMin) {
      prevEnd = Math.max(prevEnd, item.end);
    } else if (item.start >= endMin) {
      nextStart = Math.min(nextStart, item.start);
      break;
    }
  }

  const clearanceBefore = prevEnd === dayStartBound && rawBusy.every((r) => r.end > startMin)
    ? bufferMinutes
    : startMin - prevEnd;
  const clearanceAfter = nextStart === CALENDAR_END_MINUTES && rawBusy.every((r) => r.start < endMin)
    ? bufferMinutes
    : nextStart - endMin;

  if (clearanceBefore >= bufferMinutes && clearanceAfter >= bufferMinutes) {
    score += 8;
  } else if (clearanceBefore === 0 || clearanceAfter === 0) {
    score -= 10;
  }

  // Slight tie-breaker favoring earlier candidate days
  score += Math.max(0, 4 - dayOrder);

  return Math.max(1, Math.min(100, score));
}

function generateDayCandidates(params: {
  day: DayOfWeek;
  dateIso: string;
  dayOrder: number;
  dayStartBound: number;
  rawIntervals: MinuteRange[];
  durationMinutes: number;
  bufferMinutes: number;
  applyBuffer: boolean;
  sourceBadge: string;
}): CandidateSlotInternal[] {
  const {
    day,
    dateIso,
    dayOrder,
    dayStartBound,
    rawIntervals,
    durationMinutes,
    bufferMinutes,
    applyBuffer,
    sourceBadge,
  } = params;

  if (dayStartBound + durationMinutes > CALENDAR_END_MINUTES) {
    return [];
  }

  const effectiveBuffer = applyBuffer ? Math.max(0, bufferMinutes) : 0;

  const rawClamped: MinuteRange[] = [];
  const bufferedClamped: MinuteRange[] = [];

  for (const interval of rawIntervals) {
    if (interval.end <= interval.start) continue;

    if (interval.end > dayStartBound && interval.start < CALENDAR_END_MINUTES) {
      rawClamped.push({
        start: Math.max(dayStartBound, interval.start),
        end: Math.min(CALENDAR_END_MINUTES, interval.end),
        title: interval.title,
      });
    }

    if (
      interval.end > dayStartBound - effectiveBuffer &&
      interval.start < CALENDAR_END_MINUTES + effectiveBuffer
    ) {
      bufferedClamped.push({
        start: Math.max(dayStartBound, interval.start - effectiveBuffer),
        end: Math.min(CALENDAR_END_MINUTES, interval.end + effectiveBuffer),
        title: interval.title,
      });
    }
  }

  const mergedRaw = mergeMinuteRanges(rawClamped);
  const mergedBusy = mergeMinuteRanges(bufferedClamped);

  const freeGaps: { start: number; end: number }[] = [];
  let cursor = dayStartBound;

  for (const busy of mergedBusy) {
    if (busy.start > cursor) {
      freeGaps.push({ start: cursor, end: busy.start });
    }
    cursor = Math.max(cursor, busy.end);
  }
  if (cursor < CALENDAR_END_MINUTES) {
    freeGaps.push({ start: cursor, end: CALENDAR_END_MINUTES });
  }

  const candidates: CandidateSlotInternal[] = [];

  for (const gap of freeGaps) {
    if (gap.end - gap.start < durationMinutes) continue;

    const firstAligned = Math.ceil(gap.start / 30) * 30;
    const startPoints: number[] = [];

    for (let s = firstAligned; s + durationMinutes <= gap.end; s += 30) {
      startPoints.push(s);
    }

    if (startPoints.length === 0) {
      startPoints.push(gap.start);
    }

    for (const startMin of startPoints) {
      const endMin = startMin + durationMinutes;
      const startTime = minutesToTimeString(startMin);
      const endTime = minutesToTimeString(endMin);
      const periodLabel = getPeriodLabel(startMin);

      candidates.push({
        id: `${dateIso || day.toLowerCase()}-${startTime.replace(':', '')}`,
        day,
        dateIso,
        startTime,
        endTime,
        durationMinutes,
        periodLabel,
        sourceBadge,
        description: buildSlotDescription(startMin, endMin, mergedRaw, !applyBuffer),
        score: scoreCandidateSlot({
          startMin,
          endMin,
          dayStartBound,
          dayOrder,
          bufferMinutes,
          rawBusy: mergedRaw,
        }),
        startMin,
        endMin,
        dayOrder,
      });
    }
  }

  return candidates;
}

/**
 * Finds scored, collision-free 2-hour training windows across candidate days
 * by merging local WeeklyCalendar blocks and optional Google Calendar freeBusy intervals.
 */
export function findFreeTwoHourSlots(options: SlotFinderOptions): FreeTwoHourSlot[] {
  const {
    daysCandidate,
    calendarBlocks,
    externalBusyByDate,
    weekDates = getCurrentWeekDateMap(),
    preferredDurationMinutes = 120,
    bufferMinutes = 15,
    limit = 6,
    hasGoogleSync,
    minStartMinutesByDay,
  } = options;

  if (daysCandidate.length === 0 || limit <= 0) return [];

  const uniqueDays: DayOfWeek[] = [];
  for (const day of daysCandidate) {
    if (!uniqueDays.includes(day)) uniqueDays.push(day);
  }

  const googleSynced =
    hasGoogleSync ?? Boolean(externalBusyByDate && Object.keys(externalBusyByDate).length > 0);
  const sourceBadge = googleSynced
    ? 'Libre en Horario + Google Calendar'
    : 'Sin choques en Horario';

  const nonOverlappingByDay: CandidateSlotInternal[][] = [];
  const allCandidatesByDay: CandidateSlotInternal[][] = [];

  uniqueDays.forEach((day, dayOrder) => {
    const dateIso = weekDates[day] ?? '';
    const dayStartBound = Math.max(
      CALENDAR_START_MINUTES,
      minStartMinutesByDay?.[day] ?? CALENDAR_START_MINUTES
    );

    const localIntervals: MinuteRange[] = calendarBlocks
      .filter((b) => b.day === day)
      .map((b) => ({
        start: timeStringToMinutes(b.startTime),
        end: timeStringToMinutes(b.endTime),
        title: b.title || 'Bloque ocupado',
      }));

    const googleIntervals: MinuteRange[] = (dateIso ? externalBusyByDate?.[dateIso] : undefined)?.map(
      (b) => ({
        start: timeStringToMinutes(b.startTime),
        end: timeStringToMinutes(b.endTime),
        title: b.title || 'Google Calendar',
      })
    ) ?? [];

    const rawIntervals = [...localIntervals, ...googleIntervals];

    let dayCandidates = generateDayCandidates({
      day,
      dateIso,
      dayOrder,
      dayStartBound,
      rawIntervals,
      durationMinutes: preferredDurationMinutes,
      bufferMinutes,
      applyBuffer: true,
      sourceBadge,
    });

    // If buffer excluded every exact fit on this day, retry without buffer as fallback
    if (dayCandidates.length === 0 && bufferMinutes > 0) {
      dayCandidates = generateDayCandidates({
        day,
        dateIso,
        dayOrder,
        dayStartBound,
        rawIntervals,
        durationMinutes: preferredDurationMinutes,
        bufferMinutes,
        applyBuffer: false,
        sourceBadge,
      });
    }

    const sortedDay = [...dayCandidates].sort(
      (a, b) => b.score - a.score || a.startMin - b.startMin
    );
    allCandidatesByDay.push(sortedDay);

    // Keep genuinely non-overlapping slots within the same day (plus distinct periods)
    const distinctForDay: CandidateSlotInternal[] = [];
    for (const cand of sortedDay) {
      const overlapsPicked = distinctForDay.some(
        (picked) => Math.abs(picked.startMin - cand.startMin) < preferredDurationMinutes
      );
      if (!overlapsPicked) {
        distinctForDay.push(cand);
      }
    }
    nonOverlappingByDay.push(distinctForDay);
  });

  // Round-robin across days so options span the whole candidate week instead of clustering on 1 day
  const selected: CandidateSlotInternal[] = [];
  const selectedIds = new Set<string>();
  const maxDepth = Math.max(0, ...nonOverlappingByDay.map((arr) => arr.length));

  for (let round = 0; round < maxDepth && selected.length < limit; round++) {
    const roundPicks: CandidateSlotInternal[] = [];
    for (const dayList of nonOverlappingByDay) {
      if (dayList[round]) roundPicks.push(dayList[round]);
    }
    roundPicks.sort((a, b) => b.score - a.score || a.dayOrder - b.dayOrder);

    for (const pick of roundPicks) {
      if (selected.length >= limit) break;
      if (!selectedIds.has(pick.id)) {
        selected.push(pick);
        selectedIds.add(pick.id);
      }
    }
  }

  // If very few slots exist overall (e.g. single packed day), allow staggered >= 60min alternatives
  if (selected.length < Math.min(limit, 2)) {
    const staggeredPool = allCandidatesByDay
      .flat()
      .sort((a, b) => b.score - a.score || a.dayOrder - b.dayOrder);
    for (const cand of staggeredPool) {
      if (selected.length >= limit) break;
      if (selectedIds.has(cand.id)) continue;
      const tooClose = selected.some(
        (s) => s.day === cand.day && Math.abs(s.startMin - cand.startMin) < 60
      );
      if (!tooClose) {
        selected.push(cand);
        selectedIds.add(cand.id);
      }
    }
  }

  return selected
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.dateIso.localeCompare(b.dateIso) ||
        a.startMin - b.startMin
    )
    .map(({ startMin: _startMin, endMin: _endMin, dayOrder: _dayOrder, ...slot }) => slot);
}

/**
 * Builds a CalendarBlock-compatible payload for placing a 2-hour gym session in WeeklyCalendar.
 */
export function buildGymCalendarBlockPayload(params: {
  day: DayOfWeek;
  startTime: string;
  endTime: string;
  routineName: string;
  gymLocation?: string;
  googleEventId?: string;
}): CalendarBlock & { googleEventId?: string } {
  const { day, startTime, endTime, routineName, gymLocation, googleEventId } = params;
  const trimmedName = routineName.trim();
  const title = trimmedName
    ? /^(gym|gimnasio)\b/i.test(trimmedName)
      ? trimmedName
      : `Gym: ${trimmedName}`
    : 'Sesión de Gimnasio';

  const block: CalendarBlock & { googleEventId?: string } = {
    id: `cal-gym-${day.toLowerCase()}-${startTime.replace(':', '')}-${Date.now()}`,
    day,
    startTime,
    endTime,
    title,
    category: 'gym',
    location: gymLocation?.trim() || undefined,
  };

  if (googleEventId) {
    block.googleEventId = googleEventId;
  }

  return block;
}

/**
 * Generates a no-OAuth fallback Google Calendar event creation URL using local wall-clock time + IANA zone.
 */
export function buildGoogleCalendarTemplateUrl(params: {
  title: string;
  dateIso: string;
  startTime: string;
  endTime: string;
  location?: string;
  description?: string;
  timeZone?: string;
}): string {
  const { title, dateIso, startTime, endTime, location, description, timeZone } = params;
  const resolvedTz =
    timeZone ||
    (typeof Intl !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : undefined) ||
    'America/Bogota';

  const compactDate = dateIso.replace(/-/g, '');
  const compactTime = (t: string): string => {
    const [hh = '00', mm = '00'] = t.trim().split(':');
    return `${hh.padStart(2, '0')}${mm.padStart(2, '0')}00`;
  };

  const url = new URL('https://calendar.google.com/calendar/render');
  url.searchParams.set('action', 'TEMPLATE');
  url.searchParams.set('text', title.trim() || 'Entrenamiento de Gimnasio');
  url.searchParams.set(
    'dates',
    `${compactDate}T${compactTime(startTime)}/${compactDate}T${compactTime(endTime)}`
  );
  url.searchParams.set('ctz', resolvedTz);

  if (location?.trim()) {
    url.searchParams.set('location', location.trim());
  }
  if (description?.trim()) {
    url.searchParams.set('details', description.trim());
  }

  return url.toString();
}
