import type { CalendarBlock, DayOfWeek } from '../types';
import type { GoogleCalendarEvent } from '../services/googleCalendar';
import {
  findFreeTwoHourSlots,
  minutesToTimeString,
  timeStringToMinutes,
  type BusyInterval,
} from './calendarSlotFinder';
import { getCurrentWeekDateMap } from './gymAttendance';
import { ORDERED_DAYS } from './routineGenerator';
import { expandCalendarBlocksToSegments, isOvernightTimeRange } from './workSchedule';
import { isStudentOsGymGoogleEvent } from './gymScheduleFilter';

export const GOOGLE_SNAPSHOT_STORAGE_KEY = 'student_os_gcal_snapshot_v1';

export type GoogleChangeKind = 'added' | 'moved' | 'updated' | 'deleted';

export interface GoogleScheduleChange {
  id: string;
  eventId: string;
  kind: GoogleChangeKind;
  title: string;
  day: DayOfWeek;
  dateIso: string;
  startTime: string;
  endTime: string;
  previousDay?: DayOfWeek;
  previousDateIso?: string;
  previousStartTime?: string;
  previousEndTime?: string;
  isStudentOsBlock: boolean;
  isAllDay?: boolean;
}

export interface ScheduleSolutionOption {
  id: string;
  blockId: string;
  blockTitle: string;
  targetDay: DayOfWeek;
  targetDateIso: string;
  startTime: string;
  endTime: string;
  description: string;
  periodLabel: 'Mañana' | 'Tarde' | 'Noche';
}

export interface ScheduleConflictDetail {
  id: string;
  day: DayOfWeek;
  dateIso: string;
  overlapStart: string;
  overlapEnd: string;
  localBlock: CalendarBlock;
  conflictingWithTitle: string;
  conflictingWithSource: 'google' | 'local';
  conflictingStart: string;
  conflictingEnd: string;
  solutions: ScheduleSolutionOption[];
}

export interface GoogleImpactReport {
  detectedAt: string;
  changes: GoogleScheduleChange[];
  mirroredMovesCount: number;
  mirroredDeletesCount: number;
  status: 'no_conflict' | 'conflict';
  conflicts: ScheduleConflictDetail[];
}

interface SnapshotPayload {
  savedAt: string;
  events: GoogleCalendarEvent[];
}

export function loadGoogleEventsSnapshot(): GoogleCalendarEvent[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(GOOGLE_SNAPSHOT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SnapshotPayload>;
    if (!Array.isArray(parsed?.events)) return null;
    return parsed.events;
  } catch {
    return null;
  }
}

export function saveGoogleEventsSnapshot(events: GoogleCalendarEvent[]): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: SnapshotPayload = {
      savedAt: new Date().toISOString(),
      events,
    };
    window.localStorage.setItem(GOOGLE_SNAPSHOT_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage quota or private-browsing errors
  }
}

export function clearGoogleEventsSnapshot(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(GOOGLE_SNAPSHOT_STORAGE_KEY);
  } catch {
    // Ignore
  }
}

function getOccurrenceKey(event: GoogleCalendarEvent): string {
  return `${event.id}::${event.dateIso}`;
}

function pairSingleInstanceMoves(
  addedMap: Map<string, GoogleCalendarEvent>,
  deletedMap: Map<string, GoogleCalendarEvent>
): Array<{ prev: GoogleCalendarEvent; next: GoogleCalendarEvent }> {
  const prevById = new Map<string, GoogleCalendarEvent[]>();
  const nextById = new Map<string, GoogleCalendarEvent[]>();

  for (const ev of deletedMap.values()) {
    const list = prevById.get(ev.id) ?? [];
    list.push(ev);
    prevById.set(ev.id, list);
  }
  for (const ev of addedMap.values()) {
    const list = nextById.get(ev.id) ?? [];
    list.push(ev);
    nextById.set(ev.id, list);
  }

  const pairedMoves: Array<{ prev: GoogleCalendarEvent; next: GoogleCalendarEvent }> = [];
  for (const [id, prevList] of prevById.entries()) {
    const nextList = nextById.get(id);
    if (prevList.length === 1 && nextList && nextList.length === 1) {
      const prev = prevList[0];
      const next = nextList[0];
      pairedMoves.push({ prev, next });
      deletedMap.delete(getOccurrenceKey(prev));
      addedMap.delete(getOccurrenceKey(next));
    }
  }

  return pairedMoves;
}

