import React from 'react';
import { Dumbbell, Scale, Edit3, Bell } from 'lucide-react';
import type { DayOfWeek } from '../../types';
import {
  DEFAULT_GYM_REMINDER_MINUTES,
  formatReminderSummary,
} from '../../utils/reminderPresets';
import {
  type UserGymProfile,
  type BmiCategory,
  getBmiCategoryLabel,
  getFitnessGoalLabel,
  getGymTypeLabel,
  getExperienceLabel,
} from './gymProfileTypes';

export interface GymProfileCardProps {
  profile: UserGymProfile;
  onOpenOnboarding: () => void;
  onOpenWeightCheckIn: () => void;
}

const WEEKDAYS: { key: DayOfWeek; label: string }[] = [
  { key: 'Lunes', label: 'Lun' },
  { key: 'Martes', label: 'Mar' },
  { key: 'Miércoles', label: 'Mié' },
  { key: 'Jueves', label: 'Jue' },
  { key: 'Viernes', label: 'Vie' },
  { key: 'Sábado', label: 'Sáb' },
  { key: 'Domingo', label: 'Dom' },
];

const calculateMarkerPosition = (bmi: number): number => {
  if (bmi <= 15) return 2;
  if (bmi < 18.5) {
    return 2 + ((bmi - 15) / (18.5 - 15)) * 20;
  }
  if (bmi < 25) {
    return 22 + ((bmi - 18.5) / (25 - 18.5)) * 38;
  }
  if (bmi < 30) {
    return 60 + ((bmi - 25) / (30 - 25)) * 22;
  }
  if (bmi <= 40) {
    return 82 + ((bmi - 30) / (40 - 30)) * 16;
  }
  return 98;
};

const renderBmiCategoryBadge = (category: BmiCategory) => {
  const label = getBmiCategoryLabel(category);
  switch (category) {
    case 'normal':
      return <span className="t-badge t-badge-ok">{label}</span>;
    case 'bajo_peso':
    case 'sobrepeso':
      return <span className="t-badge t-badge-warn">{label}</span>;
    case 'obesidad':
      return <span className="t-badge t-badge-danger">{label}</span>;
  }
};

