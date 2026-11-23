import React, { useState, useEffect, useId } from 'react';
import {
  TrendingUp,
  Dumbbell,
  Trophy,
  Plus,
  Minus,
  Sparkles,
  ArrowUpRight,
  Calendar,
} from 'lucide-react';
import type { GymExercise } from '../../types';
import { ModalShell } from '../common/ModalShell';
import { triggerConfetti } from '../../utils/confetti';

export interface QuickWeightModalProps {
  exercise: GymExercise | null;
  isOpen: boolean;
  onClose: () => void;
  onSaveWeight: (newWeight: number, reps: string) => void;
}

export const QuickWeightModal: React.FC<QuickWeightModalProps> = ({
  exercise,
  isOpen,
  onClose,
  onSaveWeight,
}) => {
  const baseId = useId();
  const currentWeight = exercise?.weightKg ?? 60;
  const currentPR = exercise?.personalRecordKg ?? currentWeight;

  const [weight, setWeight] = useState<number>(currentWeight);
  const [reps, setReps] = useState<string>(exercise?.reps ?? '8-10 reps');

  // Sync state whenever modal opens or exercise changes
  useEffect(() => {
    if (exercise) {
      setWeight(exercise.weightKg ?? 60);
      setReps(exercise.reps || '8-10 reps');
    }
  }, [exercise, isOpen]);

  if (!isOpen || !exercise) return null;

  const diffFromCurrent = Number((weight - currentWeight).toFixed(1));
  const isNewPR = weight > currentPR;

  const handleApplyDelta = (delta: number) => {
    setWeight((prev) => Math.max(1, Number((prev + delta).toFixed(1))));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (weight <= 0) return;

    onSaveWeight(weight, reps);
    triggerConfetti();
    onClose();
  };

  // Last 3 sessions history
  const lastHistory = (exercise.history || []).slice(-3).reverse();

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      badge="Sobrecarga Progresiva"
      title={`Cargar peso: ${exercise.name}`}
      subtitle="Registra tu nuevo peso levantado para medir el aumento de fuerza"
      icon={<Dumbbell className="w-5 h-5 text-[var(--action)]" />}
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Main Weight Input & Quick Adjusters */}
        <div className="p-5 rounded-2xl bg-[var(--surface-2)] border border-[var(--line-strong)] space-y-4">
          <div className="flex items-center justify-between">
            <label htmlFor={`${baseId}-weight-input`} className="text-xs font-mono font-medium text-[var(--muted)] uppercase tracking-wider">
              Peso para la sesión de hoy
            </label>
            <span className="text-xs font-mono text-[var(--muted)]">
              Anterior: <strong className="text-[var(--ink)]">{currentWeight} kg</strong>
            </span>
          </div>

          {/* Big number counter with quick minus/plus buttons */}
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => handleApplyDelta(-2.5)}
              className="w-12 h-12 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-2)] text-[var(--ink)] border border-[var(--line)] flex items-center justify-center font-mono text-base font-semibold cursor-pointer active:scale-95 transition-all select-none"
              aria-label="Restar 2.5 kilogramos"
              title="-2.5 kg"
            >
              <Minus className="w-4 h-4" />
            </button>

            <div className="flex-1 relative">
              <input
                id={`${baseId}-weight-input`}
                type="number"
                min={1}
                max={500}
                step={0.5}
                required
                value={weight}
                onChange={(e) => setWeight(Math.max(0, Number(e.target.value)))}
                className="w-full h-14 text-center font-mono text-3xl font-bold bg-[var(--surface)] text-[var(--ink)] border border-[var(--line-strong)] rounded-xl focus:outline-none focus:border-[var(--action)] transition-colors"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 font-mono text-sm font-semibold text-[var(--muted)] pointer-events-none">
                kg
              </span>
            </div>

            <button
              type="button"
              onClick={() => handleApplyDelta(2.5)}
              className="w-12 h-12 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-2)] text-[var(--action)] border border-[var(--line)] flex items-center justify-center font-mono text-base font-semibold cursor-pointer active:scale-95 transition-all select-none"
              aria-label="Sumar 2.5 kilogramos"
              title="+2.5 kg"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Delta Chips */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            {[-5, -1, 1, 2.5, 5].map((delta) => (
              <button
                key={delta}
                type="button"
                onClick={() => handleApplyDelta(delta)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium border cursor-pointer transition-colors active:scale-95 ${
                  delta > 0
                    ? 'bg-[color-mix(in_oklab,var(--action)_10%,transparent)] border-[color-mix(in_oklab,var(--action)_30%,transparent)] text-[var(--action)] hover:bg-[color-mix(in_oklab,var(--action)_20%,transparent)]'
                    : 'bg-[var(--surface)] border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)]'
                }`}
              >
                {delta > 0 ? `+${delta}` : delta} kg
              </button>
            ))}
          </div>

          {/* Dynamic Feedback Banner */}
          <div className="pt-2">
            {isNewPR ? (
              <div className="p-3 rounded-xl bg-[color-mix(in_oklab,var(--gym)_15%,transparent)] border border-[color-mix(in_oklab,var(--gym)_40%,transparent)] flex items-center gap-3">
                <Trophy className="w-5 h-5 text-[var(--gym)] shrink-0" />
                <div>
                  <p className="text-xs font-mono font-semibold text-[var(--gym)] uppercase">
                    ¡Nuevo Récord Personal (PR)!
                  </p>
                  <p className="text-xs text-[var(--ink)]">
                    Superas tu récord anterior ({currentPR} kg) por <strong>+{(weight - currentPR).toFixed(1)} kg</strong>.
                  </p>
                </div>
              </div>
            ) : diffFromCurrent > 0 ? (
              <div className="p-3 rounded-xl bg-[color-mix(in_oklab,var(--ok)_15%,transparent)] border border-[color-mix(in_oklab,var(--ok)_35%,transparent)] flex items-center gap-3">
                <ArrowUpRight className="w-5 h-5 text-[var(--ok)] shrink-0" />
                <div>
                  <p className="text-xs font-mono font-semibold text-[var(--ok)] uppercase">
                    Sobrecarga Progresiva Detectada
                  </p>
                  <p className="text-xs text-[var(--ink)]">
                    Subes <strong>+{diffFromCurrent} kg</strong> respecto a tu peso anterior.
                  </p>
                </div>
              </div>
            ) : diffFromCurrent < 0 ? (
              <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--line)] flex items-center gap-3 text-xs text-[var(--muted)]">
                <TrendingUp className="w-4 h-4 shrink-0 rotate-180" />
                <span>Descarga o ajuste de técnica (-{Math.abs(diffFromCurrent)} kg).</span>
              </div>
            ) : (
              <div className="p-2.5 rounded-xl bg-[var(--surface)] border border-[var(--line)] text-center text-xs text-[var(--muted)]">
                Mantienes la misma carga de {currentWeight} kg.
              </div>
            )}
          </div>
        </div>

        {/* Repetitions Selector */}
        <div className="space-y-2">
          <label htmlFor={`${baseId}-reps-input`} className="text-xs font-mono font-medium text-[var(--muted)] uppercase tracking-wider block">
            Rango de Repeticiones
          </label>
          <div className="flex items-center gap-2">
            <input
              id={`${baseId}-reps-input`}
              type="text"
              required
              value={reps}
              onChange={(e) => setReps(e.target.value)}
              placeholder="ej. 8-10 reps"
              className="flex-1 t-input font-mono text-sm"
            />
            {['8 reps', '8-10 reps', '10-12 reps', '12-15 reps'].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setReps(preset)}
                className={`hidden sm:inline-block px-2.5 py-2 rounded-lg text-xs font-mono border cursor-pointer transition-colors ${
                  reps === preset
                    ? 'bg-[var(--action)] text-[#0a0d14] border-[var(--action)] font-semibold'
                    : 'bg-[var(--surface-2)] text-[var(--muted)] border-[var(--line)] hover:text-[var(--ink)]'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        {/* Recent Progression Log History */}
        {lastHistory.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-[var(--line)]">
            <div className="flex items-center justify-between text-xs font-mono text-[var(--muted)]">
              <span>Historial reciente de sobrecarga</span>
              <span>Récord: {currentPR} kg</span>
            </div>
            <div className="space-y-1.5">
              {lastHistory.map((item, idx) => (
                <div
                  key={`${item.date}-${idx}`}
                  className="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-xs font-mono"
                >
                  <div className="flex items-center gap-2 text-[var(--muted)]">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{item.date}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[var(--ink)]">
                    <span className="text-[var(--muted)]">{item.reps}</span>
                    <strong className="font-semibold text-sm">{item.weightKg} kg</strong>
                    {item.weightKg >= currentPR && (
                      <span className="px-1.5 py-0.5 rounded text-xs font-mono bg-[var(--gym)] text-white font-bold">
                        PR
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="pt-3 border-t border-[var(--line)] flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="t-btn t-btn-ghost"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="t-btn t-btn-primary"
          >
            <Sparkles className="w-4 h-4" />
            <span>Guardar Carga ({weight} kg)</span>
          </button>
        </div>
      </form>
    </ModalShell>
  );
};
