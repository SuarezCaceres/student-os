import React, { useEffect, useState } from 'react';
import {
  Clock,
  MapPin,
  Trash2,
  AlertTriangle,
  GraduationCap,
  Dumbbell,
  Briefcase,
  User,
  Plus,
  Bell,
  CalendarCheck2,
  ExternalLink,
  Moon,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { CalendarBlock, DayOfWeek, Category, WorkShiftConfig } from '../../types';
import type { GoogleCalendarEvent } from '../../services/googleCalendar';
import { isStudentOsGymGoogleEvent } from '../../utils/gymScheduleFilter';
import { formatReminderSummary } from '../../utils/reminderPresets';
import {
  expandCalendarBlocksToSegments,
  getNextDayOfWeek,
  parseTimeToMinutes,
  type ExpandedBlockSegment,
} from '../../utils/workSchedule';

export interface CalendarTimelineGridProps {
  blocks: CalendarBlock[];
  onDeleteBlock: (id: string) => void;
  onDeleteGoogleEvent?: (event: GoogleCalendarEvent) => Promise<void> | void;
  googleEvents?: GoogleCalendarEvent[];
  showGoogleEvents?: boolean;
  selectedMobileDay?: DayOfWeek;
  onSelectMobileDay?: (day: DayOfWeek) => void;
  onRequestAddBlock?: (day: DayOfWeek) => void;
  workShift?: WorkShiftConfig;
  onEditWorkShift?: () => void;
}

const DAYS_OF_WEEK: { day: DayOfWeek; short: string }[] = [
  { day: 'Lunes', short: 'Lun' },
  { day: 'Martes', short: 'Mar' },
  { day: 'Miércoles', short: 'Mié' },
  { day: 'Jueves', short: 'Jue' },
  { day: 'Viernes', short: 'Vie' },
  { day: 'Sábado', short: 'Sáb' },
  { day: 'Domingo', short: 'Dom' },
];

const DAYS_INDEX_MAP: DayOfWeek[] = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
];

const FOCUSED_START_HOUR = 6; // 06:00 default view (includes 06:00-08:00 gym & 22:00-24:00 night shift start)
const FULL_START_HOUR = 0; // 00:00 expanded dawn view
const END_HOUR = 24; // 24:00
const HOUR_HEIGHT = 64; // px per hour

interface TimelineCollisionEntry {
  id: string;
  parentId: string;
  day: DayOfWeek;
  startTime: string;
  endTime: string;
}

function checkIntervalCollision(a: TimelineCollisionEntry, b: TimelineCollisionEntry): boolean {
  if (a.id === b.id || a.parentId === b.parentId || a.day !== b.day) return false;
  const startA = parseTimeToMinutes(a.startTime);
  const endA = parseTimeToMinutes(a.endTime);
  const startB = parseTimeToMinutes(b.startTime);
  const endB = parseTimeToMinutes(b.endTime);

  return startA < endB && startB < endA;
}

function readCurrentTimeSnapshot(): { todayDay: DayOfWeek; currentMinutes: number } {
  const now = new Date();
  return {
    todayDay: DAYS_INDEX_MAP[now.getDay()],
    currentMinutes: now.getHours() * 60 + now.getMinutes(),
  };
}

