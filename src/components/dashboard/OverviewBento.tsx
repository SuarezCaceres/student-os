import React, { useEffect, useId, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Database,
  Dumbbell,
  ExternalLink,
  FileCheck,
  GraduationCap,
  KanbanSquare,
  ListChecks,
  Moon,
  Pencil,
  Play,
  Plus,
  Save,
  X,
} from 'lucide-react';
import type { GoogleCalendarEvent } from '../../services/googleCalendar';
import type {
  AppState,
  AssignmentStatus,
  Category,
  DailyHabits,
  GymAttendanceLog,
  KanbanStatus,
  Priority,
  ReflectionMood,
  UniversityAssignment,
  WeeklyReflection,
} from '../../types';
import {
  buildTodayAgendaEntries,
  classifyTodayAgenda,
  formatMinutesAsClock,
  formatMinutesUntil,
  getAssignmentUrgency,
  getTodayGymSessionSummary,
  type TodayAgendaEntry,
} from '../../utils/academicStats';
import { triggerConfetti } from '../../utils/confetti';
import { getLocalIsoDate, getTodayDayOfWeek } from '../../utils/gymAttendance';
import type { MissingScheduledGymDay } from '../../utils/gymScheduleSync';
import { getNextDayOfWeek, isOvernightTimeRange } from '../../utils/workSchedule';
import { InstagramIcon } from '../common/InstagramIcon';
import { TiktokIcon } from '../common/TiktokIcon';
import { YoutubeIcon } from '../common/YoutubeIcon';
import type { NavTab } from '../layout/Navbar';
import { AssignmentDetailModal } from '../university/AssignmentDetailModal';
import { BackupModal } from './BackupModal';
import { DailyHabitsCard } from './DailyHabitsCard';

export interface OverviewBentoProps {
  state: AppState;
  googleEvents?: GoogleCalendarEvent[];
  todayDateIso?: string;
  attendanceLogs?: GymAttendanceLog[];
  missingScheduledGymDays?: MissingScheduledGymDay[];
  onNavigateTab: (tab: NavTab) => void;
  onToggleGymSet: (routineId: string, exerciseId: string, setIndex: number) => void;
  onUpdateUniStatus: (id: string, status: AssignmentStatus) => void;
  onUpdateAssignment?: (updated: UniversityAssignment) => void;
  onUpdateKanbanStatus: (id: string, status: KanbanStatus) => void;
  onOpenQuickAdd: (
    tab?: 'university' | 'gym' | 'kanban' | 'calendar' | 'learning'
  ) => void;
  onHabitsChange?: (habits: DailyHabits) => void;
  onSaveReflection?: (reflection: WeeklyReflection) => void;
  onRestoreState?: (restored: AppState) => void;
}

const CATEGORY_LABELS: Record<Category, string> = {
  universidad: 'Universidad',
  trabajo: 'Trabajo',
  gym: 'Gym',
  personal: 'Personal',
};

const PRIORITY_META: Record<Priority, { label: string; badgeClass: string; rank: number }> = {
  alta: { label: 'Alta', badgeClass: 't-badge t-badge-danger', rank: 0 },
  media: { label: 'Media', badgeClass: 't-badge t-badge-warn', rank: 1 },
  baja: { label: 'Baja', badgeClass: 't-badge', rank: 2 },
};

const MOOD_OPTIONS: Array<{ id: ReflectionMood; label: string }> = [
  { id: 'increible', label: 'Increíble' },
  { id: 'productivo', label: 'Productivo' },
  { id: 'despejado', label: 'Despejado' },
  { id: 'cansado', label: 'Cansado' },
];

const MOOD_LABELS: Record<ReflectionMood, string> = {
  increible: 'Increíble',
  productivo: 'Productivo',
  cansado: 'Cansado',
  despejado: 'Despejado',
};

