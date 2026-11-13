import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Droplets,
  Dumbbell,
  Flame,
  GraduationCap,
  Plus,
} from 'lucide-react';
import type { GoogleCalendarEvent } from '../../services/googleCalendar';
import type { AppState } from '../../types';
import {
  buildTodayAgendaEntries,
  calculateDailyHabitsPercent,
  calculateOverallGpa,
  classifyTodayAgenda,
  DEFAULT_DAILY_HABITS,
  formatMinutesAsClock,
  formatMinutesUntil,
  getAssignmentUrgency,
  getGpaBadge,
  getTodayGymSessionSummary,
  normalizeDailyHabitsForDate,
} from '../../utils/academicStats';
import { getLocalIsoDate, getTodayDayOfWeek } from '../../utils/gymAttendance';
import type { NavTab } from './Navbar';

export interface StatsHeroProps {
  state: AppState;
  googleEvents?: GoogleCalendarEvent[];
  todayDateIso?: string;
  missingGymScheduleCount?: number;
  onOpenQuickAddWithTab?: (
    tab: 'university' | 'gym' | 'kanban' | 'calendar' | 'learning'
  ) => void;
  onNavigateTab?: (tab: NavTab) => void;
}

export const StatsHero: React.FC<StatsHeroProps> = ({
  state,
  googleEvents = [],
  todayDateIso,
  missingGymScheduleCount = 0,
  onOpenQuickAddWithTab,
  onNavigateTab,
}) => {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(new Date());
    }, 60_000);
    return () => window.clearInterval(id);
  }, []);

  const hour = now.getHours();
  const timeGreeting =
    hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
  const todayName = getTodayDayOfWeek(now);
  const resolvedTodayIso = todayDateIso ?? getLocalIsoDate(now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const pendingAssignments = state.universityAssignments.filter(
    (a) => a.status !== 'entregado'
  );
  const currentWeekTasks = pendingAssignments.filter(
    (a) => a.week === state.currentAcademicWeek
  );
  const overdueCount = pendingAssignments.filter((a) => {
    const urgency = getAssignmentUrgency(a.dueDate, a.status, resolvedTodayIso);
    return urgency.daysDiff !== null && urgency.daysDiff < 0;
  }).length;

  const todayRoutine = state.gymRoutines.find((r) => r.dayOfWeek === todayName);
  let totalSets = 0;
  let completedSets = 0;
  if (todayRoutine) {
    todayRoutine.exercises.forEach((ex) => {
      totalSets += ex.sets;
      completedSets += ex.completedSets.filter(Boolean).length;
    });
  }

  const todayAgendaEntries = buildTodayAgendaEntries({
    calendarBlocks: state.calendarBlocks,
    googleEvents,
    todayDay: todayName,
    todayDateIso: resolvedTodayIso,
  });
  const classifiedAgenda = classifyTodayAgenda(todayAgendaEntries, nowMinutes);
  const activeBlock = classifiedAgenda.activeEntries[0] ?? null;
  const nextBlock = classifiedAgenda.upcomingEntries[0] ?? null;

  const gymSummary = getTodayGymSessionSummary({
    todayRoutine,
    todayDateIso: resolvedTodayIso,
    attendanceLogs: state.gymAttendanceLogs,
    todayAgendaEntries,
  });

  const normalizedHabits = normalizeDailyHabitsForDate(
    state.dailyHabits ?? DEFAULT_DAILY_HABITS,
    resolvedTodayIso
  ).habits;
  const habitsPercent = calculateDailyHabitsPercent(normalizedHabits);

  const overallGpa = calculateOverallGpa(state.universityAssignments);
  const gpaBadge = getGpaBadge(overallGpa);

  return (
    <section data-enter className="t-card hero-enter p-5 sm:p-6 mb-6">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 xl:gap-8">
        {/* Left Column: Greeting, Now Context Strip & Single Primary CTA */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-[-0.028em] text-[var(--ink)] leading-tight">
              {timeGreeting}, {state.studentName}
            </h1>
            <span className="t-badge t-badge-accent t-num">
              Semana {state.currentAcademicWeek}
            </span>
            {missingGymScheduleCount > 0 && onNavigateTab && (
              <button
                type="button"
                onClick={() => onNavigateTab('gym')}
                className="t-badge t-badge-warn min-h-[28px] cursor-pointer hover:opacity-90 transition-opacity focus-visible:outline-2 focus-visible:outline-[var(--action)]"
              >
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span className="t-num">
                  {missingGymScheduleCount}{' '}
                  {missingGymScheduleCount === 1 ? 'alerta Gym' : 'alertas Gym'}
                </span>
              </button>
            )}
          </div>

          <p className="text-sm sm:text-[15px] text-[var(--muted)] mt-1.5 leading-relaxed">
            {state.career} ·{' '}
            {currentWeekTasks.length > 0 ? (
              <>
                Tienes{' '}
                <span className="t-num font-medium text-[var(--ink)]">
                  {currentWeekTasks.length}{' '}
                  {currentWeekTasks.length === 1 ? 'entrega pendiente' : 'entregas pendientes'}
                </span>{' '}
                en esta semana lectiva
              </>
            ) : (
              <>Entregas de la semana lectiva al día</>
            )}
            {overdueCount > 0 && (
              <>
                {' · '}
                <span className="t-num font-medium text-[var(--danger)]">
                  {overdueCount} {overdueCount === 1 ? 'vencida' : 'vencidas'}
                </span>
              </>
            )}
            .
          </p>

          {/* "Ahora" Live Focus Line + Single Primary CTA */}
          <div className="mt-4 pt-3.5 border-t border-[var(--line)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0 flex flex-wrap items-center gap-2 text-[14px]">
              {activeBlock ? (
                <button
                  type="button"
                  onClick={() => onNavigateTab?.('calendar')}
                  className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-left min-h-[44px] rounded-[10px] px-1 -mx-1 hover:text-[var(--action)] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--action)]"
                >
                  <span className="t-badge t-badge-ok shrink-0">En curso</span>
                  <span className="font-medium text-[var(--ink)] truncate max-w-[240px] sm:max-w-[300px]">
                    {activeBlock.title}
                  </span>
                  <span className="t-num text-[13px] text-[var(--muted)] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0">
                    <span>hasta {formatMinutesAsClock(activeBlock.endMinutes)}</span>
                    <ArrowRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  </span>
                </button>
              ) : nextBlock ? (
                <button
                  type="button"
                  onClick={() => onNavigateTab?.('calendar')}
                  className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-left min-h-[44px] rounded-[10px] px-1 -mx-1 hover:text-[var(--action)] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--action)]"
                >
                  <span className="t-badge t-badge-accent t-num shrink-0">
                    {formatMinutesUntil(nextBlock.startMinutes - nowMinutes)}
                  </span>
                  <span className="font-medium text-[var(--ink)] truncate max-w-[230px] sm:max-w-[280px]">
                    {nextBlock.title}
                  </span>
                  <span className="t-num text-[13px] text-[var(--muted)] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0">
                    <span>{formatMinutesAsClock(nextBlock.startMinutes)}</span>
                    <ArrowRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  </span>
                </button>
              ) : overdueCount > 0 ? (
                <button
                  type="button"
                  onClick={() => onNavigateTab?.('university')}
                  className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-left min-h-[44px] rounded-[10px] px-1 -mx-1 hover:text-[var(--action)] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--action)]"
                >
                  <span className="t-badge t-badge-danger shrink-0">Prioridad</span>
                  <span className="font-medium text-[var(--ink)] inline-flex items-center gap-1.5">
                    <span>
                      Revisar {overdueCount}{' '}
                      {overdueCount === 1 ? 'entrega vencida' : 'entregas vencidas'}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-[var(--muted)] shrink-0" aria-hidden="true" />
                  </span>
                </button>
              ) : (
                <span className="inline-flex items-center gap-2 text-[var(--muted)] min-h-[44px]">
                  <CalendarClock className="w-4 h-4 text-[var(--ok)] shrink-0" aria-hidden="true" />
                  <span>Sin bloques pendientes el resto de hoy</span>
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => onOpenQuickAddWithTab?.('university')}
              className="t-btn t-btn-primary self-start sm:self-auto shrink-0"
            >
              <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Captura rápida</span>
            </button>
          </div>
        </div>

        {/* Right Column: 4 Day-Focused KPIs (Hairline-divided, zero nested boxes) */}
        <div className="xl:border-l xl:border-[var(--line)] xl:pl-8 w-full xl:w-auto pt-4 xl:pt-0 border-t xl:border-t-0 border-[var(--line)] shrink-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-4 gap-x-4 sm:gap-x-6">
            {/* KPI 1: Racha */}
            <div className="flex flex-col justify-between min-w-0">
              <div className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
                <Flame className="w-3.5 h-3.5 text-[var(--gym)] shrink-0" aria-hidden="true" />
                <span className="truncate">Racha</span>
              </div>
              <div className="mt-1.5">
                <div className="t-num text-xl sm:text-2xl font-semibold text-[var(--ink)] tracking-[-0.02em]">
                  {state.streak}{' '}
                  <span className="text-xs sm:text-sm font-normal text-[var(--muted)]">días</span>
                </div>
                <p className="text-xs text-[var(--muted)] mt-0.5 truncate">Constancia</p>
              </div>
            </div>

            {/* KPI 2: Gym hoy */}
            <div className="flex flex-col justify-between min-w-0 border-l border-[var(--line)] pl-4 sm:pl-6">
              <div className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
                <Dumbbell className="w-3.5 h-3.5 text-[var(--gym)] shrink-0" aria-hidden="true" />
                <span className="truncate">Gym ({todayName.slice(0, 3)})</span>
              </div>
              <div className="mt-1.5">
                <div className="t-num text-xl sm:text-2xl font-semibold text-[var(--ink)] tracking-[-0.02em]">
                  {completedSets}/{totalSets}
                </div>
                <p className="text-xs text-[var(--muted)] mt-0.5 truncate">
                  {gymSummary.label}
                </p>
              </div>
            </div>

            {/* KPI 3: Hábitos hoy */}
            <div className="flex flex-col justify-between min-w-0 pt-3 sm:pt-0 border-t sm:border-t-0 sm:border-l border-[var(--line)] sm:pl-6">
              <div className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
                <Droplets className="w-3.5 h-3.5 text-[var(--action)] shrink-0" aria-hidden="true" />
                <span className="truncate">Hábitos hoy</span>
              </div>
              <div className="mt-1.5">
                <div className="t-num text-xl sm:text-2xl font-semibold text-[var(--ink)] tracking-[-0.02em]">
                  {habitsPercent}%
                </div>
                <p className="text-xs text-[var(--muted)] mt-0.5 t-num truncate">
                  {normalizedHabits.pomodorosDone}/{normalizedHabits.targetPomodoros} enfoque
                </p>
              </div>
            </div>

            {/* KPI 4: Promedio GPA */}
            <div className="flex flex-col justify-between min-w-0 pt-3 sm:pt-0 border-t sm:border-t-0 border-l border-[var(--line)] pl-4 sm:pl-6">
              <div className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
                {overallGpa !== null ? (
                  <GraduationCap
                    className="w-3.5 h-3.5 text-[var(--ok)] shrink-0"
                    aria-hidden="true"
                  />
                ) : (
                  <CheckCircle2
                    className="w-3.5 h-3.5 text-[var(--muted)] shrink-0"
                    aria-hidden="true"
                  />
                )}
                <span className="truncate">Promedio GPA</span>
              </div>
              <div className="mt-1.5">
                <div className="t-num text-xl sm:text-2xl font-semibold text-[var(--ink)] tracking-[-0.02em]">
                  {overallGpa !== null ? overallGpa.toFixed(2) : '—'}
                </div>
                <p className="text-xs text-[var(--muted)] mt-0.5 truncate">
                  {overallGpa !== null ? gpaBadge.label : 'Escala 0–20'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