export const CalendarTimelineGrid: React.FC<CalendarTimelineGridProps> = ({
  blocks,
  onDeleteBlock,
  onDeleteGoogleEvent,
  googleEvents = [],
  showGoogleEvents = true,
  selectedMobileDay,
  onSelectMobileDay,
  onRequestAddBlock,
  workShift,
  onEditWorkShift,
}) => {
  const [timeSnapshot, setTimeSnapshot] = useState(readCurrentTimeSnapshot);
  const [internalMobileDay, setInternalMobileDay] = useState<DayOfWeek>(
    () => readCurrentTimeSnapshot().todayDay
  );
  const [showEarlyMorning, setShowEarlyMorning] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTimeSnapshot(readCurrentTimeSnapshot());
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const { todayDay, currentMinutes } = timeSnapshot;
  const activeMobileDay = selectedMobileDay ?? internalMobileDay;

  const handleMobileDayChange = (day: DayOfWeek) => {
    if (onSelectMobileDay) {
      onSelectMobileDay(day);
    } else {
      setInternalMobileDay(day);
    }
  };

  const activeStartHour = showEarlyMorning ? FULL_START_HOUR : FOCUSED_START_HOUR;
  const totalHours = END_HOUR - activeStartHour;
  const timelineStartMinutes = activeStartHour * 60;
  const timelineEndMinutes = END_HOUR * 60;
  const isCurrentTimeVisible =
    currentMinutes >= timelineStartMinutes && currentMinutes <= timelineEndMinutes;
  const currentTimeTop = ((currentMinutes - timelineStartMinutes) / 60) * HOUR_HEIGHT;

  const getCategoryStyles = (cat: Category) => {
    switch (cat) {
      case 'universidad':
        return {
          surfaceClass:
            'bg-[color-mix(in_oklab,var(--action)_10%,var(--surface))] border-[color-mix(in_oklab,var(--action)_38%,var(--line))]',
          accentText: 'text-[var(--action)]',
          icon: GraduationCap,
        };
      case 'trabajo':
        return {
          surfaceClass:
            'bg-[color-mix(in_oklab,var(--ok)_10%,var(--surface))] border-[color-mix(in_oklab,var(--ok)_38%,var(--line))]',
          accentText: 'text-[var(--ok)]',
          icon: Briefcase,
        };
      case 'gym':
        return {
          surfaceClass:
            'bg-[color-mix(in_oklab,var(--gym)_10%,var(--surface))] border-[color-mix(in_oklab,var(--gym)_38%,var(--line))]',
          accentText: 'text-[var(--gym)]',
          icon: Dumbbell,
        };
      case 'personal':
      default:
        return {
          surfaceClass:
            'bg-[var(--surface-2)] border-[var(--line-strong)]',
          accentText: 'text-[var(--muted)]',
          icon: User,
        };
    }
  };

  const hoursArray = Array.from({ length: totalHours + 1 }, (_, i) => activeStartHour + i);

  // Expand overnight blocks into clean same-day [00:00, 24:00] segments
  const expandedLocalSegments = expandCalendarBlocksToSegments(blocks);

  // Deduplicate Google Calendar events already mirrored onto a local block via googleEventId
  const syncedGoogleIds = new Set(
    blocks.map((b) => b.googleEventId).filter((id): id is string => Boolean(id))
  );
  const externalGoogleEvents = showGoogleEvents
    ? googleEvents.filter((ev) => !syncedGoogleIds.has(ev.id))
    : [];
  const timedExternalGoogle = externalGoogleEvents.filter((ev) => !ev.isAllDay);
  const allDayExternalGoogle = externalGoogleEvents.filter((ev) => ev.isAllDay);

  const allTimedIntervals: TimelineCollisionEntry[] = [
    ...expandedLocalSegments.map((seg) => ({
      id: seg.segmentId,
      parentId: seg.block.id,
      day: seg.day,
      startTime: seg.startTime,
      endTime: seg.endTime,
    })),
    ...timedExternalGoogle.map((ev) => ({
      id: `gcal-${ev.id}-${ev.dateIso}`,
      parentId: `gcal-${ev.id}`,
      day: ev.day,
      startTime: ev.startTime,
      endTime: ev.endTime,
    })),
  ];

  // Detect any conflicting intervals across the 24h week (local or Google-direct, even when madrugada is folded)
  const conflictingEntries = allTimedIntervals.filter((entry) =>
    allTimedIntervals.some((other) => checkIntervalCollision(entry, other))
  );
  const conflictingDays = Array.from(new Set(conflictingEntries.map((s) => s.day)));

  const earlyMorningCount =
    expandedLocalSegments.filter((seg) => parseTimeToMinutes(seg.startTime) < 6 * 60).length +
    timedExternalGoogle.filter((ev) => parseTimeToMinutes(ev.startTime) < 6 * 60).length;

  const countDayItems = (day: DayOfWeek) =>
    expandedLocalSegments.filter((seg) => seg.day === day).length +
    externalGoogleEvents.filter((ev) => ev.day === day).length;

  const activeMobileDayCount = countDayItems(activeMobileDay);

  return (
    <div className="space-y-3">
      {/* Night Shift Summary Chip & Focused 06:00–24:00 vs Expand Dawn 00:00–06:00 Bar */}
      {(workShift?.enabled || earlyMorningCount > 0) && (
        <div className="rounded-[14px] border border-[var(--line)] bg-[var(--surface-2)] px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2 text-[13px] text-[var(--ink)] min-w-0">
            <span className="t-badge t-badge-ok">
              <Moon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span className="t-num">
                {workShift?.enabled
                  ? `${workShift.title}: ${workShift.startTime}–${workShift.endTime}`
                  : 'Bloques de madrugada'}
              </span>
            </span>
            {workShift?.enabled && (
              <span className="text-[var(--muted)]">
                {workShift.restDay ? (
                  <>
                    Descanso:{' '}
                    <strong className="text-[var(--ink)] font-medium">
                      noche de {workShift.restDay}
                    </strong>{' '}
                    <span className="t-num">
                      (sin entrada {workShift.startTime} → {getNextDayOfWeek(workShift.restDay)}{' '}
                      {workShift.endTime})
                    </span>
                  </>
                ) : (
                  'Turno diario (7 días/semana)'
                )}
              </span>
            )}
            {!workShift?.enabled && earlyMorningCount > 0 && (
              <span className="text-[var(--muted)] t-num">
                {earlyMorningCount} {earlyMorningCount === 1 ? 'bloque' : 'bloques'} entre 00:00 y 06:00
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {onEditWorkShift && (
              <button
                type="button"
                onClick={onEditWorkShift}
                className="t-btn t-btn-ghost text-[13px] px-3 min-h-[44px]"
              >
                <Briefcase className="w-3.5 h-3.5 text-[var(--ok)] shrink-0" aria-hidden="true" />
                <span>Editar turno</span>
              </button>
            )}
            <button
              type="button"
              aria-pressed={showEarlyMorning}
              onClick={() => setShowEarlyMorning((prev) => !prev)}
              className={`min-h-[44px] px-3 py-1.5 rounded-[10px] border text-[13px] font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                showEarlyMorning
                  ? 'border-[var(--action)] bg-[color-mix(in_oklab,var(--action)_10%,var(--surface))] text-[var(--action)]'
                  : 'border-[var(--line-strong)] bg-[var(--surface)] text-[var(--ink)] hover:border-[var(--action)]'
              }`}
            >
              {showEarlyMorning ? (
                <ChevronUp className="w-4 h-4 shrink-0" aria-hidden="true" />
              ) : (
                <ChevronDown className="w-4 h-4 shrink-0" aria-hidden="true" />
              )}
              <span>
                {showEarlyMorning
                  ? 'Vista enfocada (06:00–24:00)'
                  : `Ver madrugada (00:00–06:00)${earlyMorningCount > 0 ? ` · ${earlyMorningCount}` : ''}`}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Schedule Conflict Notice */}
      {conflictingEntries.length > 0 && (
        <div
          role="status"
          className="rounded-[14px] border border-[color-mix(in_oklab,var(--danger)_36%,var(--line))] bg-[color-mix(in_oklab,var(--danger)_10%,var(--surface))] px-4 py-3 flex items-start gap-3"
        >
          <AlertTriangle
            className="w-4 h-4 text-[var(--danger)] shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div className="text-[14px] text-[var(--ink)] leading-snug">
            <span className="font-medium text-[var(--danger)]">
              Conflicto de horario detectado:{' '}
            </span>
            <span>
              Tienes{' '}
              {conflictingEntries.length === 1
                ? '1 bloque que se cruza'
                : `${conflictingEntries.length} bloques que se cruzan`}{' '}
              en <span className="font-medium">{conflictingDays.join(', ')}</span>. Revisa los bloques
              resaltados en rojo.
            </span>
          </div>
        </div>
      )}

      {/* Mobile Day Selector (<768px): clean 1-day view without 900px horizontal scroll */}
      <div className="md:hidden space-y-2.5">
        <div
          role="tablist"
          aria-label="Seleccionar día de la semana"
          className="grid grid-cols-7 gap-1 p-1 rounded-[14px] bg-[var(--surface-2)] border border-[var(--line)]"
        >
          {DAYS_OF_WEEK.map(({ day, short }) => {
            const isSelected = day === activeMobileDay;
            const isToday = day === todayDay;
            const dayCount = countDayItems(day);

            return (
              <button
                key={day}
                type="button"
                role="tab"
                aria-selected={isSelected}
                aria-label={`${day} (${dayCount} ${dayCount === 1 ? 'bloque' : 'bloques'})`}
                onClick={() => handleMobileDayChange(day)}
                className={`min-h-[44px] rounded-[10px] flex flex-col items-center justify-center gap-1 text-[13px] font-medium transition-colors cursor-pointer select-none focus-visible:outline-2 focus-visible:outline-[var(--action)] ${
                  isSelected
                    ? 'bg-[var(--surface)] text-[var(--ink)] border border-[var(--line-strong)] shadow-2xs'
                    : 'text-[var(--muted)] hover:text-[var(--ink)] border border-transparent'
                }`}
              >
                <span>{short}</span>
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isToday
                      ? 'bg-[var(--action)]'
                      : dayCount > 0
                      ? 'bg-[var(--muted)]/60'
                      : 'bg-transparent'
                  }`}
                  aria-hidden="true"
                />
              </button>
            );
          })}
        </div>

        {/* Mobile Selected Day Summary Bar */}
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2">
            <h3 className="text-[16px] font-medium text-[var(--ink)]">
              {activeMobileDay}
            </h3>
            {activeMobileDay === todayDay && (
              <span className="t-badge t-badge-accent">Hoy</span>
            )}
            <span className="text-[13px] text-[var(--muted)] t-num">
              · {activeMobileDayCount} {activeMobileDayCount === 1 ? 'bloque' : 'bloques'}
            </span>
          </div>

          {onRequestAddBlock && (
            <button
              type="button"
              onClick={() => onRequestAddBlock(activeMobileDay)}
              className="t-btn t-btn-ghost text-[13px] px-3"
              style={{ minHeight: '44px', paddingInline: '12px' }}
            >
              <Plus className="w-4 h-4 text-[var(--action)]" />
              <span>Agregar aquí</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Timeline Card */}
      <div className="t-card overflow-hidden">
        {/* Sticky Header Row */}
        <div className="grid grid-cols-[58px_minmax(0,1fr)] md:grid-cols-[64px_repeat(7,minmax(0,1fr))] border-b border-[var(--line)] bg-[var(--surface-2)]/70">
          {/* Corner Hour Icon Cell */}
          <div className="py-3 px-2 flex items-center justify-center border-r border-[var(--line)]">
            <Clock className="w-4 h-4 text-[var(--muted)]" aria-hidden="true" />
          </div>

          {/* Day Headers (1 visible on <768px, all 7 visible on md+) */}
          {DAYS_OF_WEEK.map(({ day, short }) => {
            const isToday = day === todayDay;
            const isMobileActive = day === activeMobileDay;
            const count = countDayItems(day);
            const dayAllDayGoogle = allDayExternalGoogle.filter((ev) => ev.day === day);

            return (
              <div
                key={day}
                className={`${
                  isMobileActive ? 'block' : 'hidden md:block'
                } py-2.5 px-2 text-center border-r last:border-r-0 border-[var(--line)] ${
                  isToday ? 'bg-[color-mix(in_oklab,var(--action)_8%,transparent)]' : ''
                }`}
              >
                <div className="flex items-center justify-center gap-1.5 flex-wrap">
                  <span
                    className={`text-[14px] font-medium ${
                      isToday ? 'text-[var(--action)]' : 'text-[var(--ink)]'
                    }`}
                  >
                    <span className="md:hidden lg:inline">{day}</span>
                    <span className="hidden md:inline lg:hidden">{short}</span>
                  </span>
                  {isToday && (
                    <span className="hidden lg:inline-flex t-badge t-badge-accent py-0 px-2 text-[13px]">
                      Hoy
                    </span>
                  )}
                </div>
                <span className="text-[13px] text-[var(--muted)] t-num block mt-0.5">
                  {count} {count === 1 ? 'bloque' : 'bloques'}
                </span>
                {dayAllDayGoogle.length > 0 && (
                  <div className="mt-1.5 flex flex-col gap-1">
                    {dayAllDayGoogle.map((ev) => (
                      <div
                        key={`gcal-allday-${ev.id}-${ev.dateIso}`}
                        className="inline-flex items-center justify-center gap-1 rounded-md border border-dashed border-[color-mix(in_oklab,var(--ok)_55%,var(--line))] bg-[color-mix(in_oklab,var(--ok)_10%,var(--surface))] px-1.5 py-0.5 text-[13px] text-[var(--ink)]"
                        title={`${ev.title} (Todo el día en Google Calendar)`}
                      >
                        <CalendarCheck2 className="w-3 h-3 text-[var(--ok)] shrink-0" aria-hidden="true" />
                        <span className="truncate max-w-[110px]">{ev.title}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Timeline Body */}
        <div
          className="grid grid-cols-[58px_minmax(0,1fr)] md:grid-cols-[64px_repeat(7,minmax(0,1fr))] relative"
          style={{ height: `${totalHours * HOUR_HEIGHT}px` }}
        >
          {/* Horizontal Hour Hairlines */}
          <div className="absolute inset-0 pointer-events-none z-0" aria-hidden="true">
            {hoursArray.slice(0, -1).map((hour) => (
              <div
                key={hour}
                className="border-b border-[var(--line)] w-full"
                style={{ height: `${HOUR_HEIGHT}px` }}
              />
            ))}
          </div>

          {/* Left Hours Column */}
          <div className="border-r border-[var(--line)] select-none bg-[var(--surface-2)]/35 z-10">
            {hoursArray.slice(0, -1).map((hour) => (
              <div
                key={hour}
                style={{ height: `${HOUR_HEIGHT}px` }}
                className="t-num text-[13px] text-[var(--muted)] pr-2 pt-1.5 text-right"
              >
                {String(hour).padStart(2, '0')}:00
              </div>
            ))}
          </div>

          {/* Day Columns (1 visible on <768px, all 7 visible on md+) */}
          {DAYS_OF_WEEK.map(({ day }) => {
            const isToday = day === todayDay;
            const isMobileActive = day === activeMobileDay;
            const daySegments = expandedLocalSegments
              .filter((seg) => seg.day === day)
              .sort((a, b) => a.startTime.localeCompare(b.startTime));
            const dayGoogleTimed = timedExternalGoogle
              .filter((ev) => ev.day === day)
              .sort((a, b) => a.startTime.localeCompare(b.startTime));

            type UnifiedTimelineItem =
              | {
                  kind: 'local';
                  id: string;
                  parentId: string;
                  day: DayOfWeek;
                  startTime: string;
                  endTime: string;
                  segment: ExpandedBlockSegment;
                }
              | {
                  kind: 'google';
                  id: string;
                  parentId: string;
                  day: DayOfWeek;
                  startTime: string;
                  endTime: string;
                  event: GoogleCalendarEvent;
                };

            const unifiedDayIntervals: UnifiedTimelineItem[] = [
              ...daySegments.map((seg) => ({
                kind: 'local' as const,
                id: seg.segmentId,
                parentId: seg.block.id,
                day: seg.day,
                startTime: seg.startTime,
                endTime: seg.endTime,
                segment: seg,
              })),
              ...dayGoogleTimed.map((ev) => ({
                kind: 'google' as const,
                id: `gcal-${ev.id}-${ev.dateIso}`,
                parentId: `gcal-${ev.id}`,
                day: ev.day,
                startTime: ev.startTime,
                endTime: ev.endTime,
                event: ev,
              })),
            ].sort((a, b) => a.startTime.localeCompare(b.startTime) || a.endTime.localeCompare(b.endTime));

            // Filter strictly within visible [timelineStartMinutes, timelineEndMinutes] before lane placement
            // so collapsed madrugada (00:00-06:00) blocks never leak a stub at 06:00-06:30.
            const visibleDayIntervals = unifiedDayIntervals.filter((item) => {
              const rawStart = parseTimeToMinutes(item.startTime);
              const rawEnd = parseTimeToMinutes(item.endTime);
              return rawEnd > timelineStartMinutes && rawStart < timelineEndMinutes;
            });

            // Compute side-by-side lane placement for colliding items so overlapping events stay readable
            const placedIntervals = (() => {
              const laneEnds: number[] = [];
              const initial = visibleDayIntervals.map((item) => {
                const rawStart = parseTimeToMinutes(item.startTime);
                const rawEnd = parseTimeToMinutes(item.endTime);
                const s = Math.max(timelineStartMinutes, Math.min(timelineEndMinutes - 30, rawStart));
                const e = Math.min(timelineEndMinutes, Math.max(s + 30, rawEnd));
                let lane = laneEnds.findIndex((endVal) => endVal <= s);
                if (lane === -1) {
                  lane = laneEnds.length;
                  laneEnds.push(e);
                } else {
                  laneEnds[lane] = e;
                }
                return { item, s, e, lane };
              });

              return initial.map((entry) => {
                const overlappingPeers = initial.filter(
                  (other) => other.s < entry.e && entry.s < other.e
                );
                const maxLane = overlappingPeers.reduce((mx, o) => Math.max(mx, o.lane), 0);
                const laneCount = Math.max(1, Math.min(3, maxLane + 1));
                const laneIndex = Math.min(entry.lane, laneCount - 1);
                return { ...entry, laneCount, laneIndex };
              });
            })();

            return (
              <div
                key={day}
                className={`${
                  isMobileActive ? 'block' : 'hidden md:block'
                } relative border-r last:border-r-0 border-[var(--line)] ${
                  isToday ? 'bg-[color-mix(in_oklab,var(--action)_3%,transparent)]' : ''
                }`}
              >
                {/* Clean Current Time Line (no distracting pulse) */}
                {isToday && isCurrentTimeVisible && (
                  <div
                    className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
                    style={{ top: `${currentTimeTop}px` }}
                    aria-hidden="true"
                  >
                    <span className="w-2.5 h-2.5 -ml-1.5 rounded-full bg-[var(--action)] ring-2 ring-[var(--surface)]" />
                    <span className="w-full h-[2px] bg-[var(--action)]" />
                  </div>
                )}

                {/* Positioned Local + Google Calendar Items */}
                {placedIntervals.map(({ item, s: clampedStart, e: clampedEnd, laneCount, laneIndex }) => {
                  const hasConflict = unifiedDayIntervals.some((other) =>
                    checkIntervalCollision(item, other)
                  );

                  const topPx = ((clampedStart - timelineStartMinutes) / 60) * HOUR_HEIGHT;
                  const rawHeightPx = ((clampedEnd - clampedStart) / 60) * HOUR_HEIGHT;
                  const heightPx = Math.max(44, rawHeightPx - 3);
                  const widthPercent = 100 / laneCount;
                  const leftPercent = laneIndex * widthPercent;

                  if (item.kind === 'google') {
                    const ev = item.event;
                    const isGoogleGym = isStudentOsGymGoogleEvent(ev);
                    const hasAlarm = Boolean(ev.reminderMinutes && ev.reminderMinutes.length > 0);
                    const cardToneClass = hasConflict
                      ? 'border-solid bg-[color-mix(in_oklab,var(--danger)_12%,var(--surface))] border-[var(--danger)]'
                      : isGoogleGym
                      ? 'border-solid bg-[color-mix(in_oklab,var(--gym)_10%,var(--surface))] border-[color-mix(in_oklab,var(--gym)_45%,var(--line-strong))]'
                      : 'border-dashed bg-[color-mix(in_oklab,var(--ok)_10%,var(--surface))] border-[color-mix(in_oklab,var(--ok)_58%,var(--line-strong))]';
                    const accentColorClass = hasConflict
                      ? 'text-[var(--danger)]'
                      : isGoogleGym
                      ? 'text-[var(--gym)]'
                      : 'text-[var(--ok)]';
                    const GoogleCardIcon = isGoogleGym ? Dumbbell : CalendarCheck2;

                    return (
                      <div
                        key={item.id}
                        data-google-gym-card={isGoogleGym ? 'true' : undefined}
                        style={{
                          top: `${topPx + 1}px`,
                          height: `${heightPx}px`,
                          left: `calc(${leftPercent}% + 3px)`,
                          width: `calc(${widthPercent}% - 6px)`,
                          zIndex: 11 + laneIndex,
                        }}
                        className={`group absolute rounded-[12px] border ${
                          laneCount > 1 ? 'px-1.5' : 'px-2'
                        } py-1.5 transition-shadow duration-150 hover:!z-30 focus-within:!z-30 flex flex-col justify-between overflow-hidden ${cardToneClass}`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center justify-between gap-1 min-w-0">
                            <div className="flex items-center gap-1 min-w-0">
                              <GoogleCardIcon
                                className={`w-3.5 h-3.5 shrink-0 ${accentColorClass}`}
                                aria-hidden="true"
                              />
                              <span className={`t-num text-[13px] font-medium ${accentColorClass} truncate`}>
                                {heightPx < 52 || laneCount > 1
                                  ? ev.startTime
                                  : `${ev.startTime}–${ev.endTime}`}
                              </span>
                            </div>

                            <div className="flex items-center gap-0.5 shrink-0">
                              {ev.htmlLink && (
                                <a
                                  href={ev.htmlLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  aria-label={`Abrir en Google Calendar: ${ev.title}`}
                                  title="Abrir en Google Calendar"
                                  className="p-0.5 rounded-[6px] text-[var(--muted)] hover:text-[var(--ink)] shrink-0"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                                </a>
                              )}
                              {onDeleteGoogleEvent && isGoogleGym && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void onDeleteGoogleEvent(ev);
                                  }}
                                  aria-label={`Eliminar de Google Calendar: ${ev.title}`}
                                  title="Eliminar de Google Calendar"
                                  className="inline-flex md:hidden md:group-hover:inline-flex md:group-focus-within:inline-flex p-0.5 rounded-[6px] text-[var(--muted)] hover:text-[var(--danger)] shrink-0 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                                </button>
                              )}
                            </div>
                          </div>

                          <h4 className="text-[13px] font-medium text-[var(--ink)] leading-snug line-clamp-2 mt-0.5">
                            {ev.title}
                          </h4>
                        </div>

                        <div className="flex items-center justify-between gap-1 text-[13px] text-[var(--muted)] mt-1 min-w-0 overflow-hidden">
                          <span className="inline-flex items-center rounded px-1 py-0 text-[13px] font-medium border border-[color-mix(in_oklab,var(--ok)_40%,var(--line))] bg-[var(--surface)] text-[var(--ok)] truncate">
                            {laneCount >= 3 ? 'G' : 'Google'}
                          </span>
                          {hasAlarm && (
                            <span
                              className={`inline-flex items-center gap-0.5 shrink-0 ${accentColorClass}`}
                              title={formatReminderSummary(ev.reminderMinutes)}
                            >
                              <Bell className="w-3 h-3 shrink-0" aria-hidden="true" />
                              <span className="t-num">{ev.reminderMinutes?.[0]}m</span>
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  }

                  const segment = item.segment;
                  const block = segment.block;
                  const styles = getCategoryStyles(block.category);
                  const Icon = styles.icon;
                  const hasAlarm = Boolean(
                    block.reminderMinutes && block.reminderMinutes.length > 0
                  );
                  const displayTimeCompact =
                    heightPx < 52 || laneCount > 1
                      ? segment.startTime
                      : segment.segmentRole === 'overnight_start'
                      ? `${block.startTime}–${block.endTime} (+1d)`
                      : segment.segmentRole === 'overnight_continuation'
                      ? `00:00–${segment.endTime} (turno ${segment.originDay.slice(0, 3)})`
                      : `${segment.startTime}–${segment.endTime}`;

                  return (
                    <div
                      key={segment.segmentId}
                      style={{
                        top: `${topPx + 1}px`,
                        height: `${heightPx}px`,
                        left: `calc(${leftPercent}% + 3px)`,
                        width: `calc(${widthPercent}% - 6px)`,
                        zIndex: 10 + laneIndex,
                      }}
                      className={`group absolute rounded-[12px] border ${
                        laneCount > 1 ? 'px-1.5' : 'px-2.5'
                      } py-1.5 transition-shadow duration-150 hover:!z-30 focus-within:!z-30 hover:shadow-md flex flex-col justify-between overflow-hidden ${
                        hasConflict
                          ? 'bg-[color-mix(in_oklab,var(--danger)_14%,var(--surface))] border-[var(--danger)] ring-1 ring-[var(--danger)]/30'
                          : styles.surfaceClass
                      }`}
                    >
                      <div className="min-w-0">
                        {/* Top Row: Time, Inline Title (for 30m blocks), Conflict Badge, Delete Button */}
                        <div className="flex items-center justify-between gap-1 min-w-0">
                          <div className="flex items-center gap-1 min-w-0">
                            <span
                              className={`t-num text-[13px] font-medium truncate ${
                                hasConflict ? 'text-[var(--danger)]' : styles.accentText
                              }`}
                            >
                              {displayTimeCompact}
                            </span>
                            {heightPx < 52 && (
                              <span className="text-[13px] font-medium text-[var(--ink)] truncate">
                                {block.title}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-0.5 shrink-0">
                            {hasConflict && (
                              <span
                                title="Conflicto de horario: se cruza con otra actividad este día"
                                className="inline-flex items-center gap-1 text-[13px] font-medium text-[var(--danger)]"
                              >
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                {laneCount === 1 && (
                                  <span className="md:hidden xl:inline">Cruce</span>
                                )}
                              </span>
                            )}

                            {hasAlarm && !hasConflict && (
                              <span
                                title={formatReminderSummary(block.reminderMinutes)}
                                className="inline-flex items-center gap-0.5 text-[13px] text-[var(--action)]"
                              >
                                <Bell className="w-3 h-3 shrink-0" aria-hidden="true" />
                              </span>
                            )}

                            {block.googleEventId && (
                              <span
                                title="Sincronizado con Google Calendar"
                                className="inline-flex items-center text-[var(--ok)]"
                              >
                                <CalendarCheck2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                              </span>
                            )}

                            <button
                              type="button"
                              onClick={() => onDeleteBlock(block.id)}
                              className="p-1 rounded-[8px] text-[var(--muted)] hover:text-[var(--danger)] hover:bg-[var(--surface)]/80 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 focus-visible:opacity-100 transition-opacity cursor-pointer"
                              aria-label={`Eliminar bloque: ${block.title}`}
                              title="Eliminar bloque"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Block Title for >= 45m blocks */}
                        {heightPx >= 52 && (
                          <div className="flex items-start gap-1.5 mt-0.5">
                            <Icon
                              className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${
                                hasConflict ? 'text-[var(--danger)]' : styles.accentText
                              }`}
                              aria-hidden="true"
                            />
                            <h4 className="text-[13px] font-medium text-[var(--ink)] leading-snug line-clamp-2">
                              {block.title}
                            </h4>
                          </div>
                        )}
                      </div>

                      {/* Optional Location / Reminder Summary when block is tall enough */}
                      {(block.location || hasAlarm) && heightPx >= 96 && (
                        <div className="flex items-center justify-between gap-2 text-[13px] text-[var(--muted)] truncate mt-1">
                          {block.location ? (
                            <span className="flex items-center gap-1 truncate min-w-0">
                              <MapPin className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                              <span className="truncate">{block.location}</span>
                            </span>
                          ) : (
                            <span />
                          )}
                          {hasAlarm && (
                            <span className="t-num shrink-0 text-[var(--action)]">
                              {block.reminderMinutes?.[0]}m antes
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