/**
 * Compares previous vs next Google Calendar weekly snapshots to identify added,
 * moved, updated (title/location), and deleted events.
 */
export function diffGoogleEvents(
  previousEvents: GoogleCalendarEvent[],
  nextEvents: GoogleCalendarEvent[],
  linkedGoogleEventIds?: ReadonlySet<string>
): GoogleScheduleChange[] {
  const prevByKey = new Map<string, GoogleCalendarEvent>();
  const nextByKey = new Map<string, GoogleCalendarEvent>();

  for (const ev of previousEvents) prevByKey.set(getOccurrenceKey(ev), ev);
  for (const ev of nextEvents) nextByKey.set(getOccurrenceKey(ev), ev);

  const changes: GoogleScheduleChange[] = [];
  const unmatchedDeleted = new Map<string, GoogleCalendarEvent>();
  const unmatchedAdded = new Map<string, GoogleCalendarEvent>();

  for (const [key, prev] of prevByKey.entries()) {
    const next = nextByKey.get(key);
    const isLinked = Boolean(
      linkedGoogleEventIds?.has(prev.id) || isStudentOsGymGoogleEvent(prev, linkedGoogleEventIds)
    );

    if (!next) {
      unmatchedDeleted.set(key, prev);
      continue;
    }

    const timeMoved =
      prev.startTime !== next.startTime ||
      prev.endTime !== next.endTime ||
      Boolean(prev.isAllDay) !== Boolean(next.isAllDay);
    const metaChanged =
      prev.title.trim() !== next.title.trim() ||
      (prev.location ?? '').trim() !== (next.location ?? '').trim();

    if (timeMoved || metaChanged) {
      changes.push({
        id: `${timeMoved ? 'moved' : 'updated'}-${key}`,
        eventId: next.id,
        kind: timeMoved ? 'moved' : 'updated',
        title: next.title,
        day: next.day,
        dateIso: next.dateIso,
        startTime: next.startTime,
        endTime: next.endTime,
        previousDay: prev.day,
        previousDateIso: prev.dateIso,
        previousStartTime: prev.startTime,
        previousEndTime: prev.endTime,
        isStudentOsBlock:
          isLinked || isStudentOsGymGoogleEvent(next, linkedGoogleEventIds),
        isAllDay: next.isAllDay,
      });
    }
  }

  for (const [key, next] of nextByKey.entries()) {
    if (!prevByKey.has(key)) {
      unmatchedAdded.set(key, next);
    }
  }

  // Pair cross-day moves for the same Google event ID
  const crossDayMoves = pairSingleInstanceMoves(unmatchedAdded, unmatchedDeleted);
  for (const { prev, next } of crossDayMoves) {
    changes.push({
      id: `moved-${next.id}-${prev.dateIso}-${next.dateIso}`,
      eventId: next.id,
      kind: 'moved',
      title: next.title,
      day: next.day,
      dateIso: next.dateIso,
      startTime: next.startTime,
      endTime: next.endTime,
      previousDay: prev.day,
      previousDateIso: prev.dateIso,
      previousStartTime: prev.startTime,
      previousEndTime: prev.endTime,
      isStudentOsBlock: Boolean(
        linkedGoogleEventIds?.has(next.id) || isStudentOsGymGoogleEvent(next, linkedGoogleEventIds)
      ),
      isAllDay: next.isAllDay,
    });
  }

  for (const [key, added] of unmatchedAdded.entries()) {
    changes.push({
      id: `added-${key}`,
      eventId: added.id,
      kind: 'added',
      title: added.title,
      day: added.day,
      dateIso: added.dateIso,
      startTime: added.startTime,
      endTime: added.endTime,
      isStudentOsBlock: Boolean(
        linkedGoogleEventIds?.has(added.id) ||
          isStudentOsGymGoogleEvent(added, linkedGoogleEventIds)
      ),
      isAllDay: added.isAllDay,
    });
  }

  for (const [key, deleted] of unmatchedDeleted.entries()) {
    changes.push({
      id: `deleted-${key}`,
      eventId: deleted.id,
      kind: 'deleted',
      title: deleted.title,
      day: deleted.day,
      dateIso: deleted.dateIso,
      startTime: deleted.startTime,
      endTime: deleted.endTime,
      isStudentOsBlock: Boolean(
        linkedGoogleEventIds?.has(deleted.id) ||
          isStudentOsGymGoogleEvent(deleted, linkedGoogleEventIds)
      ),
      isAllDay: deleted.isAllDay,
    });
  }

  return changes;
}

