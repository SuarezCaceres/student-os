import React, { useState } from 'react';
import {
  GraduationCap,
  Dumbbell,
  KanbanSquare,
  CalendarDays,
  Check,
  Clock,
  ArrowRight,
  Plus,
  Database,
  BookOpen,
  ExternalLink,
  Moon,
} from 'lucide-react';
import { YoutubeIcon } from '../common/YoutubeIcon';
import { TiktokIcon } from '../common/TiktokIcon';
import { InstagramIcon } from '../common/InstagramIcon';
import type {
  AppState,
  DayOfWeek,
  AssignmentStatus,
  KanbanStatus,
  DailyHabits,
  Category,
  ReflectionMood,
} from '../../types';
import type { GoogleCalendarEvent } from '../../services/googleCalendar';
import { isStudentOsGymGoogleEvent } from '../../utils/gymScheduleFilter';
import { getLocalIsoDate } from '../../utils/gymAttendance';
import { triggerConfetti } from '../../utils/confetti';
import type { NavTab } from '../layout/Navbar';
import { DailyHabitsCard } from './DailyHabitsCard';
import { BackupModal } from './BackupModal';
import {
  expandCalendarBlocksToSegments,
  getNextDayOfWeek,
  isOvernightTimeRange,
  parseTimeToMinutes,
} from '../../utils/workSchedule';

export interface OverviewBentoProps {
  state: AppState;
  googleEvents?: GoogleCalendarEvent[];
  todayDateIso?: string;
  onNavigateTab: (tab: NavTab) => void;
  onToggleGymSet: (routineId: string, exerciseId: string, setIndex: number) => void;
  onUpdateUniStatus: (id: string, status: AssignmentStatus) => void;
  onUpdateKanbanStatus: (id: string, status: KanbanStatus) => void;
  onOpenQuickAdd: (tab?: 'university' | 'gym' | 'kanban' | 'calendar' | 'learning') => void;
  onHabitsChange?: (habits: DailyHabits) => void;
  onRestoreState?: (restored: AppState) => void;
}

