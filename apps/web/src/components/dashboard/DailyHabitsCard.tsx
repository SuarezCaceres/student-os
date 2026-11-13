import React, { useEffect, useId, useState } from 'react';
import {
  Check,
  Droplets,
  Minus,
  Moon,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Timer,
  X,
} from 'lucide-react';
import type { DailyHabits } from '../../types';
import {
  calculateDailyHabitsPercent,
  DEFAULT_DAILY_HABITS,
  normalizeDailyHabitsForDate,
} from '../../utils/academicStats';
import { triggerConfetti } from '../../utils/confetti';
import { getLocalIsoDate } from '../../utils/gymAttendance';

export interface DailyHabitsCardProps {
  initialHabits?: DailyHabits;
  todayDateIso?: string;
  onHabitsChange?: (habits: DailyHabits) => void;
}

export const DailyHabitsCard: React.FC<DailyHabitsCardProps> = ({
  initialHabits,
  todayDateIso,
  onHabitsChange,
}) => {
  const formId = useId();
  const resolvedTodayIso = todayDateIso ?? getLocalIsoDate();

  const [localHabits, setLocalHabits] = useState<DailyHabits>(() => {
    try {
      const raw = localStorage.getItem('student_os_state_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.dailyHabits) {
          return normalizeDailyHabitsForDate(
            parsed.dailyHabits as DailyHabits,
            resolvedTodayIso
          ).habits;
        }
      }
    } catch {
      // fallback to initialHabits or default
    }
    return normalizeDailyHabitsForDate(
      initialHabits ?? DEFAULT_DAILY_HABITS,
      resolvedTodayIso
    ).habits;
  });

  const rawActiveHabits = onHabitsChange && initialHabits ? initialHabits : localHabits;
  const { habits: activeHabits, changed: needsDateRollover } = normalizeDailyHabitsForDate(
    rawActiveHabits,
    resolvedTodayIso
  );

  const [isEditingTargets, setIsEditingTargets] = useState(false);
  const [targetWaterInput, setTargetWaterInput] = useState(
    String(activeHabits.targetWaterMl)
  );
  const [targetSleepInput, setTargetSleepInput] = useState(
    String(activeHabits.targetSleepHours)
  );
  const [targetPomoInput, setTargetPomoInput] = useState(
    String(activeHabits.targetPomodoros)
  );
  const [targetError, setTargetError] = useState<string | null>(null);

  const saveHabits = (updated: DailyHabits) => {
    const stamped: DailyHabits = {
      ...updated,
      lastUpdatedDate: resolvedTodayIso,
    };
    setLocalHabits(stamped);
    if (onHabitsChange) {
      onHabitsChange(stamped);
      return;
    }

    try {
      const raw = localStorage.getItem('student_os_state_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        parsed.dailyHabits = stamped;
        localStorage.setItem('student_os_state_v1', JSON.stringify(parsed));
      }
    } catch {
      // ignore localStorage errors
    }
  };

  useEffect(() => {
    if (!needsDateRollover) return;
    if (onHabitsChange) {
      onHabitsChange(activeHabits);
      return;
    }
    try {
      const raw = localStorage.getItem('student_os_state_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        parsed.dailyHabits = activeHabits;
        localStorage.setItem('student_os_state_v1', JSON.stringify(parsed));
      }
    } catch {
      // ignore localStorage errors
    }
  }, [needsDateRollover, activeHabits, onHabitsChange]);

  const handleOpenTargets = () => {
    if (isEditingTargets) {
      setIsEditingTargets(false);
      setTargetError(null);
      return;
    }
    setTargetWaterInput(String(activeHabits.targetWaterMl));
    setTargetSleepInput(String(activeHabits.targetSleepHours));
    setTargetPomoInput(String(activeHabits.targetPomodoros));
    setTargetError(null);
    setIsEditingTargets(true);
  };

  const handleSaveTargets = (e: React.FormEvent) => {
    e.preventDefault();
    const nextWaterTarget = Math.round(Number(targetWaterInput));
    const nextSleepTarget = Math.round(Number(targetSleepInput) * 2) / 2;
    const nextPomoTarget = Math.round(Number(targetPomoInput));

    if (
      !Number.isFinite(nextWaterTarget) ||
      nextWaterTarget < 500 ||
      nextWaterTarget > 6000
    ) {
      setTargetError('La meta de agua debe estar entre 500 y 6000 ml.');
      return;
    }
    if (
      !Number.isFinite(nextSleepTarget) ||
      nextSleepTarget < 4 ||
      nextSleepTarget > 12
    ) {
      setTargetError('La meta de sueño debe estar entre 4 y 12 horas.');
      return;
    }
    if (!Number.isFinite(nextPomoTarget) || nextPomoTarget < 1 || nextPomoTarget > 16) {
      setTargetError('La meta de bloques debe estar entre 1 y 16.');
      return;
    }

    setTargetError(null);
    saveHabits({
      ...activeHabits,
      targetWaterMl: nextWaterTarget,
      targetSleepHours: nextSleepTarget,
      targetPomodoros: nextPomoTarget,
    });
    setIsEditingTargets(false);
  };

  const addWater = (amount: number) => {
    const nextWater = Math.max(0, activeHabits.waterMl + amount);
    if (
      nextWater >= activeHabits.targetWaterMl &&
      activeHabits.waterMl < activeHabits.targetWaterMl
    ) {
      triggerConfetti();
    }
    saveHabits({ ...activeHabits, waterMl: nextWater });
  };

  const resetWater = () => {
    saveHabits({ ...activeHabits, waterMl: 0 });
  };

  const adjustSleep = (delta: number) => {
    const nextSleep = Math.max(
      0,
      Math.min(14, Math.round((activeHabits.sleepHours + delta) * 10) / 10)
    );
    if (
      nextSleep >= activeHabits.targetSleepHours &&
      activeHabits.sleepHours < activeHabits.targetSleepHours
    ) {
      triggerConfetti();
    }
    saveHabits({ ...activeHabits, sleepHours: nextSleep });
  };

  const adjustPomodoro = (delta: number) => {
    const nextPomo = Math.max(0, activeHabits.pomodorosDone + delta);
    if (
      nextPomo >= activeHabits.targetPomodoros &&
      activeHabits.pomodorosDone < activeHabits.targetPomodoros
    ) {
      triggerConfetti();
    }
    saveHabits({ ...activeHabits, pomodorosDone: nextPomo });
  };

  const waterPercent = Math.min(
    100,
    Math.round((activeHabits.waterMl / Math.max(1, activeHabits.targetWaterMl)) * 100)
  );
  const sleepPercent = Math.min(
    100,
    Math.round((activeHabits.sleepHours / Math.max(0.5, activeHabits.targetSleepHours)) * 100)
  );
  const pomodoroPercent = Math.min(
    100,
    Math.round((activeHabits.pomodorosDone / Math.max(1, activeHabits.targetPomodoros)) * 100)
  );

  const totalScore = calculateDailyHabitsPercent(activeHabits);

  return (
    <div className="t-card p-6 flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between gap-2 pb-3.5 border-b border-[var(--line)] mb-2">
          <div className="min-w-0">
            <h3 className="text-base font-medium text-[var(--ink)]">Hábitos diarios</h3>
            <p className="text-[13px] text-[var(--muted)] mt-0.5">
              Agua, descanso y enfoque · reinicio diario
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleOpenTargets}
              aria-expanded={isEditingTargets}
              aria-label="Editar metas de hábitos diarios"
              className="t-btn t-btn-ghost px-2.5 text-[13px]"
              title="Editar metas diarias"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Metas</span>
            </button>

            <span
              className={`t-badge t-num shrink-0 ${
                totalScore >= 100 ? 't-badge-ok' : 't-badge-accent'
              }`}
            >
              {totalScore}% hoy
            </span>
          </div>
        </div>

        {isEditingTargets && (
          <form
            onSubmit={handleSaveTargets}
            className="py-3.5 border-b border-[var(--line)] space-y-3"
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label htmlFor={`${formId}-water`} className="t-label text-[13px]">
                  Agua (ml)
                </label>
                <input
                  id={`${formId}-water`}
                  type="number"
                  min={500}
                  max={6000}
                  step={250}
                  value={targetWaterInput}
                  onChange={(e) => setTargetWaterInput(e.target.value)}
                  className="t-input t-num"
                />
              </div>

              <div>
                <label htmlFor={`${formId}-sleep`} className="t-label text-[13px]">
                  Sueño (h)
                </label>
                <input
                  id={`${formId}-sleep`}
                  type="number"
                  min={4}
                  max={12}
                  step={0.5}
                  value={targetSleepInput}
                  onChange={(e) => setTargetSleepInput(e.target.value)}
                  className="t-input t-num"
                />
              </div>

              <div>
                <label htmlFor={`${formId}-pomo`} className="t-label text-[13px]">
                  Bloques
                </label>
                <input
                  id={`${formId}-pomo`}
                  type="number"
                  min={1}
                  max={16}
                  step={1}
                  value={targetPomoInput}
                  onChange={(e) => setTargetPomoInput(e.target.value)}
                  className="t-input t-num"
                />
              </div>
            </div>

            {targetError && (
              <p role="alert" className="text-[13px] text-[var(--danger)]">
                {targetError}
              </p>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsEditingTargets(false);
                  setTargetError(null);
                }}
                className="t-btn t-btn-secondary px-3 text-[13px]"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Cancelar</span>
              </button>
              <button type="submit" className="t-btn t-btn-primary px-3.5 text-[13px]">
                <Check className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Guardar metas</span>
              </button>
            </div>
          </form>
        )}

        <div>
          {/* Row 1: Agua */}
          <div className="t-row">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Droplets className="w-4 h-4 text-[var(--action)] shrink-0" aria-hidden="true" />
                <span className="text-[15px] font-medium text-[var(--ink)]">Agua</span>
              </div>
              <span className="t-num text-[13px] text-[var(--muted)]">
                {(activeHabits.waterMl / 1000).toFixed(2)} /{' '}
                {(activeHabits.targetWaterMl / 1000).toFixed(1)} L
              </span>
            </div>

            <div className="w-full h-1.5 rounded-full bg-[var(--surface-2)] overflow-hidden my-2.5">
              <div
                className="h-full rounded-full transition-[width] duration-300"
                style={{
                  width: `${waterPercent}%`,
                  backgroundColor: waterPercent >= 100 ? 'var(--ok)' : 'var(--action)',
                }}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => addWater(250)}
                className="t-btn t-btn-secondary px-3 text-[13px] t-num"
              >
                +250 ml
              </button>
              <button
                type="button"
                onClick={() => addWater(500)}
                className="t-btn t-btn-secondary px-3 text-[13px] t-num"
              >
                +500 ml
              </button>
              <button
                type="button"
                onClick={() => addWater(-250)}
                disabled={activeHabits.waterMl === 0}
                className="t-btn t-btn-ghost t-btn-icon"
                aria-label="Restar 250 ml de agua"
                title="Restar 250 ml"
              >
                <Minus className="w-4 h-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={resetWater}
                disabled={activeHabits.waterMl === 0}
                className="t-btn t-btn-ghost t-btn-icon ml-auto"
                aria-label="Reiniciar agua a cero"
                title="Reiniciar agua"
              >
                <RotateCcw className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Row 2: Sueño */}
          <div className="t-row">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Moon className="w-4 h-4 text-[var(--action)] shrink-0" aria-hidden="true" />
                <div>
                  <span className="text-[15px] font-medium text-[var(--ink)]">Sueño</span>
                  <p className="text-[13px] text-[var(--muted)] t-num">
                    Meta {activeHabits.targetSleepHours} h
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => adjustSleep(-0.5)}
                  disabled={activeHabits.sleepHours <= 0}
                  className="t-btn t-btn-secondary t-btn-icon"
                  aria-label="Restar media hora de sueño"
                  title="Restar 0.5 h"
                >
                  <Minus className="w-4 h-4" aria-hidden="true" />
                </button>
                <span className="t-num text-[14px] font-medium text-[var(--ink)] min-w-[52px] text-center">
                  {activeHabits.sleepHours} h
                </span>
                <button
                  type="button"
                  onClick={() => adjustSleep(0.5)}
                  className="t-btn t-btn-secondary t-btn-icon"
                  aria-label="Sumar media hora de sueño"
                  title="Sumar 0.5 h"
                >
                  <Plus className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="w-full h-1.5 rounded-full bg-[var(--surface-2)] overflow-hidden mt-2.5">
              <div
                className="h-full rounded-full transition-[width] duration-300"
                style={{
                  width: `${sleepPercent}%`,
                  backgroundColor: sleepPercent >= 100 ? 'var(--ok)' : 'var(--action)',
                }}
              />
            </div>
          </div>

          {/* Row 3: Bloques de enfoque */}
          <div className="t-row">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Timer className="w-4 h-4 text-[var(--action)] shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <span className="text-[15px] font-medium text-[var(--ink)] block truncate">
                    Bloques de enfoque
                  </span>
                  <p className="text-[13px] text-[var(--muted)] t-num">
                    {activeHabits.pomodorosDone * 25} min hoy
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => adjustPomodoro(-1)}
                  disabled={activeHabits.pomodorosDone === 0}
                  className="t-btn t-btn-secondary t-btn-icon"
                  aria-label="Restar bloque de enfoque"
                  title="Restar bloque"
                >
                  <Minus className="w-4 h-4" aria-hidden="true" />
                </button>
                <span className="t-num text-[14px] font-medium text-[var(--ink)] min-w-[46px] text-center">
                  {activeHabits.pomodorosDone}/{activeHabits.targetPomodoros}
                </span>
                <button
                  type="button"
                  onClick={() => adjustPomodoro(1)}
                  className="t-btn t-btn-secondary t-btn-icon"
                  aria-label="Sumar bloque de enfoque"
                  title="Sumar bloque (25 min)"
                >
                  <Plus className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="w-full h-1.5 rounded-full bg-[var(--surface-2)] overflow-hidden mt-2.5">
              <div
                className="h-full rounded-full transition-[width] duration-300"
                style={{
                  width: `${pomodoroPercent}%`,
                  backgroundColor: pomodoroPercent >= 100 ? 'var(--ok)' : 'var(--action)',
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
