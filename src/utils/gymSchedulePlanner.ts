import type { CalendarBlock, DayOfWeek } from '../types';
import type { GoogleCalendarEvent } from '../services/googleCalendar';
import {
  CALENDAR_END_MINUTES,
  CALENDAR_START_MINUTES,
  findFreeTwoHourSlots,
  minutesToTimeString,
  timeStringToMinutes,
  type BusyInterval,
  type FreeTwoHourSlot,
} from './calendarSlotFinder';
import { getCurrentWeekDateMap } from './gymAttendance';
import { expandCalendarBlocksToSegments } from './workSchedule';

export type PreferredTrainingPeriod = 'auto' | 'manana' | 'tarde' | 'noche';

export interface ScheduledGymSlotDraft {
  day: DayOfWeek;
  dateIso: string;
  startTime: string; // HH:mm (bloque 2h)
  endTime: string; // HH:mm
  source: 'recommended' | 'custom';
  hasConflict: boolean;
  conflictTitle?: string;
  conflictSource?: 'google' | 'local';
  conflictStart?: string;
  conflictEnd?: string;
}

export interface TimelineOccupiedItem {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  source: 'google' | 'local';
  isAllDay?: boolean;
}

export interface SlotConflictValidation {
  hasConflict: boolean;
  conflictTitle?: string;
  conflictSource?: 'google' | 'local';
  conflictStart?: string;
  conflictEnd?: string;
}

export const GYM_SESSION_DURATION_MINUTES = 120;

export const MANUAL_GYM_START_OPTIONS: string[] = Array.from(
  { length: (20 - 6) * 2 + 1 },
  (_, index) => minutesToTimeString(6 * 60 + index * 30)
);

function buildEffectiveExternalBusyByDate(
  externalBusyByDate?: Record<string, BusyInterval[]>,
  googleEvents?: GoogleCalendarEvent[]
): Record<string, BusyInterval[]> {
  const merged: Record<string, BusyInterval[]> = {};

  if (externalBusyByDate) {
    for (const [dateIso, list] of Object.entries(externalBusyByDate)) {
      merged[dateIso] = [...list];
    }
  }

  if (googleEvents && googleEvents.length > 0) {
    for (const ev of googleEvents) {
      if (ev.isAllDay) continue;
      const list = merged[ev.dateIso] ?? [];
      const alreadyPresent = list.some(
        (item) =>
          item.startTime === ev.startTime &&
          item.endTime === ev.endTime &&
          item.title.trim().toLowerCase() === ev.title.trim().toLowerCase()
      );
      if (!alreadyPresent) {
        list.push({
          startTime: ev.startTime,
          endTime: ev.endTime,
          title: ev.title,
          source: 'google',
          dateIso: ev.dateIso,
          day: ev.day,
        });
      }
      merged[ev.dateIso] = list;
    }
  }

  return merged;
}

function getPeriodPreferenceScoreAdjustment(
  startMinutes: number,
  preferredPeriod: PreferredTrainingPeriod
): number {
  if (preferredPeriod === 'auto') return 0;

  if (preferredPeriod === 'manana') {
    if (startMinutes === 6 * 60) return 38;
    if (startMinutes > 6 * 60 && startMinutes < 12 * 60) return 35;
    if (startMinutes < 14 * 60) return 8;
    return -12;
  }

  if (preferredPeriod === 'tarde') {
    if (startMinutes >= 14 * 60 && startMinutes < 18 * 60) return 35;
    if (startMinutes >= 12 * 60 && startMinutes < 14 * 60) return 10;
    return -12;
  }

  // 'noche'
  if (startMinutes >= 18 * 60 && startMinutes <= 20 * 60) return 35;
  if (startMinutes >= 16 * 60 && startMinutes < 18 * 60) return 10;
  return -12;
}

/**
 * Returns chronologically ordered occupied blocks (Google Calendar + StudentOS local blocks)
 * for rendering inside a day's compact mini-agenda timeline.
 */
