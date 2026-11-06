import React, { useState } from 'react';
import { 
  X, 
  Trophy, 
  Calculator, 
  TrendingUp, 
  Calendar, 
  Plus, 
  Award, 
  Sparkles,
  Dumbbell
} from 'lucide-react';
import type { GymExercise, ExerciseHistoryEntry } from '../../types';
import { triggerConfetti } from '../../utils/confetti';

interface ExerciseProgressModalProps {
  exercise: GymExercise | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateExercise?: (updated: GymExercise) => void;
}

export const ExerciseProgressModal: React.FC<ExerciseProgressModalProps> = ({
  exercise,
  isOpen,
  onClose,
  onUpdateExercise,
}) => {
  // Initial values for 1RM calculator
  const initialWeight = exercise?.weightKg || 60;
  const initialReps = parseInt(exercise?.reps.match(/\d+/)?.[0] || '8', 10);

  const [calcWeight, setCalcWeight] = useState<number>(initialWeight);
  const [calcReps, setCalcReps] = useState<number>(initialReps);

  // New history entry state
  const [newHistWeight, setNewHistWeight] = useState<number>(initialWeight);
  const [newHistReps, setNewHistReps] = useState<string>(`${initialReps} reps`);
  const [showAddHistory, setShowAddHistory] = useState(false);

  // PR state
  const currentPR = exercise?.personalRecordKg || (exercise?.weightKg ? Math.round(exercise.weightKg * 1.1) : 80);
  const [editingPR, setEditingPR] = useState(false);
  const [prInput, setPrInput] = useState<number>(currentPR);

  if (!isOpen || !exercise) return null;

  // Epley formula: 1RM = Weight * (1 + Reps / 30)
  const calculate1RM = (weight: number, reps: number) => {
    if (reps <= 0 || weight <= 0) return 0;
    if (reps === 1) return weight;
    return Math.round(weight * (1 + reps / 30));
  };

  const estimated1RM = calculate1RM(calcWeight, calcReps);

  const percentages = [
    { pct: 95, reps: '2 reps' },
    { pct: 90, reps: '3 - 4 reps' },
    { pct: 85, reps: '5 - 6 reps' },
    { pct: 80, reps: '7 - 8 reps' },
    { pct: 75, reps: '9 - 10 reps' },
    { pct: 70, reps: '11 - 12 reps' },
  ];

  const historyEntries: ExerciseHistoryEntry[] = exercise.history && exercise.history.length > 0
    ? exercise.history
    : [
        { date: '2026-10-15', weightKg: Math.round(initialWeight * 0.9), reps: '8 reps' },
        { date: '2026-10-22', weightKg: Math.round(initialWeight * 0.95), reps: '8 reps' },
        { date: '2026-10-29', weightKg: initialWeight, reps: exercise.reps },
      ];

  const handleSavePR = () => {
    if (onUpdateExercise && prInput > 0) {
      onUpdateExercise({
        ...exercise,
        personalRecordKg: prInput,
      });
      triggerConfetti();
    }
    setEditingPR(false);
  };

  const handleAddHistoryEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHistWeight || !newHistReps.trim()) return;

    const newEntry: ExerciseHistoryEntry = {
      date: new Date().toISOString().split('T')[0],
      weightKg: Number(newHistWeight),
      reps: newHistReps.trim(),
    };

    const updatedHistory = [...(exercise.history || historyEntries), newEntry];
    const isNewPR = newHistWeight > currentPR;

    if (onUpdateExercise) {
      onUpdateExercise({
        ...exercise,
        history: updatedHistory,
        personalRecordKg: isNewPR ? newHistWeight : currentPR,
      });
      triggerConfetti();
    }

    setShowAddHistory(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div 
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-8 space-y-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-500/15 text-orange-600 dark:text-orange-400 flex items-center justify-center">
              <Dumbbell className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400">
                  Progreso & Cargas
                </span>
                <span className="text-xs text-slate-400 font-semibold">
                  {exercise.sets} series × {exercise.reps}
                </span>
              </div>
              <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                {exercise.name}
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* PR Card & Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 via-orange-500/10 to-transparent border border-orange-500/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
                <Trophy className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  Récord Personal (PR)
                </span>
                {editingPR ? (
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="number"
                      value={prInput}
                      onChange={(e) => setPrInput(Number(e.target.value))}
                      className="w-20 px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-orange-400 text-xs font-bold"
                    />
                    <button
                      onClick={handleSavePR}
                      className="px-2 py-1 rounded-lg bg-orange-600 text-white text-[11px] font-bold cursor-pointer"
                    >
                      Guardar
                    </button>
                  </div>
                ) : (
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-2xl font-black text-slate-900 dark:text-white">
                      {currentPR}
                    </span>
                    <span className="text-xs font-bold text-slate-400">kg</span>
                  </div>
                )}
              </div>
            </div>

            {!editingPR && (
              <button
                onClick={() => setEditingPR(true)}
                className="text-xs font-bold text-orange-600 dark:text-orange-400 hover:underline cursor-pointer"
              >
                Editar
              </button>
            )}
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/15 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                1RM Teórico Estimado
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-2xl font-black text-orange-600 dark:text-orange-400">
                  {estimated1RM}
                </span>
                <span className="text-xs font-bold text-slate-400">kg (Fórmula Epley)</span>
              </div>
            </div>
          </div>
        </div>

        {/* 1RM Calculator Section */}
        <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/70 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-orange-500" />
              <h4 className="text-sm font-black text-slate-900 dark:text-white">
                Calculadora Dinámica de 1RM
              </h4>
            </div>
            <span className="text-[10px] text-slate-400">
              1RM = Peso × (1 + Reps / 30)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                Peso levantado (kg)
              </label>
              <input
                type="number"
                min={1}
                value={calcWeight}
                onChange={(e) => setCalcWeight(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                Repeticiones realizadas
              </label>
              <input
                type="number"
                min={1}
                max={30}
                value={calcReps}
                onChange={(e) => setCalcReps(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Percentage zones table */}
          <div>
            <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Subdivisiones de Intensidad por Repetición
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {percentages.map((p) => {
                const targetKg = Math.round(estimated1RM * (p.pct / 100));
                return (
                  <div
                    key={p.pct}
                    className="p-2.5 rounded-xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white">{p.pct}%</span>
                      <span className="text-[10px] text-slate-400 block">{p.reps}</span>
                    </div>
                    <span className="font-mono font-black text-orange-600 dark:text-orange-400">
                      {targetKg} kg
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Load History Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              <h4 className="text-sm font-black text-slate-900 dark:text-white">
                Historial de Cargas Registradas
              </h4>
            </div>

            <button
              onClick={() => setShowAddHistory(!showAddHistory)}
              className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Registrar Sesión</span>
            </button>
          </div>

          {showAddHistory && (
            <form onSubmit={handleAddHistoryEntry} className="p-3.5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-500">Peso (kg)</label>
                  <input
                    type="number"
                    value={newHistWeight}
                    onChange={(e) => setNewHistWeight(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500">Repeticiones</label>
                  <input
                    type="text"
                    value={newHistReps}
                    onChange={(e) => setNewHistReps(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold cursor-pointer"
                >
                  Guardar Registro
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddHistory(false)}
                  className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-600 text-xs"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}

          <div className="space-y-2">
            {historyEntries.map((entry, idx) => (
              <div
                key={idx}
                className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-semibold text-slate-500">{entry.date}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-slate-600 dark:text-slate-300 font-medium">
                    {entry.reps}
                  </span>
                  <span className="font-black text-slate-900 dark:text-white px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    {entry.weightKg} kg
                  </span>
                  {entry.weightKg >= currentPR && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <Award className="w-3 h-3" /> PR
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
