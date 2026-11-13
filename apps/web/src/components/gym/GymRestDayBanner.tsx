import React from 'react';
import { Moon, Activity, Droplets, CalendarCheck, Plus } from 'lucide-react';
import type { DayOfWeek } from '../../types';
import type { FitnessGoal } from './gymProfileTypes';

export interface GymRestDayBannerProps {
  selectedDay: DayOfWeek;
  nextTrainingDay?: DayOfWeek;
  goal?: FitnessGoal;
  onSelectDay: (day: DayOfWeek) => void;
  onAddExtraExercise: () => void;
}

const getGoalSubtitle = (goal?: FitnessGoal): string => {
  switch (goal) {
    case 'hipertrofia':
      return 'El tejido muscular se repara y crece durante el descanso y la nutrición, no durante el entrenamiento.';
    case 'fuerza':
      return 'La regeneración del sistema nervioso central es indispensable para levantar más peso en tu siguiente sesión.';
    case 'perdida_grasa':
      return 'La recuperación activa mantiene tu metabolismo despierto sin elevar el cortisol ni generar fatiga acumulada.';
    case 'salud':
      return 'Equilibra el esfuerzo con una pausa consciente para renovar tu energía física y mental para la semana.';
    default:
      return 'El descanso programado previene lesiones, disipa la fatiga y optimiza tus adaptaciones fisiológicas.';
  }
};

export const GymRestDayBanner: React.FC<GymRestDayBannerProps> = ({
  selectedDay,
  nextTrainingDay,
  goal,
  onSelectDay,
  onAddExtraExercise,
}) => {
  const goalSubtitle = getGoalSubtitle(goal);

  return (
    <article
      aria-label="Aviso de día de descanso y recuperación activa"
      className="t-card p-5 sm:p-6 mb-6 overflow-hidden"
    >
      {/* Cabecera del banner */}
      <div className="flex items-start gap-3.5">
        <div className="w-10 h-10 rounded-[var(--r-md)] bg-[var(--surface-2)] border border-[var(--line)] flex items-center justify-center shrink-0">
          <Moon className="w-5 h-5 text-[var(--action)]" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h3 className="text-base sm:text-lg font-semibold text-[var(--ink)]">
              Día de recuperación activa ({selectedDay})
            </h3>
            <span className="t-badge">Día de recarga</span>
          </div>
          <p className="text-[13px] sm:text-sm text-[var(--muted)] leading-relaxed">
            {goalSubtitle}
          </p>
        </div>
      </div>

      {/* 3 recomendaciones prácticas en filas limpias */}
      <div className="divide-y divide-[var(--line)] my-5 border-y border-[var(--line)]">
        {/* 1. Movilidad articular */}
        <div className="t-row py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Activity className="w-4 h-4 text-[var(--gym)] shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <span className="text-sm font-medium text-[var(--ink)] block">
                Movilidad articular y estiramiento dinámico
              </span>
              <span className="text-[13px] text-[var(--muted)] block">
                Libera tensión en caderas, hombros y tobillos para maximizar el rango articular
              </span>
            </div>
          </div>
          <span className="t-badge shrink-0">
            <span className="t-num">10</span> min
          </span>
        </div>

        {/* 2. Hidratación */}
        <div className="t-row py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Droplets className="w-4 h-4 text-[var(--action)] shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <span className="text-sm font-medium text-[var(--ink)] block">
                Meta de hidratación y electrolitos
              </span>
              <span className="text-[13px] text-[var(--muted)] block">
                Facilita el transporte de micronutrientes y disipa la rigidez muscular
              </span>
            </div>
          </div>
          <span className="t-badge shrink-0">
            <span className="t-num">2.5</span> L
          </span>
        </div>

        {/* 3. Descanso nocturno */}
        <div className="t-row py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Moon className="w-4 h-4 text-[var(--muted)] shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <span className="text-sm font-medium text-[var(--ink)] block">
                Descanso nocturno profundo
              </span>
              <span className="text-[13px] text-[var(--muted)] block">
                Pico de secreción de hormona de crecimiento y regeneración neuromuscular
              </span>
            </div>
          </div>
          <span className="t-badge shrink-0">
            <span className="t-num">7 - 8</span> h
          </span>
        </div>
      </div>

      {/* Acciones y enlace al próximo entreno */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex flex-wrap items-center gap-3">
          {nextTrainingDay && (
            <button
              type="button"
              onClick={() => onSelectDay(nextTrainingDay)}
              className="t-btn t-btn-primary min-h-[44px] cursor-pointer"
            >
              <CalendarCheck className="w-4 h-4" aria-hidden="true" />
              <span>Ir al próximo entreno ({nextTrainingDay})</span>
            </button>
          )}
          <button
            type="button"
            onClick={onAddExtraExercise}
            className="t-btn t-btn-secondary min-h-[44px] cursor-pointer"
          >
            <Plus className="w-4 h-4 text-[var(--muted)]" aria-hidden="true" />
            <span>Agregar sesión extra hoy</span>
          </button>
        </div>

        {nextTrainingDay && (
          <span className="text-[13px] text-[var(--muted)]">
            Próxima sesión:{' '}
            <span className="font-medium text-[var(--ink)]">{nextTrainingDay}</span>
          </span>
        )}
      </div>
    </article>
  );
};
