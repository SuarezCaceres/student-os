import React from 'react';
import {
  Check,
  Plus,
  Trash2,
  Trophy,
  TrendingUp,
  Play,
  ArrowUpRight,
  Video,
  Dumbbell,
} from 'lucide-react';
import type { GymExercise } from '../../types';
import { getExerciseMedia } from '../../data/exerciseMediaCatalog';

export interface ExerciseCardProps {
  exercise: GymExercise;
  routineId: string;
  onToggleSet: (routineId: string, exerciseId: string, setIndex: number, currentlyDone: boolean) => void;
  onOpenVideo: (exercise: GymExercise) => void;
  onOpenWeightLog: (exercise: GymExercise) => void;
  onOpenProgressModal: (exerciseId: string) => void;
  onDelete: (routineId: string, exerciseId: string) => void;
}

export const ExerciseCard: React.FC<ExerciseCardProps> = ({
  exercise,
  routineId,
  onToggleSet,
  onOpenVideo,
  onOpenWeightLog,
  onOpenProgressModal,
  onDelete,
}) => {
  const media = getExerciseMedia(exercise);

  const allSetsCompleted =
    exercise.sets > 0 &&
    exercise.completedSets.slice(0, exercise.sets).filter(Boolean).length === exercise.sets;

  // Progressive overload calculation vs previous session entry
  const previousEntry =
    exercise.history && exercise.history.length > 1
      ? exercise.history[exercise.history.length - 2]
      : null;
  const deltaKg =
    exercise.weightKg !== undefined && previousEntry
      ? Number((exercise.weightKg - previousEntry.weightKg).toFixed(1))
      : 0;

  const handleKeyDownOnThumb = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpenVideo(exercise);
    }
  };

  return (
    <article
      className="t-card p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 group/card hover:border-[var(--line-strong)] transition-all select-none"
      aria-label={`Ejercicio ${exercise.name}`}
    >
      {/* Left: Illustrated Thumbnail + Exercise Identity */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 min-w-0 flex-1">
        {/* Interactive Thumbnail: Person exercising -> click triggers video popup */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => onOpenVideo(exercise)}
          onKeyDown={handleKeyDownOnThumb}
          aria-label={`Ver video explicativo y técnica de ${exercise.name}`}
          title="¡Haz clic para ver el video explicativo y técnica de este ejercicio!"
          className="relative w-full sm:w-36 md:w-40 lg:w-48 h-32 sm:h-24 md:h-24 rounded-xl overflow-hidden shrink-0 border border-[var(--line)] bg-[#07090e] cursor-pointer group/thumb shadow-sm focus-visible:outline-2 focus-visible:outline-[var(--action)] focus-visible:outline-offset-2 transition-transform duration-200 active:scale-[0.98]"
        >
          <img
            src={media.posterUrl}
            alt={`Demostración técnica de ${exercise.name}`}
            className="w-full h-full object-cover transition-transform duration-300 group-hover/thumb:scale-105"
            loading="lazy"
          />

          {/* Vignette gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent pointer-events-none" />

          {/* Central Play Badge on Hover */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/25 group-hover/thumb:bg-black/50 transition-colors pointer-events-none">
            <div className="w-10 h-10 rounded-full bg-[var(--action)] text-[#0a0d14] flex items-center justify-center shadow-lg group-hover/thumb:scale-110 transition-transform">
              <Play className="w-4 h-4 fill-current ml-0.5" />
            </div>
          </div>

          {/* Bottom Badge Tag: "Ver video" */}
          <span className="absolute bottom-1.5 left-2 px-2 py-0.5 rounded-md text-xs font-mono font-medium bg-[#0a0f1d]/90 text-white border border-[var(--line)] backdrop-blur-xs flex items-center gap-1 shadow-xs pointer-events-none">
            <Video className="w-3 h-3 text-[var(--action)]" />
            <span>Ver técnica</span>
          </span>
        </div>

        {/* Text & Badges Details */}
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-mono font-medium text-[var(--muted)] uppercase tracking-wider">
              {media.categoryTag}
            </span>

            {allSetsCompleted && (
              <span className="t-badge t-badge-ok">
                <Check className="w-3.5 h-3.5" />
                <span>Completado</span>
              </span>
            )}

            {exercise.personalRecordKg !== undefined && (
              <span className="t-badge t-badge-gym t-num">
                <Trophy className="w-3.5 h-3.5" />
                <span>PR {exercise.personalRecordKg} kg</span>
              </span>
            )}

            {deltaKg > 0 && (
              <span className="t-badge t-badge-ok t-num">
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>+{deltaKg} kg vs previa</span>
              </span>
            )}
          </div>

          <h4 className="text-base sm:text-lg font-medium text-[var(--ink)] leading-snug">
            {exercise.name}
          </h4>

          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-[var(--muted)]">
            <span className="t-num font-medium text-[var(--ink)]">
              {exercise.weightKg !== undefined
                ? `${exercise.weightKg} kg · ${exercise.reps}`
                : `${exercise.sets} ${exercise.sets === 1 ? 'serie' : 'series'} · ${exercise.reps}`}
            </span>
            {exercise.weightKg !== undefined && (
              <span className="t-num text-xs text-[var(--muted)]">
                · {exercise.sets} {exercise.sets === 1 ? 'serie' : 'series'}
              </span>
            )}
            {exercise.notes && (
              <span className="text-xs text-[var(--muted)] italic">
                · {exercise.notes}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Right: Tactile Series S1..S4 + Action Controls */}
      <div className="flex flex-wrap items-center justify-between sm:justify-start md:justify-end gap-2.5 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-[var(--line)]">
        {/* Set Bubbles S1..S4 */}
        <div
          className="flex items-center gap-2 flex-wrap"
          role="group"
          aria-label={`Series de ${exercise.name}`}
        >
          {Array.from({ length: exercise.sets }).map((_, setIdx) => {
            const isDone = Boolean(exercise.completedSets[setIdx]);

            return (
              <button
                key={setIdx}
                type="button"
                aria-pressed={isDone}
                aria-label={`Serie ${setIdx + 1} de ${exercise.name}: ${
                  isDone ? 'completada' : 'pendiente'
                }`}
                onClick={() =>
                  onToggleSet(
                    routineId,
                    exercise.id,
                    setIdx,
                    isDone
                  )
                }
                className={`min-w-[48px] min-h-[48px] rounded-xl t-num text-sm font-medium inline-flex flex-col items-center justify-center gap-0.5 cursor-pointer select-none border transition-all active:scale-95 focus-visible:outline-2 focus-visible:outline-[var(--action)] focus-visible:outline-offset-2 ${
                  isDone
                    ? 'bg-[var(--ok)] text-[#0a0d14] border-[var(--ok)]'
                    : 'bg-[var(--surface-2)] text-[var(--ink)] border-[var(--line-strong)] hover:border-[var(--action)]'
                }`}
              >
                <span>S{setIdx + 1}</span>
                {isDone && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
              </button>
            );
          })}
        </div>

        {/* Action Buttons: Cargar peso, 1RM, Eliminar */}
        <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
          <button
            type="button"
            onClick={() => onOpenWeightLog(exercise)}
            className="t-btn t-btn-primary !min-h-[44px] !px-3 !text-xs"
            title="Subir peso levantado para este ejercicio (sobrecarga progresiva)"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Cargar peso</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenProgressModal(exercise.id)}
            className="t-btn t-btn-secondary !min-h-[44px] !px-3 !text-xs"
            title="Ver récord personal, calculadora 1RM e historial"
          >
            <TrendingUp className="w-3.5 h-3.5 text-[var(--action)]" />
            <span>1RM</span>
          </button>

          <button
            type="button"
            onClick={() => onDelete(routineId, exercise.id)}
            className="t-btn t-btn-ghost t-btn-icon hover:!text-[var(--danger)]"
            aria-label={`Eliminar ${exercise.name}`}
            title="Eliminar ejercicio"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </article>
  );
};