export const GymProfileCard: React.FC<GymProfileCardProps> = ({
  profile,
  onOpenOnboarding,
  onOpenWeightCheckIn,
}) => {
  const gymLabel = getGymTypeLabel(profile.gymType, profile.customGymName);
  const goalLabel = getFitnessGoalLabel(profile.goal);
  const experienceLabel = getExperienceLabel(profile.experience);
  const markerPos = calculateMarkerPosition(profile.bmi);

  return (
    <section
      aria-label="Resumen de perfil físico"
      className="t-card mb-6 divide-y lg:divide-y-0 lg:divide-x divide-[var(--line)] flex flex-col lg:flex-row overflow-hidden"
    >
      {/* 1. Gimnasio y Objetivo */}
      <div className="flex flex-col justify-between p-4 sm:p-5 gap-3.5 flex-1 min-w-0">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Dumbbell className="w-4 h-4 text-[var(--gym)]" aria-hidden="true" />
            <span className="text-[13px] text-[var(--muted)]">Centro y objetivo</span>
          </div>
          <h3 className="text-base font-semibold text-[var(--ink)] truncate" title={gymLabel}>
            {gymLabel}
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="t-badge t-badge-gym">{goalLabel}</span>
          <span className="t-badge">{experienceLabel}</span>
        </div>
      </div>

      {/* 2. Frecuencia Semanal */}
      <div className="flex flex-col justify-between p-4 sm:p-5 gap-3.5 flex-1 min-w-0">
        <div>
          <span className="text-[13px] text-[var(--muted)] block">Frecuencia semanal</span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="t-num font-semibold text-lg text-[var(--ink)]">
              {profile.trainingDaysCount}
            </span>
            <span className="text-[13px] text-[var(--muted)]">días por semana</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5" aria-label="Días de entrenamiento activos">
          {WEEKDAYS.map((day) => {
            const isActive = profile.selectedDays.includes(day.key);
            return (
              <span
                key={day.key}
                className={`inline-flex items-center justify-center text-[13px] h-7 px-2.5 rounded-[var(--r-sm)] select-none transition-colors ${
                  isActive
                    ? 'bg-[var(--surface-2)] text-[var(--ink)] font-semibold border border-[var(--line-strong)]'
                    : 'text-[var(--muted)] opacity-35 border border-transparent'
                }`}
                title={`${day.key}: ${isActive ? 'Entrenamiento programado' : 'Día de descanso'}`}
              >
                {day.label}
              </span>
            );
          })}
        </div>

        <div className="flex items-center gap-1.5 text-[13px] text-[var(--muted)] pt-0.5">
          <Bell className="w-3.5 h-3.5 text-[var(--action)] shrink-0" aria-hidden="true" />
          <span>
            Aviso:{' '}
            <strong className="font-medium text-[var(--ink)]">
              {formatReminderSummary(profile.reminderMinutesBefore ?? DEFAULT_GYM_REMINDER_MINUTES)}
            </strong>
          </span>
        </div>
      </div>

      {/* 3. Antropometría e Indicador Visual IMC (OMS) */}
      <div className="flex flex-col justify-between p-4 sm:p-5 gap-3.5 flex-[1.3] min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="text-[13px] text-[var(--muted)] block">Antropometría</span>
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 mt-1">
              <span className="text-sm text-[var(--ink)]">
                <span className="t-num font-semibold text-base">{profile.heightCm}</span> cm
              </span>
              <span className="text-[var(--muted)] text-[13px]">·</span>
              <span className="text-sm text-[var(--ink)]">
                <span className="t-num font-semibold text-base">{profile.weightKg}</span> kg
              </span>
              {profile.targetWeightKg !== undefined && (
                <>
                  <span className="text-[var(--muted)] text-[13px]">·</span>
                  <span className="text-[13px] text-[var(--muted)]">
                    Meta:{' '}
                    <span className="t-num font-medium text-[var(--ink)]">
                      {profile.targetWeightKg} kg
                    </span>
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="text-[13px] text-[var(--muted)] block">Índice IMC</span>
            <div className="flex items-center justify-end gap-1.5 mt-1">
              <span className="t-num font-semibold text-base text-[var(--ink)]">
                {profile.bmi.toFixed(1)}
              </span>
              {renderBmiCategoryBadge(profile.bmiCategory)}
            </div>
          </div>
        </div>

        {/* Medidor horizontal continuo de rango IMC */}
        <div className="w-full pt-1">
          <div className="relative w-full">
            {/* Marcador posicionado dinámicamente */}
            <div
              className="absolute -top-1.5 transition-[left] duration-300 ease-out -translate-x-1/2 pointer-events-none flex flex-col items-center z-10"
              style={{ left: `${markerPos}%` }}
              aria-hidden="true"
            >
              <div className="w-2.5 h-2.5 rotate-45 bg-[var(--ink)] shadow-xs rounded-[1px]" />
            </div>

            {/* Barra de 4 tramos continuos OMS */}
            <div className="h-2.5 w-full rounded-full overflow-hidden flex bg-[var(--surface-2)] border border-[var(--line)]">
              <div
                className="h-full bg-[var(--warn)] opacity-45 border-r border-[var(--surface)]"
                style={{ width: '22%' }}
                title="Bajo peso (< 18.5)"
              />
              <div
                className="h-full bg-[var(--ok)] opacity-65 border-r border-[var(--surface)]"
                style={{ width: '38%' }}
                title="Peso normal (18.5 - 24.9)"
              />
              <div
                className="h-full bg-[var(--warn)] opacity-55 border-r border-[var(--surface)]"
                style={{ width: '22%' }}
                title="Sobrepeso (25.0 - 29.9)"
              />
              <div
                className="h-full bg-[var(--danger)] opacity-55"
                style={{ width: '18%' }}
                title="Obesidad (≥ 30.0)"
              />
            </div>
          </div>

          <div className="flex justify-between items-center text-[13px] text-[var(--muted)] t-num pt-1 px-0.5">
            <span>&lt; 18.5</span>
            <span>18.5 - 24.9</span>
            <span>25.0 - 29.9</span>
            <span>≥ 30.0</span>
          </div>
        </div>
      </div>

      {/* 4. Acciones Rápidas */}
      <div className="flex flex-col justify-center p-4 sm:p-5 gap-2.5 lg:w-[200px] shrink-0">
        <button
          type="button"
          onClick={onOpenWeightCheckIn}
          className="t-btn t-btn-secondary w-full min-h-[44px] cursor-pointer"
        >
          <Scale className="w-4 h-4 text-[var(--muted)]" aria-hidden="true" />
          <span>Registrar peso</span>
        </button>
        <button
          type="button"
          onClick={onOpenOnboarding}
          className="t-btn t-btn-ghost w-full min-h-[44px] cursor-pointer"
        >
          <Edit3 className="w-4 h-4 text-[var(--muted)]" aria-hidden="true" />
          <span>Editar plan</span>
        </button>
      </div>
    </section>
  );
};
