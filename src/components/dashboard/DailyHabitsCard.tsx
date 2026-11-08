import React, { useState } from 'react';
import { Droplets, Moon, Plus, Minus, RotateCcw, Timer } from 'lucide-react';
import type { DailyHabits } from '../../types';
import { triggerConfetti } from '../../utils/confetti';

export interface DailyHabitsCardProps {
  initialHabits?: DailyHabits;
  onHabitsChange?: (habits: DailyHabits) => void;
}

const DEFAULT_HABITS: DailyHabits = {
  waterMl: 1750,
  targetWaterMl: 2500,
  sleepHours: 7.5,
  targetSleepHours: 8,
  pomodorosDone: 4,
  targetPomodoros: 6,
};

export const DailyHabitsCard: React.FC<DailyHabitsCardProps> = ({
  initialHabits,
  onHabitsChange,
}) => {
  const [localHabits, setLocalHabits] = useState<DailyHabits>(() => {
    try {
      const raw = localStorage.getItem('student_os_state_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.dailyHabits) {
          return parsed.dailyHabits as DailyHabits;
        }
      }
    } catch {
      // fallback to initialHabits or default
    }
    return initialHabits || DEFAULT_HABITS;
  });

  const activeHabits = onHabitsChange && initialHabits ? initialHabits : localHabits;

  const saveHabits = (updated: DailyHabits) => {
    setLocalHabits(updated);
    if (onHabitsChange) {
      onHabitsChange(updated);
      return;
    }

    try {
      const raw = localStorage.getItem('student_os_state_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        parsed.dailyHabits = updated;
        localStorage.setItem('student_os_state_v1', JSON.stringify(parsed));
      }
    } catch {
      // ignore localStorage errors
    }
  };

  const addWater = (amount: number) => {
    const nextWater = Math.max(0, activeHabits.waterMl + amount);
    if (nextWater >= activeHabits.targetWaterMl && activeHabits.waterMl < activeHabits.targetWaterMl) {
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
    Math.round((activeHabits.waterMl / activeHabits.targetWaterMl) * 100)
  );
  const sleepPercent = Math.min(
    100,
    Math.round((activeHabits.sleepHours / activeHabits.targetSleepHours) * 100)
  );
  const pomodoroPercent = Math.min(
    100,
    Math.round((activeHabits.pomodorosDone / activeHabits.targetPomodoros) * 100)
  );

  const totalScore = Math.round((waterPercent + sleepPercent + pomodoroPercent) / 3);

  return (
    <div className="t-card p-6 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between gap-2 pb-3.5 border-b border-[var(--line)] mb-2">
          <div>
            <h3 className="text-base font-medium text-[var(--ink)]">Hábitos diarios</h3>
            <p className="text-[13px] text-[var(--muted)] mt-0.5">
              Agua, descanso y enfoque de hoy
            </p>
          </div>

          <span
            className={`t-badge t-num shrink-0 ${
              totalScore >= 100 ? 't-badge-ok' : 't-badge-accent'
            }`}
          >
            {totalScore}% hoy
          </span>
        </div>

        <div>
          {/* Row 1: Agua */}
          <div className="t-row">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Droplets className="w-4 h-4 text-[var(--action)] shrink-0" />
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
                <Minus className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={resetWater}
                disabled={activeHabits.waterMl === 0}
                className="t-btn t-btn-ghost t-btn-icon ml-auto"
                aria-label="Reiniciar agua a cero"
                title="Reiniciar agua"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Row 2: Sueño */}
          <div className="t-row">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Moon className="w-4 h-4 text-[var(--action)] shrink-0" />
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
                  <Minus className="w-4 h-4" />
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
                  <Plus className="w-4 h-4" />
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
                <Timer className="w-4 h-4 text-[var(--action)] shrink-0" />
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
                  <Minus className="w-4 h-4" />
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
                  <Plus className="w-4 h-4" />
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
