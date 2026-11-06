import React from 'react';
import { Palmtree, Sparkles, Dumbbell, KanbanSquare, ArrowRight } from 'lucide-react';
import { YoutubeIcon } from '../common/YoutubeIcon';

interface FreeWeekCelebrationCardProps {
  week: number;
  onNavigateGym?: () => void;
  onNavigateKanban?: () => void;
}

export const FreeWeekCelebrationCard: React.FC<FreeWeekCelebrationCardProps> = ({
  week,
  onNavigateGym,
  onNavigateKanban,
}) => {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-950/70 via-slate-900 to-[#081216] border border-emerald-500/30 p-6 sm:p-8 shadow-xl text-white">
      {/* Ambient glow */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-10 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-xs font-bold mb-3">
            <Palmtree className="w-3.5 h-3.5 text-emerald-400" />
            <span className="uppercase tracking-wider">Semana {week} • Sin Tareas Pendientes</span>
          </div>

          <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-white mb-2 flex items-center gap-2">
            ¡Semana Despejada! 🌴✨
          </h3>
          <p className="text-slate-300 text-sm leading-relaxed mb-4">
            No tienes ninguna entrega académica pendiente registrada para esta semana. 
            ¡Es el momento ideal para descansar, entrenar sin prisa o avanzar proyectos personales por tu cuenta!
          </p>

          <div className="flex flex-wrap items-center gap-2.5">
            {onNavigateGym && (
              <button
                type="button"
                onClick={onNavigateGym}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-orange-600/30 hover:bg-orange-600/50 border border-orange-500/30 text-orange-200 text-xs font-bold transition-all cursor-pointer min-h-[38px]"
              >
                <Dumbbell className="w-4 h-4" />
                <span>Entrenar Gym</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {onNavigateKanban && (
              <button
                type="button"
                onClick={onNavigateKanban}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/30 text-indigo-200 text-xs font-bold transition-all cursor-pointer min-h-[38px]"
              >
                <KanbanSquare className="w-4 h-4" />
                <span>Ver Proyectos Kanban</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 w-full md:w-auto">
          <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-md">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-2">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="text-sm font-bold text-white">0 Entregas</div>
            <div className="text-[11px] text-emerald-300">Cero estrés esta semana</div>
          </div>

          <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-md">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center mb-2">
              <YoutubeIcon className="w-4 h-4" />
            </div>
            <div className="text-sm font-bold text-white">Autoaprendizaje</div>
            <div className="text-[11px] text-cyan-300">Guarda videos & lecturas</div>
          </div>
        </div>
      </div>
    </div>
  );
};
