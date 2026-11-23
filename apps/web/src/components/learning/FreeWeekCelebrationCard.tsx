import React from 'react';
import { ArrowRight, CheckCircle2, Dumbbell, KanbanSquare } from 'lucide-react';

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
    <section className="t-card p-6 sm:p-7">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="max-w-2xl space-y-2.5">
          <span className="t-badge t-badge-ok t-num">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Semana {week} al día</span>
          </span>

          <h3 className="text-xl sm:text-2xl font-semibold tracking-[-0.025em] text-[var(--ink)] leading-snug">
            Semana libre de entregas
          </h3>

          <p className="text-sm sm:text-[15px] text-[var(--muted)] leading-relaxed">
            No tienes tareas ni exámenes pendientes en esta semana. Aprovecha el respiro para descansar bien, entrenar con calma o adelantar tus proyectos personales.
          </p>
        </div>

        {(onNavigateGym || onNavigateKanban) && (
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {onNavigateGym && (
              <button
                type="button"
                onClick={onNavigateGym}
                className="t-btn t-btn-primary w-full sm:w-auto"
              >
                <Dumbbell className="w-4 h-4" />
                <span>Ir a entrenar</span>
              </button>
            )}

            {onNavigateKanban && (
              <button
                type="button"
                onClick={onNavigateKanban}
                className="t-btn t-btn-secondary w-full sm:w-auto"
              >
                <KanbanSquare className="w-4 h-4" />
                <span>Ver proyectos Kanban</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
