import React, { useState, useId } from 'react';
import {
  Trophy,
  Calculator,
  TrendingUp,
  Calendar,
  Plus,
  Award,
  Dumbbell,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react';
import type { GymExercise, ExerciseHistoryEntry } from '../../types';
import { triggerConfetti } from '../../utils/confetti';
import { ModalShell } from '../common/ModalShell';

export interface ExerciseProgressModalProps {
  exercise: GymExercise | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateExercise?: (updated: GymExercise) => void;
}

const INTENSITY_ZONES = [
  { pct: 95, reps: '2 reps' },
  { pct: 90, reps: '3-4 reps' },
  { pct: 85, reps: '5-6 reps' },
  { pct: 80, reps: '7-8 reps' },
  { pct: 75, reps: '9-10 reps' },
  { pct: 70, reps: '11-12 reps' },
];

// Epley formula: 1RM = Weight * (1 + Reps / 30)
function calculateEpley1RM(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return Math.round(weight);
  return Math.round(weight * (1 + reps / 30));
}

export const ExerciseProgressModal: React.FC<ExerciseProgressModalProps> = ({
  exercise,
  isOpen,
  onClose,
  onUpdateExercise,
}) => {
  const baseId = useId();
  const initialWeight = exercise?.weightKg || 60;
  const initialReps = parseInt(exercise?.reps.match(/\d+/)?.[0] || '8', 10);
  const currentPR =
    exercise?.personalRecordKg ||
    (exercise?.weightKg ? Math.round(exercise.weightKg * 1.1) : 80);

  const [calcWeight, setCalcWeight] = useState<number>(initialWeight);
  const [calcReps, setCalcReps] = useState<number>(initialReps);

  const [editingPR, setEditingPR] = useState(false);
  const [prInput, setPrInput] = useState<number>(currentPR);

  const [showAddHistory, setShowAddHistory] = useState(false);
  const [newHistWeight, setNewHistWeight] = useState<number>(initialWeight);
  const [newHistReps, setNewHistReps] = useState<string>(`${initialReps} reps`);

  if (!isOpen || !exercise) return null;

  const estimated1RM = calculateEpley1RM(calcWeight, calcReps);

  const historyEntries: ExerciseHistoryEntry[] =
    exercise.history && exercise.history.length > 0
      ? exercise.history
      : [
          {
            date: '2026-10-15',
            weightKg: Math.round(initialWeight * 0.9),
            reps: '8 reps',
          },
          {
            date: '2026-10-22',
            weightKg: Math.round(initialWeight * 0.95),
            reps: '8 reps',
          },
          {
            date: '2026-10-29',
            weightKg: initialWeight,
            reps: exercise.reps,
          },
        ];

  const latestEntry = historyEntries[historyEntries.length - 1];
  const previousEntry = historyEntries.length > 1 ? historyEntries[historyEntries.length - 2] : null;
  const progressDelta = previousEntry ? Number((latestEntry.weightKg - previousEntry.weightKg).toFixed(1)) : 0;

  const handleOpenEditPR = () => {
    setPrInput(currentPR);
    setEditingPR(true);
  };

  const handleSavePR = (e: React.FormEvent) => {
    e.preventDefault();
    if (onUpdateExercise && prInput > 0) {
      onUpdateExercise({
        ...exercise,
        personalRecordKg: Number(prInput),
      });
      triggerConfetti();
    }
    setEditingPR(false);
  };

  const handleToggleAddHistory = () => {
    if (!showAddHistory) {
      setNewHistWeight(exercise.weightKg || initialWeight);
      setNewHistReps(`${initialReps} reps`);
    }
    setShowAddHistory((prev) => !prev);
  };

  const handleAddHistoryEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHistWeight || !newHistReps.trim()) return;

    const weightValue = Number(newHistWeight);
    const newEntry: ExerciseHistoryEntry = {
      date: new Date().toISOString().split('T')[0],
      weightKg: weightValue,
      reps: newHistReps.trim(),
    };

    const updatedHistory = [...(exercise.history || historyEntries), newEntry];
    const isNewPR = weightValue > currentPR;

    if (onUpdateExercise) {
      onUpdateExercise({
        ...exercise,
        weightKg: weightValue,
        history: updatedHistory,
        personalRecordKg: isNewPR ? weightValue : currentPR,
      });
      triggerConfetti();
    }

    setShowAddHistory(false);
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      badge={`${exercise.sets} series · ${exercise.reps}`}
      title={exercise.name}
      subtitle="Tu récord personal, estimación de fuerza máxima (1RM) e historial de pesos"
      icon={<Dumbbell className="w-5 h-5" />}
      maxWidth="2xl"
    >
      <div className="space-y-6">
        {/* Top Summary: 3 clean panels */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          {/* Panel 1: Personal Record (PR) */}
          <div className="bg-[var(--surface-2)] rounded-[14px] p-4 border border-[var(--line)] flex flex-col justify-between gap-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[14px] font-medium text-[var(--muted)]">
                <Trophy className="w-4 h-4 text-[var(--gym)] shrink-0" />
                <span>Récord personal (PR)</span>
              </div>
              {!editingPR && (
                <button
                  type="button"
                  onClick={handleOpenEditPR}
                  className="t-btn t-btn-ghost !px-2.5 !py-1 !text-xs -my-1"
                >
                  Editar
                </button>
              )}
            </div>

            {editingPR ? (
              <form onSubmit={handleSavePR} className="space-y-2.5">
                <label htmlFor={`${baseId}-pr`} className="sr-only">
                  Récord personal en kilogramos
                </label>
                <input
                  id={`${baseId}-pr`}
                  type="number"
                  min={1}
                  step={0.5}
                  value={prInput}
                  onChange={(e) => setPrInput(Number(e.target.value))}
                  className="t-input t-num !bg-[var(--surface)] text-sm"
                />
                <div className="flex items-center gap-2">
                  <button type="submit" className="t-btn t-btn-primary flex-1 !px-2.5 !py-1 !text-xs">
                    Guardar
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingPR(false)}
                    className="t-btn t-btn-ghost !px-2.5 !py-1 !text-xs"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <div>
                <div className="t-num text-2xl sm:text-3xl font-semibold text-[var(--ink)] tracking-tight">
                  {currentPR} kg
                </div>
                <p className="text-xs text-[var(--muted)] mt-1">
                  Mejor marca personal registrada
                </p>
              </div>
            )}
          </div>

          {/* Panel 2: Estimated 1RM */}
          <div className="bg-[var(--surface-2)] rounded-[14px] p-4 border border-[var(--line)] flex flex-col justify-between gap-3">
            <div className="flex items-center gap-2 text-[14px] font-medium text-[var(--muted)]">
              <Calculator className="w-4 h-4 text-[var(--action)] shrink-0" />
              <span>1RM estimado</span>
            </div>
            <div>
              <div className="t-num text-2xl sm:text-3xl font-semibold text-[var(--action)] tracking-tight">
                {estimated1RM} kg
              </div>
              <p className="text-xs text-[var(--muted)] mt-1">
                Peso máximo estimado a 1 rep
              </p>
            </div>
          </div>

          {/* Panel 3: Progressive Overload Delta */}
          <div className="bg-[var(--surface-2)] rounded-[14px] p-4 border border-[var(--line)] flex flex-col justify-between gap-3">
            <div className="flex items-center gap-2 text-[14px] font-medium text-[var(--muted)]">
              <TrendingUp className="w-4 h-4 text-[var(--ok)] shrink-0" />
              <span>Sobrecarga Progresiva</span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className={`t-num text-2xl sm:text-3xl font-semibold tracking-tight ${
                  progressDelta > 0 ? 'text-[var(--ok)]' : 'text-[var(--ink)]'
                }`}>
                  {progressDelta > 0 ? `+${progressDelta}` : progressDelta} kg
                </span>
                {progressDelta > 0 && <ArrowUpRight className="w-5 h-5 text-[var(--ok)] shrink-0" />}
              </div>
              <p className="text-xs text-[var(--muted)] mt-1">
                {progressDelta > 0
                  ? 'Aumento de carga vs sesión anterior'
                  : 'Carga constante mantenida'}
              </p>
            </div>
          </div>
        </div>

        {/* Interactive 1RM Calculator & Intensity Zones */}
        <div className="pt-5 border-t border-[var(--line)] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
            <h3 className="text-[16px] font-medium text-[var(--ink)]">
              Calculadora de fuerza y zonas de carga
            </h3>
            <span className="t-num text-[13px] text-[var(--muted)]">
              1RM = peso × (1 + reps / 30)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor={`${baseId}-calc-weight`} className="t-label">
                Peso levantado (kg)
              </label>
              <input
                id={`${baseId}-calc-weight`}
                type="number"
                min={1}
                step={0.5}
                value={calcWeight}
                onChange={(e) => setCalcWeight(Math.max(0, Number(e.target.value)))}
                className="t-input t-num"
              />
            </div>

            <div>
              <label htmlFor={`${baseId}-calc-reps`} className="t-label">
                Repeticiones logradas
              </label>
              <input
                id={`${baseId}-calc-reps`}
                type="number"
                min={1}
                max={30}
                value={calcReps}
                onChange={(e) => setCalcReps(Math.max(1, Math.min(30, Number(e.target.value))))}
                className="t-input t-num"
              />
            </div>
          </div>

          <div>
            <p className="text-[13px] font-medium text-[var(--muted)] mb-2.5">
              Cargas sugeridas según tu objetivo de repeticiones
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {INTENSITY_ZONES.map((zone) => {
                const targetKg = Math.round(estimated1RM * (zone.pct / 100));
                return (
                  <div
                    key={zone.pct}
                    className="bg-[var(--surface-2)] rounded-[12px] px-3.5 py-2.5 border border-[var(--line)] flex items-center justify-between gap-2"
                  >
                    <div>
                      <span className="t-num text-[14px] font-medium text-[var(--ink)] block">
                        {zone.pct}%
                      </span>
                      <span className="t-num text-[13px] text-[var(--muted)] block">
                        {zone.reps}
                      </span>
                    </div>
                    <span className="t-num text-[15px] font-semibold text-[var(--action)]">
                      {targetKg} kg
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Load History Section */}
        <div className="pt-5 border-t border-[var(--line)] space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[var(--ok)] shrink-0" />
              <h3 className="text-[16px] font-medium text-[var(--ink)]">
                Historial de cargas
              </h3>
            </div>

            <button
              type="button"
              onClick={handleToggleAddHistory}
              className="t-btn t-btn-secondary !px-3.5 !text-[14px]"
            >
              <Plus className="w-4 h-4" />
              <span>Registrar serie de hoy</span>
            </button>
          </div>

          {showAddHistory && (
            <form
              onSubmit={handleAddHistoryEntry}
              className="bg-[var(--surface-2)] rounded-[14px] p-4 border border-[var(--line)] space-y-3.5"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor={`${baseId}-hist-weight`} className="t-label">
                    Peso trabajado (kg)
                  </label>
                  <input
                    id={`${baseId}-hist-weight`}
                    type="number"
                    min={1}
                    step={0.5}
                    required
                    value={newHistWeight}
                    onChange={(e) => setNewHistWeight(Number(e.target.value))}
                    className="t-input t-num !bg-[var(--surface)]"
                  />
                </div>
                <div>
                  <label htmlFor={`${baseId}-hist-reps`} className="t-label">
                    Repeticiones realizadas
                  </label>
                  <input
                    id={`${baseId}-hist-reps`}
                    type="text"
                    required
                    placeholder="ej. 8 reps"
                    value={newHistReps}
                    onChange={(e) => setNewHistReps(e.target.value)}
                    className="t-input t-num !bg-[var(--surface)]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAddHistory(false)}
                  className="t-btn t-btn-ghost"
                >
                  Cancelar
                </button>
                <button type="submit" className="t-btn t-btn-primary">
                  Guardar registro
                </button>
              </div>
            </form>
          )}

          <div>
            {historyEntries.map((entry, idx) => (
              <div
                key={`${entry.date}-${idx}`}
                className="t-row flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Calendar className="w-4 h-4 text-[var(--muted)] shrink-0" />
                  <span className="t-num text-[14px] text-[var(--muted)]">
                    {entry.date}
                  </span>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="t-num text-[14px] text-[var(--muted)]">
                    {entry.reps}
                  </span>
                  <span className="t-num text-[15px] font-medium text-[var(--ink)]">
                    {entry.weightKg} kg
                  </span>
                  {entry.weightKg >= currentPR && (
                    <span className="t-badge t-badge-gym t-num">
                      <Award className="w-3.5 h-3.5" />
                      PR
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ModalShell>
  );
};
