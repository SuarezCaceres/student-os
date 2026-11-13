import type { CalendarBlock, DayOfWeek } from '../types';
import type { GoogleCalendarEvent } from '../services/googleCalendar';
import type { BusyInterval } from './calendarSlotFinder';

function normalizeEventTitle(title?: string): string {
  return (title ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Checks whether a synced Google Calendar event mirrors one of the StudentOS calendar blocks
 * (either by persisted `googleEventId` or by matching day/date, exact time window, and title).
 */
export function doesGoogleEventMirrorBlock(
  event: GoogleCalendarEvent,
  block: CalendarBlock,
  weekDates?: Partial<Record<DayOfWeek, string>>
): boolean {
  if (block.googleEventId && event.id === block.googleEventId) {
    return true;
  }

  const blockDateIso = weekDates?.[block.day];
  const sameDayOrDate =
    event.day === block.day || (Boolean(blockDateIso) && event.dateIso === blockDateIso);

  if (!sameDayOrDate) return false;
  if (event.startTime !== block.startTime || event.endTime !== block.endTime) {
    return false;
  }

  return normalizeEventTitle(event.title) === normalizeEventTitle(block.title);
}

/**
 * Excludes any `googleEvents` and `externalBusyByDate` entries that mirror `gymBlocks`.
 * Used both when previewing an overwrite in Step 5 of Gym onboarding and when deleting
 * old/orphaned Gym blocks so removed sessions never trigger phantom collisions.
 */
export function stripMatchingGymSources(params: {
  gymBlocks: CalendarBlock[];
  googleEvents?: GoogleCalendarEvent[];
  externalBusyByDate?: Record<string, BusyInterval[]>;
  weekDates?: Partial<Record<DayOfWeek, string>>;
}): {
  filteredGoogleEvents: GoogleCalendarEvent[];
  removedGoogleEvents: GoogleCalendarEvent[];
  removedGoogleEventIds: string[];
  filteredBusyByDate: Record<string, BusyInterval[]>;
} {
  const { gymBlocks, googleEvents = [], externalBusyByDate = {}, weekDates } = params;

  if (gymBlocks.length === 0) {
    return {
      filteredGoogleEvents: googleEvents,
      removedGoogleEvents: [],
      removedGoogleEventIds: [],
      filteredBusyByDate: externalBusyByDate,
    };
  }

  const removedIdSet = new Set<string>();
  for (const block of gymBlocks) {
    if (block.googleEventId) {
      removedIdSet.add(block.googleEventId);
    }
  }

  const removedGoogleEvents: GoogleCalendarEvent[] = [];
  const filteredGoogleEvents: GoogleCalendarEvent[] = [];

  for (const ev of googleEvents) {
    const matchesBlock =
      removedIdSet.has(ev.id) ||
      gymBlocks.some((block) => doesGoogleEventMirrorBlock(ev, block, weekDates));

    if (matchesBlock) {
      removedGoogleEvents.push(ev);
      removedIdSet.add(ev.id);
    } else {
      filteredGoogleEvents.push(ev);
    }
  }

  const filteredBusyByDate: Record<string, BusyInterval[]> = {};
  for (const [dateKey, intervals] of Object.entries(externalBusyByDate)) {
    const remaining = intervals.filter((interval) => {
      const intervalDate = interval.dateIso ?? dateKey;
      const intervalTitle = normalizeEventTitle(interval.title);

      const matchesRemovedGoogleEvent = removedGoogleEvents.some(
        (ev) =>
          ev.dateIso === intervalDate &&
          ev.startTime === interval.startTime &&
          ev.endTime === interval.endTime &&
          normalizeEventTitle(ev.title) === intervalTitle
      );
      if (matchesRemovedGoogleEvent) return false;

      const matchesGymBlock = gymBlocks.some((block) => {
        const blockDateIso = weekDates?.[block.day];
        const sameDayOrDate =
          interval.day === block.day || (Boolean(blockDateIso) && intervalDate === blockDateIso);
        return (
          sameDayOrDate &&
          block.startTime === interval.startTime &&
          block.endTime === interval.endTime &&
          normalizeEventTitle(block.title) === intervalTitle
        );
      });

      return !matchesGymBlock;
    });

    if (remaining.length > 0) {
      filteredBusyByDate[dateKey] = remaining;
    }
  }

  return {
    filteredGoogleEvents,
    removedGoogleEvents,
    removedGoogleEventIds: Array.from(removedIdSet),
    filteredBusyByDate,
  };
}
