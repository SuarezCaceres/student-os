import React from 'react';
import { Flame, CheckCircle2, Dumbbell, ArrowUpRight } from 'lucide-react';
import type { AppState } from '../../types';

interface StatsHeroProps {
  state: AppState;
  onOpenQuickAddWithTab?: (tab: 'university' | 'gym' | 'kanban' | 'calendar') => void;
}

export const StatsHero: React.FC<StatsHeroProps> = ({ state, onOpenQuickAddWithTab }) => {
  // Calculate completed assignments
  const totalUni = state.universityAssignments.length;
  const doneUni = state.universityAssignments.filter((a) => a.status === 'entregado').length;
  const currentWeekTasks = state.universityAssignments.filter(
    (a) => a.week === state.currentAcademicWeek && a.status !== 'entregado'
  );

  // Calculate gym sets done today (let's check current day of week)
  const daysMap = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const todayName = daysMap[new Date().getDay()];
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
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-950 via-slate-900 to-[#0e1424] text-white p-6 sm:p-8 border border-indigo-900/50 shadow-xl mb-8">
      {/* Background ambient lighting */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        {/* Left: Saludo & Status */}
        <div className="max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-400/20 text-indigo-300 text-xs font-semibold mb-3">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>Ciclo Académico • {state.career}</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white mb-2">
            ¡Hola, {state.studentName}! 🚀
          </h1>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Estás en la <span className="text-indigo-400 font-bold">Semana {state.currentAcademicWeek}</span> de clases. 
            {currentWeekTasks.length > 0 ? (
              <span> Tienes <strong className="text-amber-400">{currentWeekTasks.length} entregas pendientes</strong> para esta semana.</span>
            ) : (
              <span> ¡Estás al día con tus entregas de esta semana!</span>
            )}
          </p>

          {/* Quick Action Badges */}
          <div className="flex flex-wrap items-center gap-2 mt-4">
            <button
              onClick={() => onOpenQuickAddWithTab?.('university')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/30 text-indigo-200 text-xs font-semibold transition-all cursor-pointer min-h-[36px]"
            >
              + Tarea Uni
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onOpenQuickAddWithTab?.('gym')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-600/30 hover:bg-orange-600/50 border border-orange-500/30 text-orange-200 text-xs font-semibold transition-all cursor-pointer min-h-[36px]"
            >
              + Ejercicio Gym
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onOpenQuickAddWithTab?.('kanban')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/30 text-emerald-200 text-xs font-semibold transition-all cursor-pointer min-h-[36px]"
            >
              + Trabajo Kanban
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right: Bento Metrics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full lg:w-auto">
          
          {/* Metric 1: Racha 🔥 */}
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-400">Racha Diaria</span>
              <div className="w-8 h-8 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center flame-pulse">
                <Flame className="w-5 h-5 fill-orange-500 text-orange-400" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-black text-white">{state.streak} días</div>
              <p className="text-[11px] text-orange-300 font-medium">¡Enfocado y constante!</p>
            </div>
          </div>

          {/* Metric 2: Gym Hoy */}
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-400">Gym {todayName}</span>
              <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                <Dumbbell className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-black text-white">
                {totalSets > 0 ? `${completedSets}/${totalSets}` : '0 sets'}
              </div>
              <p className="text-[11px] text-cyan-300 font-medium truncate">
                {todayRoutine ? todayRoutine.name.split(':')[0] : 'Descanso'}
              </p>
            </div>
          </div>

          {/* Metric 3: Entregas Realizadas */}
          <div className="col-span-2 sm:col-span-1 p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-400">Entregas Uni</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-black text-white">{doneUni}/{totalUni}</div>
              <p className="text-[11px] text-emerald-300 font-medium">
                {totalUni > 0 ? `${Math.round((doneUni / totalUni) * 100)}% entregado` : 'Al día'}
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