export function getDayOccupiedTimeline(params: {
  day: DayOfWeek;
  dateIso: string;
  calendarBlocks: CalendarBlock[];
  externalBusyByDate?: Record<string, BusyInterval[]>;
  googleEvents?: GoogleCalendarEvent[];
}): TimelineOccupiedItem[] {
  const { day, dateIso, calendarBlocks, externalBusyByDate, googleEvents } = params;
  const items: TimelineOccupiedItem[] = [];
  const seenKeys = new Set<string>();

  const pushUnique = (item: TimelineOccupiedItem) => {
    const key = `${item.source}:${item.isAllDay ? 'all' : `${item.startTime}-${item.endTime}`}:${item.title
      .trim()
      .toLowerCase()}`;
    if (seenKeys.has(key)) return;
    seenKeys.add(key);
    items.push(item);
  };

  for (const ev of googleEvents ?? []) {
    if (ev.dateIso !== dateIso && ev.day !== day) continue;
    pushUnique({
      id: `google-${ev.id}-${ev.dateIso}`,
      title: ev.title,
      startTime: ev.startTime,
      endTime: ev.endTime,
      source: 'google',
      isAllDay: ev.isAllDay,
    });
  }

  for (const busy of externalBusyByDate?.[dateIso] ?? []) {
    pushUnique({
      id: `busy-${dateIso}-${busy.startTime}-${busy.endTime}-${busy.title}`,
      title: busy.title || 'Google Calendar',
      startTime: busy.startTime,
      endTime: busy.endTime,
      source: busy.source,
    });
  }

  const localSegments = expandCalendarBlocksToSegments(calendarBlocks);
  for (const seg of localSegments) {
    if (seg.day !== day) continue;
    const title =
      seg.segmentRole === 'overnight_continuation'
        ? `${seg.block.title} (turno ${seg.originDay})`
        : seg.block.title;
    pushUnique({
      id: `local-${seg.segmentId}`,
      title,
      startTime: seg.startTime,
      endTime: seg.endTime,
      source: 'local',
    });
  }

  return items.sort((a, b) => {
    if (Boolean(a.isAllDay) !== Boolean(b.isAllDay)) return a.isAllDay ? -1 : 1;
    return (
      timeStringToMinutes(a.startTime) - timeStringToMinutes(b.startTime) ||
      a.source.localeCompare(b.source)
    );
  });
}

/**
 * Validates a manual 2-hour training slot against local calendar blocks and Google Calendar events.
 */
export function validateGymSlotAgainstCalendar(params: {
  day: DayOfWeek;
  dateIso: string;
  startTime: string;
  durationMinutes?: number;
  calendarBlocks: CalendarBlock[];
  externalBusyByDate?: Record<string, BusyInterval[]>;
  googleEvents?: GoogleCalendarEvent[];
}): SlotConflictValidation {
  const {
    day,
    dateIso,
    startTime,
    durationMinutes = GYM_SESSION_DURATION_MINUTES,
    calendarBlocks,
    externalBusyByDate,
    googleEvents,
  } = params;

  const slotStart = timeStringToMinutes(startTime);
  const slotEnd = slotStart + durationMinutes;

  if (slotStart < CALENDAR_START_MINUTES || slotEnd > CALENDAR_END_MINUTES) {
    return {
      hasConflict: true,
      conflictTitle: 'Horario fuera de rango permitido (06:00–22:00)',
      conflictSource: 'local',
      conflictStart: minutesToTimeString(slotStart),
      conflictEnd: minutesToTimeString(slotEnd),
    };
  }

  const effectiveBusyByDate = buildEffectiveExternalBusyByDate(externalBusyByDate, googleEvents);
  const googleIntervals = effectiveBusyByDate[dateIso] ?? [];

  for (const busy of googleIntervals) {
    const busyStart = timeStringToMinutes(busy.startTime);
    const busyEnd = timeStringToMinutes(busy.endTime);
    if (Math.max(slotStart, busyStart) < Math.min(slotEnd, busyEnd)) {
      return {
        hasConflict: true,
        conflictTitle: busy.title || 'Evento en Google Calendar',
        conflictSource: busy.source,
        conflictStart: busy.startTime,
        conflictEnd: busy.endTime,
      };
    }
  }

  const localSegments = expandCalendarBlocksToSegments(calendarBlocks);
  for (const seg of localSegments) {
    if (seg.day !== day) continue;
    const blockStart = timeStringToMinutes(seg.startTime);
    const blockEnd = timeStringToMinutes(seg.endTime);
    if (Math.max(slotStart, blockStart) < Math.min(slotEnd, blockEnd)) {
      return {
        hasConflict: true,
        conflictTitle:
          seg.segmentRole === 'overnight_continuation'
            ? `${seg.block.title} (turno ${seg.originDay})`
            : seg.block.title,
        conflictSource: 'local',
        conflictStart: seg.startTime,
        conflictEnd: seg.endTime,
      };
    }
  }

  return { hasConflict: false };
}

/**
 * Returns up to `limit` collision-free 2-hour slots for one day, biased toward the chosen period.
 */
