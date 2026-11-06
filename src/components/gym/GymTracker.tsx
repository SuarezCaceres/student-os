import React, { useState } from 'react';
import { 
  Dumbbell, 
  Check, 
  Plus, 
  Trash2, 
  Trophy
} from 'lucide-react';
import type { GymRoutine, GymExercise, DayOfWeek } from '../../types';
import { triggerBigCelebration, triggerConfetti } from '../../utils/confetti';

interface GymTrackerProps {
  routines: GymRoutine[];
  onToggleSet: (routineId: string, exerciseId: string, setIndex: number) => void;
  onAddExercise: (day: DayOfWeek, exercise: GymExercise) => void;
  onDeleteExercise: (routineId: string, exerciseId: string) => void;
  onFinishWorkout: () => void;
}

const DAYS_LIST: DayOfWeek[] = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export const GymTracker: React.FC<GymTrackerProps> = ({
  routines,
  onToggleSet,
  onAddExercise,
  onDeleteExercise,
  onFinishWorkout,
}) => {
  // Auto-select today
  const daysMap: DayOfWeek[] = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const todayDay = daysMap[new Date().getDay()];
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(todayDay);

  // Quick add form state for this day
  const [newExName, setNewExName] = useState('');
  const [newExSets, setNewExSets] = useState(4);
  const [newExReps, setNewExReps] = useState('10-12 reps');
  const [newExWeight, setNewExWeight] = useState<number | ''>(20);
  const [showAddForm, setShowAddForm] = useState(false);

  const currentRoutine = routines.find((r) => r.dayOfWeek === selectedDay) || {
    id: `gym-${selectedDay}`,
    name: `Rutina de ${selectedDay}`,
    dayOfWeek: selectedDay,
    tag: 'Entrenamiento',
    exercises: [],
  };

  // Calculate day progress
  let totalSets = 0;
  let completedSets = 0;
  currentRoutine.exercises.forEach((ex) => {
    totalSets += ex.sets;
    completedSets += ex.completedSets.filter(Boolean).length;
  });

  const progressPercent = totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0;

  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExName.trim()) return;

    const exercise: GymExercise = {
      id: `ex-${Date.now()}`,
      name: newExName.trim(),
      sets: Number(newExSets) || 3,
      reps: newExReps.trim() || '10 reps',
      weightKg: newExWeight ? Number(newExWeight) : undefined,
      completedSets: Array(Number(newExSets) || 3).fill(false),
    };

    onAddExercise(selectedDay, exercise);
    setNewExName('');
    setShowAddForm(false);
    triggerConfetti();
  };

  return (
    <div className="space-y-6">
      {/* Header & Streak Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            Gym & Fitness Tracker
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Control de rutinas, registro de series, pesos y constancia de entrenamiento
          </p>
        </div>

        {/* Finish Workout CTA */}
        {totalSets > 0 && (
          <button
            onClick={() => {
              triggerBigCelebration();
              onFinishWorkout();
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-extrabold text-xs sm:text-sm shadow-lg shadow-orange-500/25 transition-all cursor-pointer min-h-[44px]"
          >
            <Trophy className="w-4 h-4" />
            <span>Finalizar Rutina del Día</span>
          </button>
        )}
      </div>

      {/* Days Selector Pills (Lunes a Domingo) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {DAYS_LIST.map((day) => {
          const isToday = day === todayDay;
          const isSelected = day === selectedDay;

          return (
            <button
              key={day}
              onClick={() => setSelectedDay(day)}
              className={`flex flex-col items-center justify-center px-4 py-2.5 rounded-2xl transition-all cursor-pointer min-w-[76px] min-h-[56px] border ${
                isSelected
                  ? 'bg-orange-500 text-white border-orange-500 shadow-md shadow-orange-500/30 scale-105'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-300'
              }`}
            >
              <span className="text-xs font-black uppercase tracking-wider">{day.slice(0, 3)}</span>
              <span className={`text-[10px] font-semibold mt-0.5 ${
                isSelected ? 'text-orange-100' : isToday ? 'text-orange-500 font-bold' : 'text-slate-400'
              }`}>
                {isToday ? '• Hoy •' : day}
              </span>
            </button>
          );
        })}
      </div>

      {/* Routine Detail Card */}
      <div className="rounded-3xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        
        {/* Routine Title & Stats */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-black uppercase px-2.5 py-0.5 rounded-full bg-orange-500/15 text-orange-600 dark:text-orange-400">
                {currentRoutine.tag}
              </span>
              <span className="text-xs text-slate-400 font-semibold">• {selectedDay}</span>
            </div>
            <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
              {currentRoutine.name}
            </h3>
          </div>

          {/* Progress Bar in Routine */}
          <div className="w-full md:w-64">
            <div className="flex items-center justify-between text-xs font-bold mb-1.5">
              <span className="text-slate-500 dark:text-slate-400">Progreso de hoy</span>
              <span className="text-orange-600 dark:text-orange-400">{progressPercent}%</span>
            </div>
            <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {completedSets} de {totalSets} series completadas
            </p>
          </div>
        </div>

        {/* Exercises List */}
        <div className="space-y-4 pt-6">
          {currentRoutine.exercises.length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-sm">
              <Dumbbell className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
              <span>No hay ejercicios registrados para el {selectedDay}.</span>
              <p className="text-xs mt-1">¡Añade uno con el botón inferior!</p>
            </div>
          ) : (
            currentRoutine.exercises.map((exercise) => {
              const allSetsCompleted = exercise.completedSets.every(Boolean);

              return (
                <div
                  key={exercise.id}
                  className={`p-4 rounded-2xl border transition-all duration-200 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                    allSetsCompleted
                      ? 'bg-emerald-50/20 dark:bg-emerald-950/10 border-emerald-500/30'
                      : 'bg-slate-50/70 dark:bg-slate-900/40 border-slate-200/80 dark:border-slate-800'
                  }`}
                >
                  {/* Left: Name, Reps & Weight */}
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                        {exercise.name}
                      </h4>
                      {allSetsCompleted && (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <Check className="w-3 h-3 stroke-[3]" /> Completado
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {exercise.sets} series × {exercise.reps}
                      </span>
                      {exercise.weightKg && (
                        <>
                          <span>•</span>
                          <span className="font-bold text-orange-600 dark:text-orange-400">
                            {exercise.weightKg} kg
                          </span>
                        </>
                      )}
                      {exercise.notes && (
                        <>
                          <span>•</span>
                          <span className="italic">{exercise.notes}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Right: Interactive Series Bubbles & Delete */}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {Array.from({ length: exercise.sets }).map((_, setIdx) => {
                        const isDone = exercise.completedSets[setIdx] || false;

                        return (
                          <button
                            key={setIdx}
                            onClick={() => {
                              if (!isDone) triggerConfetti();
                              onToggleSet(currentRoutine.id, exercise.id, setIdx);
                            }}
                            className={`w-10 h-10 rounded-xl font-bold text-xs flex flex-col items-center justify-center transition-all cursor-pointer ${
                              isDone
                                ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30 scale-105'
                                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:border-orange-400'
                            }`}
                            title={`Serie ${setIdx + 1}: Haz clic para alternar`}
                          >
                            <span>S{setIdx + 1}</span>
                            {isDone && <Check className="w-3 h-3 stroke-[3] -mt-0.5" />}
                          </button>
                        );
                      })}
                    </div>

                    {/* Delete exercise button */}
                    <button
                      onClick={() => onDeleteExercise(currentRoutine.id, exercise.id)}
                      className="p-2 text-slate-400 hover:text-rose-500 rounded-xl transition-colors cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center"
                      title="Eliminar ejercicio"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Quick Add Exercise Section */}
        <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
          {!showAddForm ? (
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-orange-400/50 hover:border-orange-500 text-orange-600 dark:text-orange-400 text-xs font-bold transition-all cursor-pointer w-full justify-center min-h-[44px]"
            >
              <Plus className="w-4 h-4" />
              <span>+ Agregar Ejercicio a {selectedDay}</span>
            </button>
          ) : (
            <form onSubmit={handleQuickAdd} className="p-4 rounded-2xl bg-orange-50/50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-orange-700 dark:text-orange-300">
                  Nuevo ejercicio para {selectedDay}
                </span>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  Cancelar
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <div className="sm:col-span-2">
                  <input
                    type="text"
                    required
                    placeholder="Nombre del ejercicio (ej. Hip Thrust)"
                    value={newExName}
                    onChange={(e) => setNewExName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    placeholder="Series (4)"
                    value={newExSets}
                    onChange={(e) => setNewExSets(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <input
                    type="text"
                    placeholder="Reps (ej. 10-12)"
                    value={newExReps}
                    onChange={(e) => setNewExReps(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    placeholder="Peso kg"
                    value={newExWeight}
                    onChange={(e) => setNewExWeight(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs cursor-pointer shadow-md shadow-orange-600/30"
              >
                Guardar Ejercicio
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
