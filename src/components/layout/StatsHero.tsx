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
        {/* Left Column: Direct Greeting without banned kickers/eyebrows */}
        <div className="max-w-xl min-w-0">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-[-0.03em] text-[var(--ink)] leading-tight">
            {timeGreeting}, {state.studentName}
          </h1>

          <p className="text-[15px] sm:text-base text-[var(--muted)] mt-2 leading-relaxed">
            {state.career} · <span className="t-num font-medium text-[var(--ink)]">Semana {state.currentAcademicWeek}</span>.
            {' '}
            {currentWeekTasks.length > 0 ? (
              <>
                Tienes{' '}
                <span className="t-num font-medium text-[var(--ink)]">
                  {currentWeekTasks.length}{' '}
                  {currentWeekTasks.length === 1 ? 'entrega pendiente' : 'entregas pendientes'}
                </span>{' '}
                esta semana.
              </>
            ) : (
              <>
                Todas las entregas al día para esta semana lectiva.
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

        {/* Right Column: Unified Telemetry Strip (Hairline-divided, zero nested box-in-box) */}
        <div className="lg:border-l lg:border-[var(--line)] lg:pl-8 w-full lg:w-auto">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
            {/* Metric 1: Racha */}
            <div className="flex flex-col justify-between">
              <div className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
                <Flame className="w-3.5 h-3.5 text-[var(--gym)] shrink-0" />
                <span>Racha activa</span>
              </div>
              <div className="mt-2">
                <div className="t-num text-2xl font-semibold text-[var(--ink)] tracking-[-0.02em]">
                  {state.streak} <span className="text-sm font-normal text-[var(--muted)]">días</span>
                </div>
                <p className="text-xs text-[var(--muted)] mt-0.5">Constancia diaria</p>
              </div>
            </div>

            {/* Metric 2: Gym */}
            <div className="flex flex-col justify-between sm:border-l sm:border-[var(--line)] sm:pl-6">
              <div className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
                <Dumbbell className="w-3.5 h-3.5 text-[var(--action)] shrink-0" />
                <span className="truncate">Gym · {todayName}</span>
              </div>
              <div className="mt-2">
                <div className="t-num text-2xl font-semibold text-[var(--ink)] tracking-[-0.02em]">
                  {completedSets}/{totalSets} <span className="text-sm font-normal text-[var(--muted)]">series</span>
                </div>
                <p className="text-xs text-[var(--muted)] mt-0.5 truncate">
                  {todayRoutine ? todayRoutine.tag : 'Día de descanso'}
                </p>
              </div>
            </div>

            {/* Metric 3: Entregas */}
            <div className="flex flex-col justify-between sm:border-l sm:border-[var(--line)] sm:pl-6">
              <div className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
                <CheckCircle2 className="w-3.5 h-3.5 text-[var(--ok)] shrink-0" />
                <span>Entregas ciclo</span>
              </div>
              <div className="mt-2">
                <div className="t-num text-2xl font-semibold text-[var(--ink)] tracking-[-0.02em]">
                  {doneUni}/{totalUni} <span className="text-sm font-normal text-[var(--muted)]">listas</span>
                </div>
                <p className="text-xs text-[var(--muted)] mt-0.5 t-num">
                  {totalUni > 0 ? `${Math.round((doneUni / totalUni) * 100)}% completado` : 'Al día'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
