import React, { useState } from 'react';
import { Flame, CheckCircle2, Dumbbell, Plus } from 'lucide-react';
import type { AppState, DayOfWeek } from '../../types';

export interface StatsHeroProps {
  state: AppState;
  onOpenQuickAddWithTab?: (tab: 'university' | 'gym' | 'kanban' | 'calendar' | 'learning') => void;
}

export const StatsHero: React.FC<StatsHeroProps> = ({ state, onOpenQuickAddWithTab }) => {
  const [{ timeGreeting, todayName }] = useState<{ timeGreeting: string; todayName: DayOfWeek }>(() => {
    const now = new Date();
    const hour = now.getHours();
    const greeting = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
    const daysMap: DayOfWeek[] = [
      'Domingo',
      'Lunes',
      'Martes',
      'Miércoles',
      'Jueves',
      'Viernes',
      'Sábado',
    ];
    return {
      timeGreeting: greeting,
      todayName: daysMap[now.getDay()],
    };
  });

  const totalUni = state.universityAssignments.length;
  const doneUni = state.universityAssignments.filter((a) => a.status === 'entregado').length;
  const currentWeekTasks = state.universityAssignments.filter(
    (a) => a.week === state.currentAcademicWeek && a.status !== 'entregado'
  );

  const todayRoutine = state.gymRoutines.find((r) => r.dayOfWeek === todayName);

  let totalSets = 0;
  let completedSets = 0;
  if (todayRoutine) {
    todayRoutine.exercises.forEach((ex) => {
      totalSets += ex.sets;
      completedSets += ex.completedSets.filter(Boolean).length;
    });
  }

  return (
    <section data-enter className="t-card hero-enter p-5 sm:p-6 mb-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 lg:gap-8">
        {/* Left Column: Direct Greeting without banned kickers/eyebrows */}
        <div className="max-w-xl min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-[-0.028em] text-[var(--ink)] leading-tight">
              {timeGreeting}, {state.studentName}
            </h1>
            <span className="t-badge t-badge-accent t-num">
              Semana {state.currentAcademicWeek}
            </span>
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
                esta semana lectiva.
              </>
            ) : (
              <>Todas las entregas al día para esta semana lectiva.</>
            )}
          </p>

          <div className="flex flex-wrap items-center gap-2.5 mt-4">
            <button
              type="button"
              onClick={() => onOpenQuickAddWithTab?.('university')}
              className="t-btn t-btn-primary"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>Agregar entrega</span>
            </button>

            <button
              type="button"
              onClick={() => onOpenQuickAddWithTab?.('gym')}
              className="t-btn t-btn-secondary"
            >
              <Dumbbell className="w-4 h-4 shrink-0" />
              <span>Registrar ejercicio</span>
            </button>
          </div>
        </div>

        {/* Right Column: Unified Telemetry Strip (Hairline-divided, zero nested box-in-box) */}
        <div className="lg:border-l lg:border-[var(--line)] lg:pl-8 w-full lg:w-auto pt-4 lg:pt-0 border-t lg:border-t-0 border-[var(--line)]">
          <div className="grid grid-cols-3 gap-3 sm:gap-6">
            {/* Metric 1: Racha */}
            <div className="flex flex-col justify-between">
              <div className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
                <Flame className="w-3.5 h-3.5 text-[var(--gym)] shrink-0" />
                <span className="truncate">Racha</span>
              </div>
              <div className="mt-1.5">
                <div className="t-num text-xl sm:text-2xl font-semibold text-[var(--ink)] tracking-[-0.02em]">
                  {state.streak} <span className="text-xs sm:text-sm font-normal text-[var(--muted)]">días</span>
                </div>
                <p className="text-xs text-[var(--muted)] mt-0.5 truncate">Constancia</p>
              </div>
            </div>

            {/* Metric 2: Gym */}
            <div className="flex flex-col justify-between border-l border-[var(--line)] pl-3 sm:pl-6">
              <div className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
                <Dumbbell className="w-3.5 h-3.5 text-[var(--action)] shrink-0" />
                <span className="truncate">Gym ({todayName})</span>
              </div>
              <div className="mt-1.5">
                <div className="t-num text-xl sm:text-2xl font-semibold text-[var(--ink)] tracking-[-0.02em]">
                  {completedSets}/{totalSets}
                </div>
                <p className="text-xs text-[var(--muted)] mt-0.5 truncate">
                  {todayRoutine ? todayRoutine.tag : 'Descanso'}
                </p>
              </div>
            </div>

            {/* Metric 3: Entregas */}
            <div className="flex flex-col justify-between border-l border-[var(--line)] pl-3 sm:pl-6">
              <div className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
                <CheckCircle2 className="w-3.5 h-3.5 text-[var(--ok)] shrink-0" />
                <span className="truncate">Ciclo</span>
              </div>
              <div className="mt-1.5">
                <div className="t-num text-xl sm:text-2xl font-semibold text-[var(--ink)] tracking-[-0.02em]">
                  {doneUni}/{totalUni}
                </div>
                <p className="text-xs text-[var(--muted)] mt-0.5 t-num truncate">
                  {totalUni > 0 ? `${Math.round((doneUni / totalUni) * 100)}% avance` : 'Al día'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