function buildSolutionOptionsForBlock(params: {
  block: CalendarBlock;
  otherBlocks: CalendarBlock[];
  externalBusyByDate: Record<string, BusyInterval[]>;
  weekDates: Record<DayOfWeek, string>;
}): ScheduleSolutionOption[] {
  const { block, otherBlocks, externalBusyByDate, weekDates } = params;
  const startMin = timeStringToMinutes(block.startTime);
  const endMin = timeStringToMinutes(block.endTime);
  const durationMinutes = isOvernightTimeRange(block.startTime, block.endTime)
    ? Math.max(30, 24 * 60 - startMin + endMin)
    : Math.max(30, endMin - startMin || 120);

  // Order candidate days starting on the same day, then subsequent days of the week
  const dayIdx = ORDERED_DAYS.indexOf(block.day);
  const candidateDays =
    dayIdx >= 0
      ? [...ORDERED_DAYS.slice(dayIdx), ...ORDERED_DAYS.slice(0, dayIdx)]
      : ORDERED_DAYS;

  const freeSlots = findFreeTwoHourSlots({
    daysCandidate: candidateDays,
    calendarBlocks: otherBlocks,
    externalBusyByDate,
    weekDates,
    preferredDurationMinutes: durationMinutes,
    bufferMinutes: 15,
    limit: 3,
    hasGoogleSync: true,
  });

  return freeSlots.map((slot) => ({
    id: `sol-${block.id}-${slot.id}`,
    blockId: block.id,
    blockTitle: block.title,
    targetDay: slot.day,
    targetDateIso: slot.dateIso,
    startTime: slot.startTime,
    endTime: slot.endTime,
    description: slot.description,
    periodLabel: slot.periodLabel,
  }));
}

/**
 * Evaluates current StudentOS CalendarBlocks against external Google Calendar busy intervals
 * and overlapping sibling blocks, returning concrete 1-click solutions per conflict.
 */
