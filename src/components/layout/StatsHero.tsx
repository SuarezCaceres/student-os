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
    <section data-enter className="t-card hero-enter p-6 sm:p-8 mb-8">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 lg:gap-8">
        {/* Left Column: Greeting, Hard Fact & Primary Actions */}
        <div className="max-w-xl min-w-0">
          <div className="mb-3.5">
            <span className="t-badge t-badge-accent max-w-full">
              <span className="truncate">{state.career}</span>
              <span aria-hidden="true">·</span>
              <span className="t-num shrink-0">Semana {state.currentAcademicWeek}</span>
            </span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-medium tracking-[-0.03em] text-[var(--ink)] leading-tight">
            {timeGreeting}, {state.studentName}
          </h1>

          <p className="text-[15px] sm:text-base text-[var(--muted)] mt-2.5 leading-relaxed">
            {currentWeekTasks.length > 0 ? (
              <>
                Tienes{' '}
                <span className="t-num font-medium text-[var(--ink)]">
                  {currentWeekTasks.length}{' '}
                  {currentWeekTasks.length === 1 ? 'entrega pendiente' : 'entregas pendientes'}
                </span>{' '}
                en la semana <span className="t-num">{state.currentAcademicWeek}</span>.
              </>
            ) : (
              <>
                Cero entregas pendientes en la semana{' '}
                <span className="t-num">{state.currentAcademicWeek}</span>. Estás al día con la universidad.
              </>
            )}
          </p>

          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 mt-6">
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

        {/* Right Column: 3 Clean Metric Blocks */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full lg:w-auto lg:min-w-[430px]">
          <div className="bg-[var(--surface-2)] border border-[var(--line)] rounded-[14px] p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-medium text-[var(--muted)]">Racha activa</span>
              <Flame className="w-4 h-4 text-[var(--gym)] shrink-0" />
            </div>
            <div className="mt-3">
              <div className="t-num text-2xl font-semibold text-[var(--ink)] tracking-[-0.02em]">
                {state.streak} días
              </div>
              <p className="text-[13px] text-[var(--muted)] mt-0.5">Constancia diaria</p>
            </div>
          </div>

          <div className="bg-[var(--surface-2)] border border-[var(--line)] rounded-[14px] p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-medium text-[var(--muted)]">Gym · {todayName}</span>
              <Dumbbell className="w-4 h-4 text-[var(--action)] shrink-0" />
            </div>
            <div className="mt-3">
              <div className="t-num text-2xl font-semibold text-[var(--ink)] tracking-[-0.02em]">
                {completedSets}/{totalSets}
              </div>
              <p className="text-[13px] text-[var(--muted)] mt-0.5 truncate">
                {todayRoutine ? todayRoutine.tag : 'Día de descanso'}
              </p>
            </div>
          </div>

          <div className="bg-[var(--surface-2)] border border-[var(--line)] rounded-[14px] p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-medium text-[var(--muted)]">Entregas listas</span>
              <CheckCircle2 className="w-4 h-4 text-[var(--ok)] shrink-0" />
            </div>
            <div className="mt-3">
              <div className="t-num text-2xl font-semibold text-[var(--ink)] tracking-[-0.02em]">
                {doneUni}/{totalUni}
              </div>
              <p className="text-[13px] text-[var(--muted)] mt-0.5 t-num">
                {totalUni > 0 ? `${Math.round((doneUni / totalUni) * 100)}% del ciclo` : 'Al día'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