export const OverviewBento: React.FC<OverviewBentoProps> = ({
  state,
  googleEvents = [],
  todayDateIso,
  attendanceLogs,
  missingScheduledGymDays = [],
  onNavigateTab,
  onToggleGymSet,
  onUpdateUniStatus,
  onUpdateAssignment,
  onUpdateKanbanStatus,
  onOpenQuickAdd,
  onHabitsChange,
  onSaveReflection,
  onRestoreState,
}) => {
  const reflectionFormId = useId();
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(new Date());
    }, 60_000);
    return () => window.clearInterval(id);
  }, []);

  const [isBackupOpen, setIsBackupOpen] = useState(false);
  const [showPastAgenda, setShowPastAgenda] = useState(false);
  const [showAllAssignments, setShowAllAssignments] = useState(false);
  const [showAllExercises, setShowAllExercises] = useState(false);
  const [showAllKanban, setShowAllKanban] = useState(false);
  const [showAllResources, setShowAllResources] = useState(false);
  const [isReflectionExpanded, setIsReflectionExpanded] = useState(false);
  const [detailAssignment, setDetailAssignment] =
    useState<UniversityAssignment | null>(null);

  const [isEditingReflection, setIsEditingReflection] = useState(false);
  const [draftLearnings, setDraftLearnings] = useState('');
  const [draftMood, setDraftMood] = useState<ReflectionMood>('productivo');

  const todayDay = getTodayDayOfWeek(now);
  const resolvedTodayIso = todayDateIso ?? getLocalIsoDate(now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  // 1. Agenda data & live classification
  const todayAgendaEntries = buildTodayAgendaEntries({
    calendarBlocks: state.calendarBlocks,
    googleEvents,
    todayDay,
    todayDateIso: resolvedTodayIso,
  });
  const { allDayEntries, activeEntries, upcomingEntries, pastEntries } =
    classifyTodayAgenda(todayAgendaEntries, nowMinutes);
  const workShift = state.workShift;
  const isWorkRestTonight = Boolean(workShift?.enabled && workShift.restDay === todayDay);

  // 2. University assignments (overdue + current/next week, sorted by urgency)
  const totalUni = state.universityAssignments.length;
  const doneUni = state.universityAssignments.filter(
    (a) => a.status === 'entregado'
  ).length;
  const cyclePercent = totalUni > 0 ? Math.round((doneUni / totalUni) * 100) : 100;

  const urgentAssignmentsAll = state.universityAssignments
    .filter((a) => {
      if (a.status === 'entregado') return false;
      const urgency = getAssignmentUrgency(a.dueDate, a.status, resolvedTodayIso);
      const isOverdue = urgency.daysDiff !== null && urgency.daysDiff < 0;
      const isDueSoon = urgency.daysDiff !== null && urgency.daysDiff <= 10;
      return isOverdue || isDueSoon || a.week <= state.currentAcademicWeek + 1;
    })
    .map((assignment) => ({
      assignment,
      urgency: getAssignmentUrgency(
        assignment.dueDate,
        assignment.status,
        resolvedTodayIso
      ),
    }))
    .sort((a, b) => {
      const diffA = a.urgency.daysDiff ?? Number.MAX_SAFE_INTEGER;
      const diffB = b.urgency.daysDiff ?? Number.MAX_SAFE_INTEGER;
      if (diffA !== diffB) return diffA - diffB;
      return a.assignment.week - b.assignment.week;
    });

  const visibleAssignments = showAllAssignments
    ? urgentAssignmentsAll
    : urgentAssignmentsAll.slice(0, 4);
  const hiddenAssignmentsCount = Math.max(0, urgentAssignmentsAll.length - 4);

  // 3. Today's Gym routine & real attendance state
  const todayRoutine = state.gymRoutines.find((r) => r.dayOfWeek === todayDay);
  const effectiveAttendanceLogs = attendanceLogs ?? state.gymAttendanceLogs ?? [];
  const gymSummary = getTodayGymSessionSummary({
    todayRoutine,
    todayDateIso: resolvedTodayIso,
    attendanceLogs: effectiveAttendanceLogs,
    todayAgendaEntries,
  });
  const gymExercises = todayRoutine?.exercises ?? [];
  const visibleExercises = showAllExercises
    ? gymExercises
    : gymExercises.slice(0, 3);
  const hiddenExercisesCount = Math.max(0, gymExercises.length - 3);

  // 4. Kanban in progress + high-priority fallback from todo
  const inProgressKanbanAll = [...state.kanbanItems]
    .filter((k) => k.status === 'in_progress')
    .sort((a, b) => PRIORITY_META[a.priority].rank - PRIORITY_META[b.priority].rank);
  const visibleInProgressKanban = showAllKanban
    ? inProgressKanbanAll
    : inProgressKanbanAll.slice(0, 4);
  const hiddenKanbanCount = Math.max(0, inProgressKanbanAll.length - 4);

  const suggestedTodoKanban =
    inProgressKanbanAll.length === 0
      ? [...state.kanbanItems]
          .filter((k) => k.status === 'todo')
          .sort(
            (a, b) =>
              PRIORITY_META[a.priority].rank - PRIORITY_META[b.priority].rank
          )
          .slice(0, 3)
      : [];

  // 5. Weekly Learning & Reflection
  const currentWeek = state.currentAcademicWeek;
  const currentWeekAssignments = state.universityAssignments.filter(
    (a) => a.week === currentWeek
  );
  const currentWeekPending = currentWeekAssignments.filter(
    (a) => a.status !== 'entregado'
  );
  const isFreeWeek =
    currentWeekAssignments.length > 0 && currentWeekPending.length === 0;
  const currentReflection = state.weeklyReflections?.[currentWeek];
  const allResources = currentReflection?.resources ?? [];
  const visibleResources = showAllResources
    ? allResources
    : allResources.slice(0, 3);
  const hiddenResourcesCount = Math.max(0, allResources.length - 3);
  const hasLongLearningText = Boolean(
    currentReflection?.learnings && currentReflection.learnings.length > 220
  );

  const handleOpenInlineReflection = () => {
    setDraftLearnings(currentReflection?.learnings ?? '');
    setDraftMood(currentReflection?.mood ?? 'productivo');
    setIsEditingReflection(true);
  };

  const handleSaveInlineReflection = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!onSaveReflection) return;
    const trimmed = draftLearnings.trim();
    const updated: WeeklyReflection = {
      week: currentWeek,
      learnings: trimmed,
      keyConcepts: currentReflection?.keyConcepts ?? [],
      resources: currentReflection?.resources ?? [],
      gymReflection: currentReflection?.gymReflection,
      mood: draftMood,
      updatedAt: resolvedTodayIso,
    };
    onSaveReflection(updated);
    setIsEditingReflection(false);
    if (trimmed) {
      triggerConfetti();
    }
  };

  const renderAgendaEntry = (
    entry: TodayAgendaEntry,
    statusMode: 'allDay' | 'active' | 'next' | 'upcoming' | 'past'
  ) => {
    const countdownLabel =
      statusMode === 'next'
        ? formatMinutesUntil(entry.startMinutes - nowMinutes)
        : null;

    if (entry.kind === 'google') {
      const ev = entry.event;
      return (
        <div
          key={entry.id}
          className={`t-row ${
            statusMode === 'active'
              ? 'border-l-2 border-l-[var(--ok)] pl-3'
              : statusMode === 'past'
                ? 'opacity-70'
                : ''
          }`}
        >
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div
              className={`t-num text-[13px] font-medium flex flex-wrap items-center gap-1.5 ${
                entry.isGym
                  ? 'text-[var(--gym)]'
                  : statusMode === 'past'
                    ? 'text-[var(--muted)]'
                    : 'text-[var(--ok)]'
              }`}
            >
              {entry.isGym ? (
                <Dumbbell className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              ) : (
                <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              )}
              <span>
                {ev.isAllDay ? 'Todo el día' : `${ev.startTime} – ${ev.endTime}`}
              </span>
              {statusMode === 'active' && (
                <span className="t-badge t-badge-ok">En curso</span>
              )}
              {countdownLabel && (
                <span className="t-badge t-badge-accent t-num">
                  {countdownLabel}
                </span>
              )}
              {statusMode === 'past' && <span className="t-badge">Finalizado</span>}
              {entry.isGym && <span className="t-badge t-badge-gym">Gym</span>}
              <span className="t-badge t-badge-ok">Google</span>
            </div>
            {ev.htmlLink && (
              <a
                href={ev.htmlLink}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Abrir en Google Calendar: ${ev.title}`}
                title="Abrir en Google Calendar"
                className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-[10px] text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors -my-2 -mr-2"
              >
                <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
              </a>
            )}
          </div>
          <h4 className="text-[15px] font-medium text-[var(--ink)] mt-0.5">
            {ev.title}
          </h4>
          {ev.location && (
            <p className="text-[13px] text-[var(--muted)] mt-0.5">{ev.location}</p>
          )}
        </div>
      );
    }

    const seg = entry.segment;
    const b = seg.block;
    return (
      <div
        key={entry.id}
        className={`t-row ${
          statusMode === 'active'
            ? 'border-l-2 border-l-[var(--ok)] pl-3'
            : statusMode === 'past'
              ? 'opacity-70'
              : ''
        }`}
      >
        <div
          className={`t-num text-[13px] font-medium flex flex-wrap items-center gap-1.5 ${
            entry.isGym
              ? 'text-[var(--gym)]'
              : statusMode === 'past'
                ? 'text-[var(--muted)]'
                : 'text-[var(--action)]'
          }`}
        >
          {entry.isGym ? (
            <Dumbbell className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          ) : (
            <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          )}
          <span>
            {seg.segmentRole === 'overnight_start'
              ? `${b.startTime} – ${b.endTime} (+1d)`
              : seg.segmentRole === 'overnight_continuation'
                ? `00:00 – ${seg.endTime}`
                : `${seg.startTime} – ${seg.endTime}`}
          </span>
          {statusMode === 'active' && (
            <span className="t-badge t-badge-ok">En curso</span>
          )}
          {countdownLabel && (
            <span className="t-badge t-badge-accent t-num">
              {countdownLabel}
            </span>
          )}
          {statusMode === 'past' && <span className="t-badge">Finalizado</span>}
          {seg.segmentRole === 'overnight_continuation' && (
            <span className="text-[var(--muted)] font-normal">
              · cierre turno {seg.originDay}
            </span>
          )}
          {seg.segmentRole === 'overnight_start' && (
            <span className="text-[var(--muted)] font-normal">
              · termina {getNextDayOfWeek(seg.day)} {b.endTime}
            </span>
          )}
        </div>
        <h4 className="text-[15px] font-medium text-[var(--ink)] mt-0.5">
          {b.title}
        </h4>
        {b.location && (
          <p className="text-[13px] text-[var(--muted)] mt-0.5">{b.location}</p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Workspace Operational Heading */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1">
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold tracking-[-0.025em] text-[var(--ink)]">
            Prioridades de hoy
          </h2>
          <p className="text-xs sm:text-sm text-[var(--muted)] mt-0.5">
            Agenda en tiempo real, entregas urgentes, entreno y hábitos sincronizados.
          </p>
        </div>

        <span className="t-badge t-num self-start sm:self-auto">
          {activeEntries.length > 0
            ? `${activeEntries.length} en curso`
            : upcomingEntries.length > 0
              ? `${upcomingEntries.length} ${upcomingEntries.length === 1 ? 'bloque restante' : 'bloques restantes'}`
              : 'Agenda libre hoy'}
        </span>
      </div>

      {/* Bento Grid Ordered by Daily Urgency */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Card 1: Agenda de hoy (Live Timeline) */}
        <div className="t-card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-2 pb-3.5 border-b border-[var(--line)] mb-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <CalendarDays
                    className="w-4 h-4 text-[var(--action)] shrink-0"
                    aria-hidden="true"
                  />
                  <h3 className="text-base font-medium text-[var(--ink)] truncate">
                    Agenda de {todayDay}
                  </h3>
                </div>
                <p className="text-[13px] text-[var(--muted)] mt-0.5 t-num">
                  Ahora {formatMinutesAsClock(nowMinutes)} ·{' '}
                  {activeEntries.length + upcomingEntries.length}{' '}
                  {activeEntries.length + upcomingEntries.length === 1
                    ? 'pendiente'
                    : 'pendientes'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => onNavigateTab('calendar')}
                className="t-btn t-btn-ghost px-2.5 text-[13px] shrink-0"
              >
                <span>Horario</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>

            {workShift?.enabled && (
              <div className="py-2.5 border-b border-[var(--line)] flex items-center justify-between gap-2 text-[13px]">
                <span className="flex items-center gap-1.5 text-[var(--ink)] min-w-0">
                  <Moon className="w-3.5 h-3.5 text-[var(--ok)] shrink-0" aria-hidden="true" />
                  <span className="truncate">
                    {isWorkRestTonight ? (
                      <>
                        Descanso hoy (sin entrada{' '}
                        <span className="t-num font-medium">{workShift.startTime}</span>)
                      </>
                    ) : (
                      <>
                        Turno:{' '}
                        <span className="t-num font-medium">
                          {workShift.startTime}–{workShift.endTime}
                        </span>
                        {isOvernightTimeRange(workShift.startTime, workShift.endTime)
                          ? ' (+1d)'
                          : ''}
                      </>
                    )}
                  </span>
                </span>
                {workShift.restDay && (
                  <span className="t-badge shrink-0">
                    Descanso: {workShift.restDay.slice(0, 3)}
                  </span>
                )}
              </div>
            )}

            {todayAgendaEntries.length === 0 ? (
              <p className="py-8 text-[14px] text-[var(--muted)]">
                No tienes clases ni bloques agendados para hoy.
              </p>
            ) : (
              <div>
                {allDayEntries.map((entry) => renderAgendaEntry(entry, 'allDay'))}
                {activeEntries.map((entry) => renderAgendaEntry(entry, 'active'))}
                {upcomingEntries.map((entry, idx) =>
                  renderAgendaEntry(
                    entry,
                    idx === 0 && activeEntries.length === 0 ? 'next' : 'upcoming'
                  )
                )}

                {activeEntries.length === 0 &&
                  upcomingEntries.length === 0 &&
                  pastEntries.length > 0 && (
                    <p className="py-4 text-[14px] text-[var(--muted)]">
                      Ya completaste los bloques programados hasta esta hora.
                    </p>
                  )}

                {pastEntries.length > 0 && (
                  <div className="pt-3 mt-2 border-t border-[var(--line)]">
                    <button
                      type="button"
                      onClick={() => setShowPastAgenda((prev) => !prev)}
                      aria-expanded={showPastAgenda}
                      className="t-btn t-btn-ghost w-full justify-between px-2 text-[13px]"
                    >
                      <span className="t-num">
                        {showPastAgenda ? 'Ocultar' : 'Ver'} {pastEntries.length}{' '}
                        {pastEntries.length === 1
                          ? 'bloque anterior'
                          : 'bloques anteriores'}
                      </span>
                      {showPastAgenda ? (
                        <ChevronUp className="w-4 h-4 shrink-0" aria-hidden="true" />
                      ) : (
                        <ChevronDown className="w-4 h-4 shrink-0" aria-hidden="true" />
                      )}
                    </button>

                    {showPastAgenda && (
                      <div className="mt-2">
                        {pastEntries.map((entry) => renderAgendaEntry(entry, 'past'))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => onOpenQuickAdd('calendar')}
            className="t-btn t-btn-secondary w-full mt-5"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>Agendar bloque</span>
          </button>
        </div>

        {/* Card 2: Entregas por vencer */}
        <div className="t-card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-2 pb-3.5 border-b border-[var(--line)] mb-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <GraduationCap
                    className="w-4 h-4 text-[var(--action)] shrink-0"
                    aria-hidden="true"
                  />
                  <h3 className="text-base font-medium text-[var(--ink)] truncate">
                    Entregas por vencer
                  </h3>
                </div>
                <p className="text-[13px] text-[var(--muted)] mt-0.5 t-num">
                  Ciclo: {doneUni}/{totalUni} ({cyclePercent}% avance)
                </p>
              </div>

              <button
                type="button"
                onClick={() => onNavigateTab('university')}
                className="t-btn t-btn-ghost px-2.5 text-[13px] shrink-0"
              >
                <span>Ver todas</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>

            {urgentAssignmentsAll.length === 0 ? (
              <p className="py-8 text-[14px] text-[var(--muted)]">
                No tienes entregas próximas pendientes. Estás al día.
              </p>
            ) : (
              <div>
                {visibleAssignments.map(({ assignment: a, urgency }) => {
                  const rubricTotal = a.rubricCriteria?.length ?? 0;
                  const rubricDone =
                    a.rubricCriteria?.filter((c) => c.done).length ?? 0;

                  return (
                    <div
                      key={a.id}
                      className="t-row flex items-center justify-between gap-3"
                    >
                      <button
                        type="button"
                        onClick={() => setDetailAssignment(a)}
                        className="min-w-0 flex-1 text-left cursor-pointer group rounded-[10px] py-1 px-1 -mx-1 focus-visible:outline-2 focus-visible:outline-[var(--action)]"
                        title="Ver detalle, rúbrica y enlace de entrega"
                      >
                        <div className="flex flex-wrap items-center gap-1.5 text-[13px] text-[var(--muted)]">
                          <span className="t-num font-medium text-[var(--action)] shrink-0">
                            Sem. {a.week}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="truncate max-w-[160px]">{a.course}</span>
                        </div>
                        <h4 className="text-[15px] font-medium text-[var(--ink)] group-hover:text-[var(--action)] transition-colors truncate mt-0.5">
                          {a.title}
                        </h4>
                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                          <span className={urgency.badgeClass}>{urgency.label}</span>
                          {rubricTotal > 0 && (
                            <span className="inline-flex items-center gap-1 text-[13px] text-[var(--muted)] t-num">
                              <FileCheck
                                className="w-3.5 h-3.5 text-[var(--ok)] shrink-0"
                                aria-hidden="true"
                              />
                              {rubricDone}/{rubricTotal}
                            </span>
                          )}
                          {a.submissionUrl && (
                            <span className="inline-flex items-center gap-1 text-[13px] text-[var(--muted)]">
                              <ExternalLink
                                className="w-3.5 h-3.5 shrink-0"
                                aria-hidden="true"
                              />
                              <span>Enlace</span>
                            </span>
                          )}
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          triggerConfetti();
                          onUpdateUniStatus(a.id, 'entregado');
                        }}
                        className="t-btn t-btn-secondary t-btn-icon shrink-0"
                        title="Marcar como entregada"
                        aria-label={`Marcar ${a.title} como entregada`}
                      >
                        <Check className="w-4 h-4 text-[var(--ok)]" aria-hidden="true" />
                      </button>
                    </div>
                  );
                })}

                {hiddenAssignmentsCount > 0 && (
                  <div className="pt-3 mt-1 border-t border-[var(--line)]">
                    <button
                      type="button"
                      onClick={() => setShowAllAssignments((prev) => !prev)}
                      aria-expanded={showAllAssignments}
                      className="t-btn t-btn-ghost w-full justify-between px-2 text-[13px]"
                    >
                      <span className="t-num">
                        {showAllAssignments
                          ? 'Mostrar menos entregas'
                          : `Ver +${hiddenAssignmentsCount} ${
                              hiddenAssignmentsCount === 1
                                ? 'entrega más'
                                : 'entregas más'
                            }`}
                      </span>
                      {showAllAssignments ? (
                        <ChevronUp className="w-4 h-4 shrink-0" aria-hidden="true" />
                      ) : (
                        <ChevronDown className="w-4 h-4 shrink-0" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => onOpenQuickAdd('university')}
            className="t-btn t-btn-secondary w-full mt-5"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>Agregar entrega</span>
          </button>
        </div>

        {/* Card 3: Entrenamiento de hoy (Synced with Attendance & Schedule) */}
        <div className="t-card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-2 pb-3.5 border-b border-[var(--line)] mb-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Dumbbell
                    className="w-4 h-4 text-[var(--gym)] shrink-0"
                    aria-hidden="true"
                  />
                  <h3 className="text-base font-medium text-[var(--ink)] truncate">
                    Entrenamiento ({todayDay.slice(0, 3)})
                  </h3>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-0.5">
                  <p className="text-[13px] text-[var(--muted)] truncate">
                    {todayRoutine ? todayRoutine.tag : 'Día de descanso'}
                    {gymSummary.scheduledTimeLabel && (
                      <>
                        {' · '}
                        <span className="t-num">{gymSummary.scheduledTimeLabel}</span>
                      </>
                    )}
                  </p>
                  <span className={gymSummary.badgeClass}>{gymSummary.label}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onNavigateTab('gym')}
                className="t-btn t-btn-ghost px-2.5 text-[13px] shrink-0"
              >
                <span>Ver rutina</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>

            {missingScheduledGymDays.length > 0 && (
              <div className="py-2.5 border-b border-[var(--line)] flex items-center justify-between gap-2 text-[13px]">
                <span className="flex items-center gap-1.5 text-[var(--warn)] min-w-0">
                  <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">
                    {missingScheduledGymDays.length}{' '}
                    {missingScheduledGymDays.length === 1
                      ? 'día sin horario en calendario'
                      : 'días sin horario en calendario'}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => onNavigateTab('gym')}
                  className="t-btn t-btn-ghost px-2.5 text-[13px] shrink-0 text-[var(--action)]"
                >
                  Resolver
                </button>
              </div>
            )}

            {!todayRoutine || gymExercises.length === 0 ? (
              <p className="py-8 text-[14px] text-[var(--muted)]">
                Hoy toca descanso o aún no hay ejercicios cargados.
              </p>
            ) : (
              <div>
                {visibleExercises.map((ex) => (
                  <div key={ex.id} className="t-row">
                    <div className="flex items-baseline justify-between gap-2 mb-2.5">
                      <h4 className="text-[15px] font-medium text-[var(--ink)] truncate">
                        {ex.name}
                      </h4>
                      <span className="t-num text-[13px] font-medium text-[var(--muted)] shrink-0">
                        {ex.weightKg ? `${ex.weightKg} kg · ${ex.reps}` : ex.reps}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {Array.from({ length: ex.sets }).map((_, sIdx) => {
                        const isDone = Boolean(ex.completedSets[sIdx]);
                        return (
                          <button
                            key={sIdx}
                            type="button"
                            onClick={() => {
                              if (!isDone) triggerConfetti();
                              onToggleGymSet(todayRoutine.id, ex.id, sIdx);
                            }}
                            aria-pressed={isDone}
                            aria-label={`${ex.name}, serie ${sIdx + 1}`}
                            className={`min-w-[44px] min-h-[44px] px-2.5 rounded-[10px] t-num text-[13px] font-medium border inline-flex items-center justify-center cursor-pointer select-none transition-colors duration-[150ms] focus-visible:outline-2 focus-visible:outline-[var(--action)] ${
                              isDone
                                ? 'bg-[color-mix(in_oklab,var(--ok)_16%,transparent)] border-[color-mix(in_oklab,var(--ok)_40%,transparent)] text-[var(--ok)]'
                                : 'bg-[var(--surface-2)] border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)] hover:border-[var(--line-strong)]'
                            }`}
                          >
                            S{sIdx + 1}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {hiddenExercisesCount > 0 && (
                  <div className="pt-3 mt-1 border-t border-[var(--line)]">
                    <button
                      type="button"
                      onClick={() => setShowAllExercises((prev) => !prev)}
                      aria-expanded={showAllExercises}
                      className="t-btn t-btn-ghost w-full justify-between px-2 text-[13px]"
                    >
                      <span className="t-num">
                        {showAllExercises
                          ? 'Mostrar menos ejercicios'
                          : `Ver +${hiddenExercisesCount} ${
                              hiddenExercisesCount === 1
                                ? 'ejercicio más'
                                : 'ejercicios más'
                            }`}
                      </span>
                      {showAllExercises ? (
                        <ChevronUp className="w-4 h-4 shrink-0" aria-hidden="true" />
                      ) : (
                        <ChevronDown className="w-4 h-4 shrink-0" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => onOpenQuickAdd('gym')}
            className="t-btn t-btn-secondary w-full mt-5"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>Agregar ejercicio</span>
          </button>
        </div>

        {/* Card 4: Hábitos diarios */}
        <DailyHabitsCard
          initialHabits={state.dailyHabits}
          todayDateIso={resolvedTodayIso}
          onHabitsChange={onHabitsChange}
        />

        {/* Card 5 (2 Cols on lg): Proyectos en foco (Kanban) */}
        <div className="t-card p-6 lg:col-span-2 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 pb-3.5 border-b border-[var(--line)] mb-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <KanbanSquare
                    className="w-4 h-4 text-[var(--action)] shrink-0"
                    aria-hidden="true"
                  />
                  <h3 className="text-base font-medium text-[var(--ink)] truncate">
                    Proyectos en foco
                  </h3>
                </div>
                <p className="text-[13px] text-[var(--muted)] mt-0.5">
                  {inProgressKanbanAll.length > 0
                    ? 'Tareas en curso ordenadas por prioridad'
                    : 'Sin tareas en curso · sugerencias de "Por hacer" listas para iniciar'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => onNavigateTab('kanban')}
                className="t-btn t-btn-ghost px-2.5 text-[13px] shrink-0"
              >
                <span>Ver tablero</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>

            {inProgressKanbanAll.length > 0 ? (
              <div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
                  {visibleInProgressKanban.map((k) => {
                    const pMeta = PRIORITY_META[k.priority];
                    const checkTotal = k.checklist?.length ?? 0;
                    const checkDone =
                      k.checklist?.filter((item) => item.done).length ?? 0;
                    const checkPercent =
                      checkTotal > 0 ? Math.round((checkDone / checkTotal) * 100) : 0;

                    return (
                      <div
                        key={k.id}
                        className="py-4 border-b border-[var(--line)] last:border-b-0 flex flex-col justify-between gap-3"
                      >
                        <div>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className={pMeta.badgeClass}>{pMeta.label}</span>
                              <span className="t-badge">
                                {CATEGORY_LABELS[k.category]}
                              </span>
                            </div>
                            <span className="text-[13px] text-[var(--muted)] t-num">
                              {k.dueDate ? `Vence ${k.dueDate}` : 'Sin fecha'}
                            </span>
                          </div>
                          <h4 className="text-[15px] font-medium text-[var(--ink)] mt-2 leading-snug">
                            {k.title}
                          </h4>
                          {k.description && (
                            <p className="text-[13px] text-[var(--muted)] mt-1 line-clamp-2">
                              {k.description}
                            </p>
                          )}

                          {checkTotal > 0 && (
                            <div className="mt-2.5">
                              <div className="flex items-center justify-between text-[13px] text-[var(--muted)] mb-1">
                                <span className="inline-flex items-center gap-1">
                                  <ListChecks className="w-3.5 h-3.5" aria-hidden="true" />
                                  <span>Subtareas</span>
                                </span>
                                <span className="t-num">
                                  {checkDone}/{checkTotal}
                                </span>
                              </div>
                              <div className="w-full h-1.5 rounded-full bg-[var(--surface-2)] overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-[width] duration-300"
                                  style={{
                                    width: `${checkPercent}%`,
                                    backgroundColor:
                                      checkPercent >= 100 ? 'var(--ok)' : 'var(--action)',
                                  }}
                                />
                              </div>
                            </div>
                          )}
                        </div>

                        <div>
                          <button
                            type="button"
                            onClick={() => {
                              triggerConfetti();
                              onUpdateKanbanStatus(k.id, 'done');
                            }}
                            className="t-btn t-btn-secondary px-3.5 text-[14px]"
                          >
                            <Check
                              className="w-4 h-4 text-[var(--ok)]"
                              aria-hidden="true"
                            />
                            <span>Marcar listo</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {hiddenKanbanCount > 0 && (
                  <div className="pt-3 mt-1 border-t border-[var(--line)]">
                    <button
                      type="button"
                      onClick={() => setShowAllKanban((prev) => !prev)}
                      aria-expanded={showAllKanban}
                      className="t-btn t-btn-ghost w-full justify-between px-2 text-[13px]"
                    >
                      <span className="t-num">
                        {showAllKanban
                          ? 'Mostrar menos tareas'
                          : `Ver +${hiddenKanbanCount} ${
                              hiddenKanbanCount === 1
                                ? 'tarea en curso'
                                : 'tareas en curso'
                            }`}
                      </span>
                      {showAllKanban ? (
                        <ChevronUp className="w-4 h-4 shrink-0" aria-hidden="true" />
                      ) : (
                        <ChevronDown className="w-4 h-4 shrink-0" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                )}
              </div>
            ) : suggestedTodoKanban.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6">
                {suggestedTodoKanban.map((k) => {
                  const pMeta = PRIORITY_META[k.priority];
                  return (
                    <div
                      key={k.id}
                      className="py-4 border-b border-[var(--line)] last:border-b-0 flex flex-col justify-between gap-3"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={pMeta.badgeClass}>{pMeta.label}</span>
                          <span className="t-badge">{CATEGORY_LABELS[k.category]}</span>
                        </div>
                        <h4 className="text-[15px] font-medium text-[var(--ink)] mt-2 leading-snug">
                          {k.title}
                        </h4>
                        {k.dueDate && (
                          <p className="text-[13px] text-[var(--muted)] t-num mt-1">
                            Vence {k.dueDate}
                          </p>
                        )}
                      </div>
                      <div>
                        <button
                          type="button"
                          onClick={() => onUpdateKanbanStatus(k.id, 'in_progress')}
                          className="t-btn t-btn-secondary px-3.5 text-[14px]"
                        >
                          <Play
                            className="w-3.5 h-3.5 text-[var(--action)]"
                            aria-hidden="true"
                          />
                          <span>Iniciar</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="py-8 text-[14px] text-[var(--muted)]">
                No tienes tareas pendientes ni en curso en Kanban. Crea una desde Captura rápida o el tablero.
              </p>
            )}
          </div>
        </div>

        {/* Card 6 (Full Width): Aprendizaje de la semana */}
        <div className="t-card p-6 col-span-1 md:col-span-2 lg:col-span-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[var(--line)] mb-5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <BookOpen
                  className="w-4 h-4 text-[var(--action)] shrink-0"
                  aria-hidden="true"
                />
                <h3 className="text-base sm:text-lg font-medium text-[var(--ink)]">
                  Aprendizaje de la semana <span className="t-num">{currentWeek}</span>
                </h3>
                {isFreeWeek && <span className="t-badge t-badge-ok">Semana libre</span>}
                {currentReflection?.mood && (
                  <span className="t-badge">
                    Estado: {MOOD_LABELS[currentReflection.mood]}
                  </span>
                )}
              </div>
              <p className="text-[14px] text-[var(--muted)] mt-1">
                Resume con tus palabras lo más importante que aprendiste esta semana.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto shrink-0">
              {onSaveReflection && !isEditingReflection && (
                <button
                  type="button"
                  onClick={handleOpenInlineReflection}
                  className="t-btn t-btn-secondary"
                >
                  <Pencil className="w-4 h-4" aria-hidden="true" />
                  <span>
                    {currentReflection?.learnings ? 'Editar síntesis' : 'Escribir resumen'}
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={() => onNavigateTab('learning')}
                className="t-btn t-btn-ghost"
              >
                <span>Abrir aprendizaje</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
            {/* Left Column: Active Recall Summary / Inline Composer */}
            <div className="lg:border-r lg:border-[var(--line)] lg:pr-8 flex flex-col justify-between">
              {isEditingReflection ? (
                <form
                  onSubmit={handleSaveInlineReflection}
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                      e.preventDefault();
                      handleSaveInlineReflection();
                    }
                  }}
                  className="space-y-3.5"
                >
                  <div>
                    <label
                      htmlFor={`${reflectionFormId}-learnings`}
                      className="t-label"
                    >
                      Síntesis rápida (Semana {currentWeek})
                    </label>
                    <textarea
                      id={`${reflectionFormId}-learnings`}
                      rows={4}
                      value={draftLearnings}
                      onChange={(e) => setDraftLearnings(e.target.value)}
                      placeholder="Explica en tus propias palabras lo clave de esta semana..."
                      className="t-input min-h-[112px] resize-y"
                    />
                  </div>

                  <div>
                    <span className="t-label">Estado cognitivo</span>
                    <div className="flex flex-wrap gap-2">
                      {MOOD_OPTIONS.map((option) => {
                        const isSelected = draftMood === option.id;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => setDraftMood(option.id)}
                            aria-pressed={isSelected}
                            className={`min-h-[44px] px-3.5 rounded-[12px] text-[14px] font-medium border cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-[var(--action)] ${
                              isSelected
                                ? 'bg-[color-mix(in_oklab,var(--action)_14%,transparent)] border-[var(--action)] text-[var(--action)]'
                                : 'bg-[var(--surface-2)] border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)]'
                            }`}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsEditingReflection(false)}
                      className="t-btn t-btn-secondary"
                    >
                      <X className="w-4 h-4" aria-hidden="true" />
                      <span>Cancelar</span>
                    </button>
                    <button type="submit" className="t-btn t-btn-primary">
                      <Save className="w-4 h-4" aria-hidden="true" />
                      <span>Guardar síntesis</span>
                    </button>
                  </div>
                </form>
              ) : currentReflection?.learnings ? (
                <div>
                  <p className="text-[13px] font-medium text-[var(--muted)] mb-2">
                    Tu síntesis registrada
                  </p>
                  <p
                    className={`text-[15px] text-[var(--ink)] leading-relaxed whitespace-pre-line ${
                      hasLongLearningText && !isReflectionExpanded ? 'line-clamp-4' : ''
                    }`}
                  >
                    {currentReflection.learnings}
                  </p>

                  {hasLongLearningText && (
                    <button
                      type="button"
                      onClick={() => setIsReflectionExpanded((prev) => !prev)}
                      aria-expanded={isReflectionExpanded}
                      className="t-btn t-btn-ghost px-2 mt-1.5 text-[13px]"
                    >
                      <span>{isReflectionExpanded ? 'Mostrar menos' : 'Ver completo'}</span>
                    </button>
                  )}

                  {currentReflection.keyConcepts &&
                    currentReflection.keyConcepts.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-4">
                        {currentReflection.keyConcepts.map((concept, idx) => (
                          <span
                            key={idx}
                            className="t-badge t-badge-accent max-w-full whitespace-normal break-words leading-snug"
                          >
                            #{concept}
                          </span>
                        ))}
                      </div>
                    )}
                </div>
              ) : (
                <div>
                  <h4 className="text-[15px] font-medium text-[var(--ink)]">
                    Todavía no escribiste tu resumen de la semana{' '}
                    <span className="t-num">{currentWeek}</span>
                  </h4>
                  <p className="text-[14px] text-[var(--muted)] mt-1 mb-4 leading-relaxed">
                    Explicar un tema sin mirar apuntes te ayuda a detectar huecos antes de los exámenes.
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      onSaveReflection
                        ? handleOpenInlineReflection()
                        : onNavigateTab('learning')
                    }
                    className="t-btn t-btn-primary"
                  >
                    <span>Escribir resumen</span>
                  </button>
                </div>
              )}

              {isFreeWeek && (
                <div className="mt-5 pt-4 border-t border-[var(--line)] flex flex-wrap items-center justify-between gap-3">
                  <span className="text-[13px] font-medium text-[var(--ok)]">
                    Cerraste todas las entregas de la semana{' '}
                    <span className="t-num">{currentWeek}</span>.
                  </span>
                  <button
                    type="button"
                    onClick={() => onNavigateTab('gym')}
                    className="t-btn t-btn-ghost px-3 text-[13px]"
                  >
                    <span>Ir al Gym</span>
                    <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>
              )}
            </div>

            {/* Right Column: YouTube & Saved Study Links */}
            <div className="flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 text-[14px] font-medium text-[var(--ink)]">
                    <YoutubeIcon className="w-4 h-4 text-[var(--danger)] shrink-0" />
                    <span>Videos y fuentes guardadas</span>
                  </div>
                  <span className="t-badge t-num">{allResources.length}</span>
                </div>

                {allResources.length > 0 ? (
                  <div>
                    {visibleResources.map((res) =>
                      res.url ? (
                        <a
                          key={res.id}
                          href={res.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="t-row group flex items-center justify-between gap-3 min-h-[44px]"
                        >
                          <div className="flex items-start gap-2.5 min-w-0">
                            {res.type === 'youtube' ? (
                              <YoutubeIcon className="w-4 h-4 text-[var(--danger)] shrink-0 mt-1" />
                            ) : res.type === 'tiktok' ? (
                              <TiktokIcon className="w-4 h-4 text-[var(--ink)] shrink-0 mt-1" />
                            ) : res.type === 'instagram' ? (
                              <InstagramIcon className="w-4 h-4 text-[var(--ink)] shrink-0 mt-1" />
                            ) : (
                              <BookOpen
                                className="w-4 h-4 text-[var(--action)] shrink-0 mt-1"
                                aria-hidden="true"
                              />
                            )}
                            <div className="min-w-0">
                              <div className="text-[14px] font-medium text-[var(--ink)] group-hover:text-[var(--action)] transition-colors truncate">
                                {res.title}
                              </div>
                              {res.notes && (
                                <p className="text-[13px] text-[var(--muted)] truncate mt-0.5">
                                  {res.notes}
                                </p>
                              )}
                            </div>
                          </div>
                          <ExternalLink
                            className="w-4 h-4 text-[var(--muted)] group-hover:text-[var(--action)] shrink-0"
                            aria-hidden="true"
                          />
                        </a>
                      ) : (
                        <div key={res.id} className="t-row flex items-start gap-2.5">
                          {res.type === 'tiktok' ? (
                            <TiktokIcon className="w-4 h-4 text-[var(--ink)] shrink-0 mt-1" />
                          ) : res.type === 'instagram' ? (
                            <InstagramIcon className="w-4 h-4 text-[var(--ink)] shrink-0 mt-1" />
                          ) : (
                            <BookOpen
                              className="w-4 h-4 text-[var(--action)] shrink-0 mt-1"
                              aria-hidden="true"
                            />
                          )}
                          <div className="min-w-0">
                            <div className="text-[14px] font-medium text-[var(--ink)] truncate">
                              {res.title}
                            </div>
                            {res.notes && (
                              <p className="text-[13px] text-[var(--muted)] truncate mt-0.5">
                                {res.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      )
                    )}

                    {hiddenResourcesCount > 0 && (
                      <div className="pt-3 mt-1 border-t border-[var(--line)]">
                        <button
                          type="button"
                          onClick={() => setShowAllResources((prev) => !prev)}
                          aria-expanded={showAllResources}
                          className="t-btn t-btn-ghost w-full justify-between px-2 text-[13px]"
                        >
                          <span className="t-num">
                            {showAllResources
                              ? 'Mostrar menos recursos'
                              : `Ver +${hiddenResourcesCount} ${
                                  hiddenResourcesCount === 1
                                    ? 'recurso más'
                                    : 'recursos más'
                                }`}
                          </span>
                          {showAllResources ? (
                            <ChevronUp className="w-4 h-4 shrink-0" aria-hidden="true" />
                          ) : (
                            <ChevronDown className="w-4 h-4 shrink-0" aria-hidden="true" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-[14px] text-[var(--muted)] py-4">
                    Aún no guardaste videos de YouTube ni apuntes esta semana.
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => onOpenQuickAdd('learning')}
                className="t-btn t-btn-secondary w-full mt-4"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                <span>Guardar recurso</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Subtle Utility Footer (Backup JSON moved out of primary operational top bar) */}
      <div className="pt-4 border-t border-[var(--line)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-[13px] text-[var(--muted)]">
          Persistencia local automática en este dispositivo · exporta un respaldo cuando lo necesites.
        </p>

        <button
          type="button"
          onClick={() => setIsBackupOpen(true)}
          className="t-btn t-btn-ghost self-start sm:self-auto shrink-0 text-[13px]"
          title="Descargar o restaurar copia de seguridad en JSON"
        >
          <Database className="w-4 h-4 text-[var(--action)] shrink-0" aria-hidden="true" />
          <span>Respaldo JSON</span>
        </button>
      </div>

      <AssignmentDetailModal
        isOpen={detailAssignment !== null}
        onClose={() => setDetailAssignment(null)}
        assignment={detailAssignment}
        onSaveAssignment={(updated) => {
          if (onUpdateAssignment) {
            onUpdateAssignment(updated);
          } else {
            onUpdateUniStatus(updated.id, updated.status);
          }
          setDetailAssignment(null);
        }}
      />

      <BackupModal
        isOpen={isBackupOpen}
        onClose={() => setIsBackupOpen(false)}
        currentState={state}
        onRestoreState={onRestoreState}
      />
    </div>
  );
};