export function evaluateScheduleConflicts(params: {
  blocks: CalendarBlock[];
  googleEvents: GoogleCalendarEvent[];
  externalBusyByDate: Record<string, BusyInterval[]>;
  weekDates?: Record<DayOfWeek, string>;
}): ScheduleConflictDetail[] {
  const {
    blocks,
    googleEvents,
    externalBusyByDate,
    weekDates = getCurrentWeekDateMap(),
  } = params;

  const mirroredEventIds = new Set(
    blocks.map((b) => b.googleEventId).filter((id): id is string => Boolean(id))
  );

  // Include Google-direct StudentOS Gym events so collisions with phone edits are detected
  // even when zero duplicate local gym blocks exist.
  const virtualGoogleGymBlocks: CalendarBlock[] = googleEvents
    .filter((ev) => !ev.isAllDay && !mirroredEventIds.has(ev.id) && isStudentOsGymGoogleEvent(ev))
    .map((ev) => ({
      id: `gcal-gym-${ev.id}`,
      day: ev.day,
      startTime: ev.startTime,
      endTime: ev.endTime,
      title: ev.title,
      category: 'gym' as const,
      location: ev.location,
      googleEventId: ev.id,
      googleHtmlLink: ev.htmlLink,
      reminderMinutes: ev.reminderMinutes,
      syncWithGoogle: true,
    }));

  const evaluatedBlocks = [...blocks, ...virtualGoogleGymBlocks];
  const expandedSegments = expandCalendarBlocksToSegments(evaluatedBlocks);
  const externalTimedByDay = new Map<
    DayOfWeek,
    Array<{ id: string; start: number; end: number; title: string }>
  >();
  const filteredBusyForSolver: Record<string, BusyInterval[]> = {};

  for (const [dateIso, list] of Object.entries(externalBusyByDate)) {
    filteredBusyForSolver[dateIso] = list.filter((item) => {
      const matchesMirrored = expandedSegments.some(
        (seg) =>
          seg.block.googleEventId &&
          seg.day === item.day &&
          seg.startTime === item.startTime &&
          seg.endTime === item.endTime &&
          seg.block.title.trim() === item.title.trim()
      );
      return !matchesMirrored;
    });
  }

  for (const ev of googleEvents) {
    if (ev.isAllDay || mirroredEventIds.has(ev.id)) continue;
    const start = timeStringToMinutes(ev.startTime);
    const end = timeStringToMinutes(ev.endTime);
    if (end <= start) continue;

    const list = externalTimedByDay.get(ev.day) ?? [];
    list.push({ id: ev.id, start, end, title: ev.title });
    externalTimedByDay.set(ev.day, list);
  }

  const conflicts: ScheduleConflictDetail[] = [];

  for (const seg of expandedSegments) {
    const bStart = timeStringToMinutes(seg.startTime);
    const bEnd = timeStringToMinutes(seg.endTime);
    if (bEnd <= bStart) continue;

    const externalMatches = (externalTimedByDay.get(seg.day) ?? []).filter(
      (ext) => ext.id !== seg.block.googleEventId && bStart < ext.end && ext.start < bEnd
    );

    const siblingMatches = expandedSegments.filter((sib) => {
      if (sib.block.id === seg.block.id || sib.day !== seg.day) return false;
      // Avoid duplicate reversed pairs when one is a virtual Google gym block already caught via externalMatches
      if (seg.block.id.startsWith('gcal-gym-') && !sib.block.id.startsWith('gcal-gym-')) {
        return false;
      }
      const sStart = timeStringToMinutes(sib.startTime);
      const sEnd = timeStringToMinutes(sib.endTime);
      return bStart < sEnd && sStart < bEnd;
    });

    const firstExternal = externalMatches[0];
    const firstSibling = siblingMatches[0];
    if (!firstExternal && !firstSibling) continue;

    const conflictStartMin = firstExternal
      ? firstExternal.start
      : timeStringToMinutes(firstSibling!.startTime);
    const conflictEndMin = firstExternal
      ? firstExternal.end
      : timeStringToMinutes(firstSibling!.endTime);

    const overlapStart = minutesToTimeString(Math.max(bStart, conflictStartMin));
    const overlapEnd = minutesToTimeString(Math.min(bEnd, conflictEndMin));

    const otherBlocks = evaluatedBlocks.filter((b) => b.id !== seg.block.id);
    const solutions = buildSolutionOptionsForBlock({
      block: seg.block,
      otherBlocks,
      externalBusyByDate: filteredBusyForSolver,
      weekDates,
    });

    conflicts.push({
      id: `conflict-${seg.segmentId}-${seg.day}-${overlapStart.replace(':', '')}`,
      day: seg.day,
      dateIso: weekDates[seg.day] ?? '',
      overlapStart,
      overlapEnd,
      localBlock: seg.block,
      conflictingWithTitle: firstExternal ? firstExternal.title : firstSibling!.block.title,
      conflictingWithSource: firstExternal ? 'google' : 'local',
      conflictingStart: minutesToTimeString(conflictStartMin),
      conflictingEnd: minutesToTimeString(conflictEndMin),
      solutions,
    });
  }

  return conflicts;
}