const CATEGORY_LABELS: Record<Category, string> = {
  universidad: 'Universidad',
  trabajo: 'Trabajo',
  gym: 'Gym',
  personal: 'Personal',
};

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
  onNavigateTab,
  onToggleGymSet,
  onUpdateUniStatus,
  onUpdateKanbanStatus,
  onOpenQuickAdd,
  onHabitsChange,
  onRestoreState,
}) => {
  const [isBackupOpen, setIsBackupOpen] = useState(false);

  const [todayDay] = useState<DayOfWeek>(() => {
    const daysMap: DayOfWeek[] = [
      'Domingo',
      'Lunes',
      'Martes',
      'Miércoles',
      'Jueves',
      'Viernes',
      'Sábado',
    ];
    return daysMap[new Date().getDay()];
  });

  const todayRoutine = state.gymRoutines.find((r) => r.dayOfWeek === todayDay);

  const urgentAssignments = state.universityAssignments
    .filter((a) => a.status !== 'entregado' && a.week <= state.currentAcademicWeek + 1)
    .sort((a, b) => a.week - b.week || (a.dueDate || '').localeCompare(b.dueDate || ''))
    .slice(0, 4);

  const inProgressKanban = state.kanbanItems
    .filter((k) => k.status === 'in_progress')
    .slice(0, 4);

  const todaySegments = expandCalendarBlocksToSegments(state.calendarBlocks)
    .filter((seg) => seg.day === todayDay)
    .sort((a, b) => parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime));

  const resolvedTodayIso = todayDateIso ?? getLocalIsoDate();
  const mirroredGoogleIds = new Set(
    state.calendarBlocks.map((b) => b.googleEventId).filter((id): id is string => Boolean(id))
  );
  const todayGoogleEvents = googleEvents.filter(
    (ev) =>
      !mirroredGoogleIds.has(ev.id) &&
      (ev.dateIso ? ev.dateIso === resolvedTodayIso : ev.day === todayDay)
  );
  const todayAgendaEntries = [
    ...todaySegments.map((segment) => ({
      kind: 'local' as const,
      sortMinutes: parseTimeToMinutes(segment.startTime),
      segment,
    })),
    ...todayGoogleEvents.map((event) => ({
      kind: 'google' as const,
      sortMinutes: event.isAllDay ? -1 : parseTimeToMinutes(event.startTime),
      event,
    })),
  ].sort((a, b) => a.sortMinutes - b.sortMinutes);

  const workShift = state.workShift;
  const isWorkRestTonight = Boolean(workShift?.enabled && workShift.restDay === todayDay);

  const currentWeek = state.currentAcademicWeek;
  const currentWeekAssignments = state.universityAssignments.filter((a) => a.week === currentWeek);
  const currentWeekPending = currentWeekAssignments.filter((a) => a.status !== 'entregado');
  const isFreeWeek = currentWeekAssignments.length > 0 && currentWeekPending.length === 0;
  const currentReflection = state.weeklyReflections?.[currentWeek];

  return (
    <div className="space-y-6">
      {/* Workspace Operational Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold tracking-[-0.025em] text-[var(--ink)]">
            Prioridades de hoy
          </h2>
          <p className="text-xs sm:text-sm text-[var(--muted)] mt-0.5">
            Clases, rutinas de fuerza, hábitos y tareas en curso sincronizados en local.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsBackupOpen(true)}
          className="t-btn t-btn-secondary self-start sm:self-auto shrink-0"
          title="Descargar o restaurar copia de seguridad en JSON"
        >
          <Database className="w-4 h-4 text-[var(--action)] shrink-0" />
          <span>Respaldo JSON</span>
        </button>
      </div>

      {/* Bento Grid (Strict Two-Level Hierarchy: .t-card + .t-row) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Card 1: Entregas por vencer */}
        <div className="t-card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 pb-3.5 border-b border-[var(--line)] mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <GraduationCap className="w-4 h-4 text-[var(--action)] shrink-0" />
                <h3 className="text-base font-medium text-[var(--ink)] truncate">
                  Entregas por vencer
                </h3>
              </div>

              <button
                type="button"
                onClick={() => onNavigateTab('university')}
                className="t-btn t-btn-ghost px-2.5 text-[13px] shrink-0"
              >
                <span>Ver todas</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {urgentAssignments.length === 0 ? (
              <p className="py-8 text-[14px] text-[var(--muted)]">
                No tienes entregas próximas pendientes. Estás al día.
              </p>
            ) : (
              <div>
                {urgentAssignments.map((a) => (
                  <div
                    key={a.id}
                    className="t-row flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-[13px] text-[var(--muted)]">
                        <span className="t-num font-medium text-[var(--action)] shrink-0">
                          Sem. {a.week}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="truncate">{a.course}</span>
                      </div>
                      <h4 className="text-[15px] font-medium text-[var(--ink)] truncate mt-0.5">
                        {a.title}
                      </h4>
                      <p className="text-[13px] text-[var(--muted)] mt-0.5">
                        Vence <span className="t-num">{a.dueDate}</span>
                      </p>
                    </div>

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
                      <Check className="w-4 h-4 text-[var(--ok)]" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => onOpenQuickAdd('university')}
            className="t-btn t-btn-secondary w-full mt-5"
          >
            <Plus className="w-4 h-4" />
            <span>Agregar entrega</span>
          </button>
        </div>

        {/* Card 2: Entrenamiento de hoy */}
        <div className="t-card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 pb-3.5 border-b border-[var(--line)] mb-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Dumbbell className="w-4 h-4 text-[var(--gym)] shrink-0" />
                  <h3 className="text-base font-medium text-[var(--ink)] truncate">
                    Entrenamiento de hoy ({todayDay})
                  </h3>
                </div>
                <p className="text-[13px] text-[var(--muted)] mt-0.5">
                  {todayRoutine ? todayRoutine.tag : 'Día de descanso'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => onNavigateTab('gym')}
                className="t-btn t-btn-ghost px-2.5 text-[13px] shrink-0"
              >
                <span>Ver rutina</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {!todayRoutine || todayRoutine.exercises.length === 0 ? (
              <p className="py-8 text-[14px] text-[var(--muted)]">
                Hoy toca descanso o aún no hay ejercicios cargados.
              </p>
            ) : (
              <div>
                {todayRoutine.exercises.slice(0, 3).map((ex) => (
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
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => onOpenQuickAdd('gym')}
            className="t-btn t-btn-secondary w-full mt-5"
          >
            <Plus className="w-4 h-4" />
            <span>Agregar ejercicio</span>
          </button>
        </div>

        {/* Card 3: Agenda de hoy */}
        <div className="t-card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 pb-3.5 border-b border-[var(--line)] mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <CalendarDays className="w-4 h-4 text-[var(--action)] shrink-0" />
                <h3 className="text-base font-medium text-[var(--ink)] truncate">
                  Agenda de {todayDay}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => onNavigateTab('calendar')}
                className="t-btn t-btn-ghost px-2.5 text-[13px] shrink-0"
              >
                <span>Horario</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {workShift?.enabled && (
              <div className="mb-3 rounded-[10px] border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 flex items-center justify-between gap-2 text-[13px]">
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
                        {isOvernightTimeRange(workShift.startTime, workShift.endTime) ? ' (+1d)' : ''}
                      </>
                    )}
                  </span>
                </span>
                {workShift.restDay && (
                  <span className="t-badge shrink-0">Descanso: {workShift.restDay.slice(0, 3)}</span>
                )}
              </div>
            )}

            {todayAgendaEntries.length === 0 ? (
              <p className="py-8 text-[14px] text-[var(--muted)]">
                No tienes clases ni bloques agendados para hoy.
              </p>
            ) : (
              <div>
                {todayAgendaEntries.map((entry) => {
                  if (entry.kind === 'google') {
                    const ev = entry.event;
                    const isGoogleGym = isStudentOsGymGoogleEvent(ev);
                    return (
                      <div key={`gcal-today-${ev.id}-${ev.dateIso}`} className="t-row">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div
                            className={`t-num text-[13px] font-medium flex flex-wrap items-center gap-1.5 ${
                              isGoogleGym ? 'text-[var(--gym)]' : 'text-[var(--ok)]'
                            }`}
                          >
                            {isGoogleGym ? (
                              <Dumbbell className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                            ) : (
                              <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                            )}
                            <span>
                              {ev.isAllDay ? 'Todo el día' : `${ev.startTime} – ${ev.endTime}`}
                            </span>
                            {isGoogleGym && <span className="t-badge t-badge-gym">Gym</span>}
                            <span className="t-badge t-badge-ok">Google</span>
                          </div>
                          {ev.htmlLink && (
                            <a
                              href={ev.htmlLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={`Abrir en Google Calendar: ${ev.title}`}
                              title="Abrir en Google Calendar"
                              className="text-[var(--muted)] hover:text-[var(--ink)] p-1"
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
                    <div key={seg.segmentId} className="t-row">
                      <div className="t-num text-[13px] font-medium text-[var(--action)] flex flex-wrap items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          {seg.segmentRole === 'overnight_start'
                            ? `${b.startTime} – ${b.endTime} (+1d)`
                            : seg.segmentRole === 'overnight_continuation'
                            ? `00:00 – ${seg.endTime}`
                            : `${seg.startTime} – ${seg.endTime}`}
                        </span>
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
                })}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => onOpenQuickAdd('calendar')}
            className="t-btn t-btn-secondary w-full mt-5"
          >
            <Plus className="w-4 h-4" />
            <span>Agendar bloque</span>
          </button>
        </div>

        {/* Card 4: Hábitos diarios */}
        <DailyHabitsCard
          initialHabits={state.dailyHabits}
          onHabitsChange={onHabitsChange}
        />

        {/* Card 5 (2 Cols on lg): Proyectos en foco (Kanban) */}
        <div className="t-card p-6 lg:col-span-2 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 pb-3.5 border-b border-[var(--line)] mb-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <KanbanSquare className="w-4 h-4 text-[var(--action)] shrink-0" />
                  <h3 className="text-base font-medium text-[var(--ink)] truncate">
                    Proyectos en foco
                  </h3>
                </div>
                <p className="text-[13px] text-[var(--muted)] mt-0.5">
                  Tareas que tienes en curso ahora mismo en tu tablero Kanban
                </p>
              </div>

              <button
                type="button"
                onClick={() => onNavigateTab('kanban')}
                className="t-btn t-btn-ghost px-2.5 text-[13px] shrink-0"
              >
                <span>Ver tablero</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {inProgressKanban.length === 0 ? (
              <p className="py-8 text-[14px] text-[var(--muted)]">
                No tienes tareas en curso ahora mismo. Mueve una tarjeta a &ldquo;En progreso&rdquo; o crea una nueva.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
                {inProgressKanban.map((k) => (
                  <div
                    key={k.id}
                    className="py-4 border-b border-[var(--line)] last:border-b-0 flex flex-col justify-between gap-3"
                  >
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="t-badge">{CATEGORY_LABELS[k.category]}</span>
                        <span className="text-[13px] text-[var(--muted)] t-num">
                          {k.dueDate ? `Vence ${k.dueDate}` : 'Sin fecha límite'}
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
                        <Check className="w-4 h-4 text-[var(--ok)]" />
                        <span>Marcar listo</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Card 6 (Full Width): Aprendizaje de la semana */}
        <div className="t-card p-6 col-span-1 md:col-span-2 lg:col-span-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[var(--line)] mb-5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <BookOpen className="w-4 h-4 text-[var(--action)] shrink-0" />
                <h3 className="text-base sm:text-lg font-medium text-[var(--ink)]">
                  Aprendizaje de la semana <span className="t-num">{currentWeek}</span>
                </h3>
                {isFreeWeek && <span className="t-badge t-badge-ok">Semana libre</span>}
                {currentReflection?.mood && (
                  <span className="t-badge">Estado: {MOOD_LABELS[currentReflection.mood]}</span>
                )}
              </div>
              <p className="text-[14px] text-[var(--muted)] mt-1">
                Resume con tus palabras lo más importante que aprendiste esta semana.
              </p>
            </div>

            <button
              type="button"
              onClick={() => onNavigateTab('learning')}
              className="t-btn t-btn-secondary self-start sm:self-auto shrink-0"
            >
              <span>Abrir aprendizaje</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
            {/* Left Column: Active Recall Summary */}
            <div className="lg:border-r lg:border-[var(--line)] lg:pr-8 flex flex-col justify-between">
              {currentReflection?.learnings ? (
                <div>
                  <p className="text-[13px] font-medium text-[var(--muted)] mb-2">
                    Tu síntesis registrada
                  </p>
                  <p className="text-[15px] text-[var(--ink)] leading-relaxed">
                    {currentReflection.learnings}
                  </p>

                  {currentReflection.keyConcepts && currentReflection.keyConcepts.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-4">
                      {currentReflection.keyConcepts.map((concept, idx) => (
                        <span key={idx} className="t-badge t-badge-accent max-w-full whitespace-normal break-words leading-snug">
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
                    onClick={() => onNavigateTab('learning')}
                    className="t-btn t-btn-primary"
                  >
                    <span>Escribir resumen</span>
                  </button>
                </div>
              )}

              {isFreeWeek && (
                <div className="mt-5 pt-4 border-t border-[var(--line)] flex flex-wrap items-center justify-between gap-3">
                  <span className="text-[13px] font-medium text-[var(--ok)]">
                    Cerraste todas las entregas de la semana <span className="t-num">{currentWeek}</span>.
                  </span>
                  <button
                    type="button"
                    onClick={() => onNavigateTab('gym')}
                    className="t-btn t-btn-ghost px-3 text-[13px]"
                  >
                    <span>Ir al Gym</span>
                    <ArrowRight className="w-3.5 h-3.5" />
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
                  <span className="t-badge t-num">
                    {currentReflection?.resources?.length || 0}
                  </span>
                </div>

                {currentReflection?.resources && currentReflection.resources.length > 0 ? (
                  <div>
                    {currentReflection.resources.slice(0, 3).map((res) =>
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
                              <BookOpen className="w-4 h-4 text-[var(--action)] shrink-0 mt-1" />
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
                          <ExternalLink className="w-4 h-4 text-[var(--muted)] group-hover:text-[var(--action)] shrink-0" />
                        </a>
                      ) : (
                        <div key={res.id} className="t-row flex items-start gap-2.5">
                          {res.type === 'tiktok' ? (
                            <TiktokIcon className="w-4 h-4 text-[var(--ink)] shrink-0 mt-1" />
                          ) : res.type === 'instagram' ? (
                            <InstagramIcon className="w-4 h-4 text-[var(--ink)] shrink-0 mt-1" />
                          ) : (
                            <BookOpen className="w-4 h-4 text-[var(--action)] shrink-0 mt-1" />
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
                <Plus className="w-4 h-4" />
                <span>Guardar recurso</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <BackupModal
        isOpen={isBackupOpen}
        onClose={() => setIsBackupOpen(false)}
        currentState={state}
        onRestoreState={onRestoreState}
      />
    </div>
  );
};
