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
} from 'lucide-react';
import type { CalendarBlock, DayOfWeek, Category } from '../../types';
import type { GoogleCalendarEvent } from '../../services/googleCalendar';
import { formatReminderSummary } from '../../utils/reminderPresets';

export interface CalendarTimelineGridProps {
  blocks: CalendarBlock[];
  onDeleteBlock: (id: string) => void;
  googleEvents?: GoogleCalendarEvent[];
  showGoogleEvents?: boolean;
  selectedMobileDay?: DayOfWeek;
  onSelectMobileDay?: (day: DayOfWeek) => void;
  onRequestAddBlock?: (day: DayOfWeek) => void;
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

const START_HOUR = 7; // 07:00
const END_HOUR = 22; // 22:00
const TOTAL_HOURS = END_HOUR - START_HOUR; // 15 hours
const HOUR_HEIGHT = 68; // px per hour

function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map((n) => parseInt(n, 10));
  return (h || 0) * 60 + (m || 0);
}

function checkIntervalCollision(
  a: { id: string; day: DayOfWeek; startTime: string; endTime: string },
  b: { id: string; day: DayOfWeek; startTime: string; endTime: string }
): boolean {
  if (a.id === b.id || a.day !== b.day) return false;
  const startA = timeToMinutes(a.startTime);
  const endA = timeToMinutes(a.endTime);
  const startB = timeToMinutes(b.startTime);
  const endB = timeToMinutes(b.endTime);

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
  googleEvents = [],
  showGoogleEvents = true,
  selectedMobileDay,
  onSelectMobileDay,
  onRequestAddBlock,
}) => {
  const [timeSnapshot, setTimeSnapshot] = useState(readCurrentTimeSnapshot);
  const [internalMobileDay, setInternalMobileDay] = useState<DayOfWeek>(
    () => readCurrentTimeSnapshot().todayDay
  );

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

  const timelineStartMinutes = START_HOUR * 60;
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

  const hoursArray = Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => START_HOUR + i);

  // Deduplicate Google Calendar events already mirrored onto a local block via googleEventId
  const syncedGoogleIds = new Set(
    blocks.map((b) => b.googleEventId).filter((id): id is string => Boolean(id))
  );
  const externalGoogleEvents = showGoogleEvents
    ? googleEvents.filter((ev) => !syncedGoogleIds.has(ev.id))
    : [];
  const timedExternalGoogle = externalGoogleEvents.filter((ev) => !ev.isAllDay);
  const allDayExternalGoogle = externalGoogleEvents.filter((ev) => ev.isAllDay);

  const allTimedIntervals = [
    ...blocks.map((b) => ({ id: b.id, day: b.day, startTime: b.startTime, endTime: b.endTime })),
    ...timedExternalGoogle.map((ev) => ({
      id: `gcal-${ev.id}-${ev.dateIso}`,
      day: ev.day,
      startTime: ev.startTime,
      endTime: ev.endTime,
    })),
  ];

  // Detect any conflicting blocks across the week (including against Google events) for clear feedback
  const conflictingBlocks = blocks.filter((block) =>
    allTimedIntervals.some((other) => checkIntervalCollision(block, other))
  );
  const conflictingDays = Array.from(new Set(conflictingBlocks.map((b) => b.day)));

  const countDayItems = (day: DayOfWeek) =>
    blocks.filter((b) => b.day === day).length +
    externalGoogleEvents.filter((ev) => ev.day === day).length;

  const activeMobileDayCount = countDayItems(activeMobileDay);

  return (
    <div className="space-y-3">
      {/* Schedule Conflict Notice */}
      {conflictingBlocks.length > 0 && (
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
              {conflictingBlocks.length === 1
                ? '1 bloque que se cruza'
                : `${conflictingBlocks.length} bloques que se cruzan`}{' '}
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

        {/* Timeline Body (07:00 to 22:00) */}
        <div
          className="grid grid-cols-[58px_minmax(0,1fr)] md:grid-cols-[64px_repeat(7,minmax(0,1fr))] relative"
          style={{ height: `${TOTAL_HOURS * HOUR_HEIGHT}px` }}
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
            const dayBlocks = blocks
              .filter((b) => b.day === day)
              .sort((a, b) => a.startTime.localeCompare(b.startTime));
            const dayGoogleTimed = timedExternalGoogle
              .filter((ev) => ev.day === day)
              .sort((a, b) => a.startTime.localeCompare(b.startTime));

            const unifiedDayIntervals = [
              ...dayBlocks.map((b) => ({
                kind: 'local' as const,
                id: b.id,
                day: b.day,
                startTime: b.startTime,
                endTime: b.endTime,
                block: b,
              })),
              ...dayGoogleTimed.map((ev) => ({
                kind: 'google' as const,
                id: `gcal-${ev.id}-${ev.dateIso}`,
                day: ev.day,
                startTime: ev.startTime,
                endTime: ev.endTime,
                event: ev,
              })),
            ].sort((a, b) => a.startTime.localeCompare(b.startTime) || a.endTime.localeCompare(b.endTime));

            // Compute side-by-side lane placement for colliding items so overlapping events stay readable
            const placedIntervals = (() => {
              const laneEnds: number[] = [];
              const initial = unifiedDayIntervals.map((item) => {
                const s = Math.max(timelineStartMinutes, Math.min(timelineEndMinutes - 30, timeToMinutes(item.startTime)));
                const e = Math.min(timelineEndMinutes, Math.max(s + 30, timeToMinutes(item.endTime)));
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
                    const hasAlarm = Boolean(ev.reminderMinutes && ev.reminderMinutes.length > 0);
                    return (
                      <div
                        key={item.id}
                        style={{
                          top: `${topPx + 1}px`,
                          height: `${heightPx}px`,
                          left: `calc(${leftPercent}% + 3px)`,
                          width: `calc(${widthPercent}% - 6px)`,
                          zIndex: 11 + laneIndex,
                        }}
                        className={`group absolute rounded-[12px] border border-dashed ${
                          laneCount > 1 ? 'px-1.5' : 'px-2'
                        } py-1.5 transition-shadow duration-150 hover:!z-30 focus-within:!z-30 flex flex-col justify-between overflow-hidden ${
                          hasConflict
                            ? 'bg-[color-mix(in_oklab,var(--danger)_12%,var(--surface))] border-[var(--danger)]'
                            : 'bg-[color-mix(in_oklab,var(--ok)_10%,var(--surface))] border-[color-mix(in_oklab,var(--ok)_58%,var(--line-strong))]'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center justify-between gap-1 min-w-0">
                            <div className="flex items-center gap-1 min-w-0">
                              <CalendarCheck2
                                className={`w-3.5 h-3.5 shrink-0 ${
                                  hasConflict ? 'text-[var(--danger)]' : 'text-[var(--ok)]'
                                }`}
                                aria-hidden="true"
                              />
                              <span className="t-num text-[13px] font-medium text-[var(--ok)] truncate">
                                {heightPx < 52 || laneCount > 1
                                  ? ev.startTime
                                  : `${ev.startTime}–${ev.endTime}`}
                              </span>
                            </div>

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
                              className="inline-flex items-center gap-0.5 shrink-0 text-[var(--ok)]"
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

                  const block = item.block;
                  const styles = getCategoryStyles(block.category);
                  const Icon = styles.icon;
                  const hasAlarm = Boolean(
                    block.reminderMinutes && block.reminderMinutes.length > 0
                  );

                  return (
                    <div
                      key={block.id}
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
                              {heightPx < 52 || laneCount > 1
                                ? block.startTime
                                : `${block.startTime}–${block.endTime}`}
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
