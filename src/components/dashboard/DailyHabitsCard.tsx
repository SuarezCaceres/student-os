import React, { useState } from 'react';
import { 
  Droplets, 
  Moon, 
  Plus, 
  Minus, 
  RotateCcw, 
  Sparkles,
  Trophy,
  Coffee
} from 'lucide-react';
import type { DailyHabits } from '../../types';
import { triggerConfetti } from '../../utils/confetti';

interface DailyHabitsCardProps {
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
  const [habits, setHabits] = useState<DailyHabits>(() => {
    // Check localStorage first
    try {
      const raw = localStorage.getItem('student_os_state_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.dailyHabits) {
          return parsed.dailyHabits;
        }
      }
    } catch {
      // fallback
    }
    return initialHabits || DEFAULT_HABITS;
  });

  const saveHabits = (updated: DailyHabits) => {
    setHabits(updated);
    if (onHabitsChange) {
      onHabitsChange(updated);
    }

    try {
      const raw = localStorage.getItem('student_os_state_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        parsed.dailyHabits = updated;
        localStorage.setItem('student_os_state_v1', JSON.stringify(parsed));
      }
    } catch {
      // ignore
    }
  };

  // Water Actions
  const addWater = (amount: number) => {
    const nextWater = Math.max(0, habits.waterMl + amount);
    if (nextWater >= habits.targetWaterMl && habits.waterMl < habits.targetWaterMl) {
      triggerConfetti();
    }
    saveHabits({ ...habits, waterMl: nextWater });
  };

  const resetWater = () => {
    saveHabits({ ...habits, waterMl: 0 });
  };

  // Sleep Actions
  const adjustSleep = (delta: number) => {
    const nextSleep = Math.max(0, Math.min(14, Math.round((habits.sleepHours + delta) * 10) / 10));
    if (nextSleep >= habits.targetSleepHours && habits.sleepHours < habits.targetSleepHours) {
      triggerConfetti();
    }
    saveHabits({ ...habits, sleepHours: nextSleep });
  };

  // Pomodoro Actions
  const adjustPomodoro = (delta: number) => {
    const nextPomo = Math.max(0, habits.pomodorosDone + delta);
    if (nextPomo >= habits.targetPomodoros && habits.pomodorosDone < habits.targetPomodoros) {
      triggerConfetti();
    }
    saveHabits({ ...habits, pomodorosDone: nextPomo });
  };

  const waterPercent = Math.min(100, Math.round((habits.waterMl / habits.targetWaterMl) * 100));
  const sleepPercent = Math.min(100, Math.round((habits.sleepHours / habits.targetSleepHours) * 100));
  const pomodoroPercent = Math.min(100, Math.round((habits.pomodorosDone / habits.targetPomodoros) * 100));

  const totalScore = Math.round((waterPercent + sleepPercent + pomodoroPercent) / 3);

  return (
    <div className="rounded-3xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-6 shadow-sm flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                Hábitos & Salud Diaria
              </h3>
              <span className="text-[10px] text-slate-400 font-semibold">
                Hidratación, descanso y enfoque
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 font-black text-xs">
            <Trophy className="w-3.5 h-3.5" />
            <span>{totalScore}% Cumplido</span>
          </div>
        </div>

        {/* 3 Habits List */}
        <div className="space-y-4">
          {/* Habit 1: Hidratación / Agua */}
          <div className="p-3.5 rounded-2xl bg-sky-50/40 dark:bg-sky-950/20 border border-sky-100 dark:border-sky-900/50 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-sky-500 text-white flex items-center justify-center shadow-sm shadow-sky-500/30">
                  <Droplets className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    Agua (Meta: {(habits.targetWaterMl / 1000).toFixed(1)}L)
                  </h4>
                  <span className="text-[10px] font-semibold text-sky-600 dark:text-sky-400">
                    {(habits.waterMl / 1000).toFixed(2)}L bebidos ({waterPercent}%)
                  </span>
                </div>
              </div>

              {/* Quick Add Buttons */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => addWater(250)}
                  className="px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-sky-200 dark:border-sky-800 hover:border-sky-400 text-sky-600 dark:text-sky-400 font-bold text-[10px] transition-all cursor-pointer active:scale-95"
                  title="Añadir un vaso (250ml)"
                >
                  +250ml
                </button>
                <button
                  type="button"
                  onClick={() => addWater(500)}
                  className="px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-sky-200 dark:border-sky-800 hover:border-sky-400 text-sky-600 dark:text-sky-400 font-bold text-[10px] transition-all cursor-pointer active:scale-95"
                  title="Añadir una botella (500ml)"
                >
                  +500ml
                </button>
                <button
                  type="button"
                  onClick={() => addWater(-250)}
                  disabled={habits.waterMl === 0}
                  className="p-1 rounded-lg text-slate-400 hover:text-rose-500 disabled:opacity-30 cursor-pointer"
                  title="Restar 250ml"
                >
                  <Minus className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-sky-400 to-cyan-500 rounded-full transition-all duration-300"
                style={{ width: `${waterPercent}%` }}
              />
            </div>
          </div>

          {/* Habit 2: Sueño */}
          <div className="p-3.5 rounded-2xl bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-500 text-white flex items-center justify-center shadow-sm shadow-indigo-500/30">
                  <Moon className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    Sueño (Meta: {habits.targetSleepHours}h)
                  </h4>
                  <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400">
                    {habits.sleepHours}h registradas ({sleepPercent}%)
                  </span>
                </div>
              </div>

              {/* Adjust Sleep Buttons */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => adjustSleep(-0.5)}
                  className="w-7 h-7 rounded-lg bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:border-indigo-400 transition-all cursor-pointer"
                  title="-0.5 horas"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="font-mono text-xs font-black min-w-[32px] text-center text-slate-900 dark:text-white">
                  {habits.sleepHours}h
                </span>
                <button
                  type="button"
                  onClick={() => adjustSleep(0.5)}
                  className="w-7 h-7 rounded-lg bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:border-indigo-400 transition-all cursor-pointer"
                  title="+0.5 horas"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-300"
                style={{ width: `${sleepPercent}%` }}
              />
            </div>
          </div>

          {/* Habit 3: Pomodoros / Enfoque */}
          <div className="p-3.5 rounded-2xl bg-orange-50/40 dark:bg-orange-950/20 border border-orange-100 dark:border-orange-900/50 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-orange-500 text-white flex items-center justify-center shadow-sm shadow-orange-500/30">
                  <Coffee className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    Pomodoros (Meta: {habits.targetPomodoros})
                  </h4>
                  <span className="text-[10px] font-semibold text-orange-600 dark:text-orange-400">
                    {habits.pomodorosDone} sesiones ({habits.pomodorosDone * 25} mins estudio)
                  </span>
                </div>
              </div>

              {/* Adjust Pomodoro Buttons */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => adjustPomodoro(-1)}
                  disabled={habits.pomodorosDone === 0}
                  className="w-7 h-7 rounded-lg bg-white dark:bg-slate-800 border border-orange-200 dark:border-orange-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:border-orange-400 transition-all cursor-pointer disabled:opacity-30"
                  title="-1 Pomodoro"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="font-mono text-xs font-black min-w-[28px] text-center text-slate-900 dark:text-white">
                  {habits.pomodorosDone}
                </span>
                <button
                  type="button"
                  onClick={() => adjustPomodoro(1)}
                  className="w-7 h-7 rounded-lg bg-white dark:bg-slate-800 border border-orange-200 dark:border-orange-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:border-orange-400 transition-all cursor-pointer"
                  title="+1 Pomodoro (25m de foco)"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full transition-all duration-300"
                style={{ width: `${pomodoroPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Footer Reset Action */}
      <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 mt-4 flex items-center justify-between text-[11px] text-slate-400">
        <span>Rastreo diario 100% offline</span>
        <button
          type="button"
          onClick={resetWater}
          className="hover:text-slate-600 dark:hover:text-slate-300 flex items-center gap-1 cursor-pointer"
          title="Reiniciar contador de agua a cero para nuevo día"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Reiniciar agua</span>
        </button>
      </div>
    </div>
  );
};