/**
 * Applies smart mirroring when StudentOS-linked blocks were moved/edited/deleted from a phone
 * in Google Calendar, then evaluates schedule collisions and returns actionable 1-click fixes.
 */
export function applyMobileMirrorAndEvaluateImpact(params: {
  previousEvents: GoogleCalendarEvent[];
  nextEvents: GoogleCalendarEvent[];
  currentBlocks: CalendarBlock[];
  externalBusyByDate: Record<string, BusyInterval[]>;
  weekDates?: Record<DayOfWeek, string>;
}): {
  mirroredBlocks: CalendarBlock[];
  hasChanges: boolean;
  report: GoogleImpactReport;
} {
  const {
    previousEvents,
    nextEvents,
    currentBlocks,
    externalBusyByDate,
    weekDates = getCurrentWeekDateMap(),
  } = params;

  const linkedGoogleEventIds = new Set(
    currentBlocks.map((b) => b.googleEventId).filter((id): id is string => Boolean(id))
  );

  const changes = diffGoogleEvents(previousEvents, nextEvents, linkedGoogleEventIds);
  const nextSlicesById = new Map<string, GoogleCalendarEvent[]>();
  for (const ev of nextEvents) {
    const list = nextSlicesById.get(ev.id) ?? [];
    list.push(ev);
    nextSlicesById.set(ev.id, list);
  }

  const nextById = new Map<string, GoogleCalendarEvent>();
  for (const [id, slices] of nextSlicesById.entries()) {
    if (slices.length >= 2) {
      const sorted = [...slices].sort((a, b) => a.dateIso.localeCompare(b.dateIso));
      const first = sorted[0];
      const second = sorted[1];
      if (first.endTime === '24:00' && second.startTime === '00:00') {
        nextById.set(id, {
          ...first,
          endTime: second.endTime,
        });
        continue;
      }
    }
    nextById.set(id, slices[0]);
  }

  const deletedEventIds = new Set(
    changes.filter((c) => c.kind === 'deleted' && c.isStudentOsBlock).map((c) => c.eventId)
  );

  let mirroredMovesCount = 0;
  let mirroredDeletesCount = 0;

  const mirroredBlocks: CalendarBlock[] = [];
  for (const block of currentBlocks) {
    if (!block.googleEventId) {
      mirroredBlocks.push(block);
      continue;
    }

    if (deletedEventIds.has(block.googleEventId)) {
      mirroredDeletesCount += 1;
      continue;
    }

    const remote = nextById.get(block.googleEventId);
    if (!remote || remote.isAllDay) {
      mirroredBlocks.push(block);
      continue;
    }

    const changedOnRemote =
      remote.day !== block.day ||
      remote.startTime !== block.startTime ||
      remote.endTime !== block.endTime ||
      remote.title.trim() !== block.title.trim() ||
      (remote.location ?? '').trim() !== (block.location ?? '').trim();

    if (changedOnRemote) {
      mirroredMovesCount += 1;
      mirroredBlocks.push({
        ...block,
        day: remote.day,
        startTime: remote.startTime,
        endTime: remote.endTime,
        title: remote.title,
        location: remote.location,
        googleHtmlLink: remote.htmlLink ?? block.googleHtmlLink,
        reminderMinutes: remote.reminderMinutes ?? block.reminderMinutes,
      });
    } else {
      mirroredBlocks.push(block);
    }
  }

  const conflicts = evaluateScheduleConflicts({
    blocks: mirroredBlocks,
    googleEvents: nextEvents,
    externalBusyByDate,
    weekDates,
  });

  const report: GoogleImpactReport = {
    detectedAt: new Date().toISOString(),
    changes,
    mirroredMovesCount,
    mirroredDeletesCount,
    status: conflicts.length > 0 ? 'conflict' : 'no_conflict',
    conflicts,
  };

  return {
    mirroredBlocks,
    hasChanges: changes.length > 0,
    report,
  };
}
