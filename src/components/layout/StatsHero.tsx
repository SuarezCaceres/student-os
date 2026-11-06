import React from 'react';
import { Flame, CheckCircle2, Dumbbell, ArrowUpRight, Sparkles } from 'lucide-react';
import type { AppState } from '../../types';

interface StatsHeroProps {
  state: AppState;
  onOpenQuickAddWithTab?: (tab: 'university' | 'gym' | 'kanban' | 'calendar') => void;
}

export const StatsHero: React.FC<StatsHeroProps> = ({ state, onOpenQuickAddWithTab }) => {
  // Time-aware greeting
  const currentHour = new Date().getHours();
  const timeGreeting = currentHour < 12 ? 'Buenos días' : currentHour < 19 ? 'Buenas tardes' : 'Buenas noches';

  // Calculate completed assignments
  const totalUni = state.universityAssignments.length;
  const doneUni = state.universityAssignments.filter((a) => a.status === 'entregado').length;
  const currentWeekTasks = state.universityAssignments.filter(
    (a) => a.week === state.currentAcademicWeek && a.status !== 'entregado'
  );

  // Calculate gym sets done today
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
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0c1222] via-[#090d18] to-[#060810] text-white p-6 sm:p-8 border border-white/[0.08] shadow-2xl mb-8">
      {/* Background ambient lighting & holographic logo watermark */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -right-10 -bottom-10 w-72 h-72 opacity-[0.06] pointer-events-none select-none overflow-hidden rounded-full">
        <img src="/logo.png" alt="" className="w-full h-full object-cover grayscale" />
      </div>

      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        {/* Left: Saludo & Status */}
        <div className="max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold mb-3 backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-mono text-[11px] tracking-wide uppercase">Ingeniería & Fitness • {state.career}</span>
          </div>

          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white">
              {timeGreeting}, {state.studentName}
            </h1>
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-400/20 text-indigo-400">
              <Sparkles className="w-4 h-4" />
            </span>
          </div>

          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Semana <span className="text-indigo-400 font-extrabold">{state.currentAcademicWeek}</span> del ciclo. 
            {currentWeekTasks.length > 0 ? (
              <span> Tienes <strong className="text-amber-400 font-bold">{currentWeekTasks.length} {currentWeekTasks.length === 1 ? 'entrega pendiente' : 'entregas pendientes'}</strong> esta semana.</span>
            ) : (
              <span> ¡Estás al día con tus entregas académicas de esta semana!</span>
            )}
          </p>

          {/* Quick Action Badges */}
          <div className="flex flex-wrap items-center gap-2 mt-5">
            <button
              onClick={() => onOpenQuickAddWithTab?.('university')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600/25 hover:bg-indigo-600/40 border border-indigo-500/30 text-indigo-200 text-xs font-bold transition-all cursor-pointer min-h-[36px] shadow-sm hover:scale-[1.02]"
            >
              + Tarea Uni
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onOpenQuickAddWithTab?.('gym')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-orange-600/25 hover:bg-orange-600/40 border border-orange-500/30 text-orange-200 text-xs font-bold transition-all cursor-pointer min-h-[36px] shadow-sm hover:scale-[1.02]"
            >
              + Ejercicio Gym
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onOpenQuickAddWithTab?.('kanban')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600/25 hover:bg-emerald-600/40 border border-emerald-500/30 text-emerald-200 text-xs font-bold transition-all cursor-pointer min-h-[36px] shadow-sm hover:scale-[1.02]"
            >
              + Trabajo Kanban
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right: Bento Metrics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 w-full lg:w-auto">
          
          {/* Metric 1: Racha 🔥 */}
          <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-xl flex flex-col justify-between hover:border-orange-500/40 transition-colors shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Racha</span>
              <div className="w-8 h-8 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center flame-pulse">
                <Flame className="w-4 h-4 fill-orange-500 text-orange-400" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-black text-white tracking-tight">{state.streak} días</div>
              <p className="text-[11px] text-orange-400 font-semibold">¡Disciplina activa!</p>
            </div>
          </div>

          {/* Metric 2: Gym Hoy */}
          <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-xl flex flex-col justify-between hover:border-cyan-500/40 transition-colors shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Gym {todayName}</span>
              <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                <Dumbbell className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-black text-white tracking-tight">
                {totalSets > 0 ? `${completedSets}/${totalSets}` : '0 sets'}
              </div>
              <p className="text-[11px] text-cyan-300 font-semibold truncate">
                {todayRoutine ? todayRoutine.name.split(':')[0] : 'Descanso'}
              </p>
            </div>
          </div>

          {/* Metric 3: Entregas Realizadas */}
          <div className="col-span-2 sm:col-span-1 p-4 rounded-2xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-xl flex flex-col justify-between hover:border-emerald-500/40 transition-colors shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Entregas Uni</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-black text-white tracking-tight">{doneUni}/{totalUni}</div>
              <p className="text-[11px] text-emerald-300 font-semibold">
                {totalUni > 0 ? `${Math.round((doneUni / totalUni) * 100)}% entregado` : 'Al día'}
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