export function getDayFreeSuggestions(params: {
  day: DayOfWeek;
  dateIso: string;
  preferredPeriod: PreferredTrainingPeriod;
  calendarBlocks: CalendarBlock[];
  externalBusyByDate?: Record<string, BusyInterval[]>;
  googleEvents?: GoogleCalendarEvent[];
  weekDates?: Record<DayOfWeek, string>;
  limit?: number;
}): FreeTwoHourSlot[] {
  const {
    day,
    dateIso,
    preferredPeriod,
    calendarBlocks,
    externalBusyByDate,
    googleEvents,
    weekDates = getCurrentWeekDateMap(),
    limit = 3,
  } = params;

  const effectiveBusyByDate = buildEffectiveExternalBusyByDate(externalBusyByDate, googleEvents);
  const effectiveWeekDates = { ...weekDates, [day]: dateIso };

  const candidates = findFreeTwoHourSlots({
    daysCandidate: [day],
    calendarBlocks,
    externalBusyByDate: effectiveBusyByDate,
    weekDates: effectiveWeekDates,
    preferredDurationMinutes: GYM_SESSION_DURATION_MINUTES,
    bufferMinutes: 15,
    limit: 24,
    hasGoogleSync: Object.keys(effectiveBusyByDate).length > 0,
  });

  if (candidates.length === 0) return [];

  const rescored = [...candidates]
    .map((slot) => {
      const startMin = timeStringToMinutes(slot.startTime);
      const bias = getPeriodPreferenceScoreAdjustment(startMin, preferredPeriod);
      return {
        slot,
        biasedScore: slot.score + bias,
        startMin,
      };
    })
    .sort((a, b) => b.biasedScore - a.biasedScore || a.startMin - b.startMin);

  const picked: FreeTwoHourSlot[] = [];
  for (const item of rescored) {
    const overlapsPicked = picked.some(
      (existing) => Math.abs(timeStringToMinutes(existing.startTime) - item.startMin) < 60
    );
    if (!overlapsPicked || picked.length === 0) {
      picked.push({
        ...item.slot,
        score: Math.max(1, Math.min(100, item.biasedScore)),
      });
    }
    if (picked.length >= limit) break;
  }

  return picked;
}

/**
 * Generates an optimal non-conflicting weekly gym schedule draft for every selected training day.
 */
export function recommendWeeklyGymSlots(params: {
  selectedDays: DayOfWeek[];
  preferredPeriod: PreferredTrainingPeriod;
  calendarBlocks: CalendarBlock[];
  externalBusyByDate?: Record<string, BusyInterval[]>;
  googleEvents?: GoogleCalendarEvent[];
  weekDates?: Record<DayOfWeek, string>;
}): ScheduledGymSlotDraft[] {
  const {
    selectedDays,
    preferredPeriod,
    calendarBlocks,
    externalBusyByDate,
    googleEvents,
    weekDates = getCurrentWeekDateMap(),
  } = params;

  const effectiveBusyByDate = buildEffectiveExternalBusyByDate(externalBusyByDate, googleEvents);

  return selectedDays.map((day) => {
    const dateIso = weekDates[day] ?? '';
    const suggestions = getDayFreeSuggestions({
      day,
      dateIso,
      preferredPeriod,
      calendarBlocks,
      externalBusyByDate: effectiveBusyByDate,
      weekDates,
      limit: 1,
    });

    if (suggestions.length > 0) {
      const best = suggestions[0];
      return {
        day,
        dateIso: best.dateIso || dateIso,
        startTime: best.startTime,
        endTime: best.endTime,
        source: 'recommended',
        hasConflict: false,
      };
    }

    const fallbackStart =
      preferredPeriod === 'manana' ? '06:00' : preferredPeriod === 'tarde' ? '15:00' : '18:00';
    const fallbackEnd = minutesToTimeString(
      timeStringToMinutes(fallbackStart) + GYM_SESSION_DURATION_MINUTES
    );
    const conflict = validateGymSlotAgainstCalendar({
      day,
      dateIso,
      startTime: fallbackStart,
      calendarBlocks,
      externalBusyByDate: effectiveBusyByDate,
      googleEvents,
    });

    return {
      day,
      dateIso,
      startTime: fallbackStart,
      endTime: fallbackEnd,
      source: 'recommended',
      hasConflict: conflict.hasConflict,
      conflictTitle: conflict.conflictTitle,
      conflictSource: conflict.conflictSource,
      conflictStart: conflict.conflictStart,
      conflictEnd: conflict.conflictEnd,
    };
  });
}
