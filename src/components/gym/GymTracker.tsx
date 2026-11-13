import React, { useState, useId } from 'react';
import {
  Dumbbell,
  Plus,
  Trophy,
  Timer,
  Settings2,
} from 'lucide-react';
import type {
  GymRoutine,
  GymExercise,
  DayOfWeek,
  ExerciseHistoryEntry,
  UserGymProfile,
  WeightHistoryEntry,
} from '../../types';
import { triggerBigCelebration, triggerConfetti } from '../../utils/confetti';
import { getRecommendedRestSeconds } from '../../utils/routineGenerator';
import { SectionHeader } from '../common/SectionHeader';
import { ModalShell } from '../common/ModalShell';
import { RestTimerFloating } from './RestTimerFloating';
import { ExerciseProgressModal } from './ExerciseProgressModal';
import { ExerciseVideoModal } from './ExerciseVideoModal';
import { QuickWeightModal } from './QuickWeightModal';
import { ExerciseCard } from './ExerciseCard';
import { GymOnboardingModal, type GymOnboardingCompletePayload } from './GymOnboardingModal';
import { GymProfileCard } from './GymProfileCard';
import { WeightCheckInModal } from './WeightCheckInModal';
import { GymRestDayBanner } from './GymRestDayBanner';

export interface GymTrackerProps {
  routines: GymRoutine[];
  gymProfile?: UserGymProfile;
  weightHistory?: WeightHistoryEntry[];
  onSaveGymPlan?: (payload: GymOnboardingCompletePayload) => void;
  onLogBodyWeight?: (newWeightKg: number) => void;
  onToggleSet: (routineId: string, exerciseId: string, setIndex: number) => void;
  onAddExercise: (day: DayOfWeek, exercise: GymExercise) => void;
  onDeleteExercise: (routineId: string, exerciseId: string) => void;
  onFinishWorkout: () => void;
  onUpdateExercise?: (day: DayOfWeek, updated: GymExercise) => void;
}

const DAYS_LIST: DayOfWeek[] = [
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
  'Domingo',
];

const JS_DAYS_MAP: DayOfWeek[] = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
];

function getTodayDayOfWeek(): DayOfWeek {
  return JS_DAYS_MAP[new Date().getDay()];
}

export const GymTracker: React.FC<GymTrackerProps> = ({
  routines,
  gymProfile,
  weightHistory,
  onSaveGymPlan,
  onLogBodyWeight,
  onToggleSet,
  onAddExercise,
  onDeleteExercise,
  onFinishWorkout,
  onUpdateExercise,
}) => {
  const formId = useId();

  // Purity-safe lazy state initialization for today's day & first-time onboarding
  const [todayDay] = useState<DayOfWeek>(() => getTodayDayOfWeek());
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(() => getTodayDayOfWeek());
  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(() => !gymProfile);
  const [isWeightCheckInOpen, setIsWeightCheckInOpen] = useState<boolean>(false);

  // Rest Timer state
  const [isTimerOpen, setIsTimerOpen] = useState(false);
  const [autoTimerEnabled, setAutoTimerEnabled] = useState(true);
  const [timerAutoStart, setTimerAutoStart] = useState(false);
  const [timerKey, setTimerKey] = useState(0);

  // Exercise Progress Modal & fallback local overrides (used when onUpdateExercise is not passed)
  const [selectedExerciseIdForModal, setSelectedExerciseIdForModal] = useState<string | null>(null);
  const [selectedExerciseIdForVideoModal, setSelectedExerciseIdForVideoModal] = useState<string | null>(null);
  const [selectedExerciseIdForWeightModal, setSelectedExerciseIdForWeightModal] = useState<string | null>(null);
  const [exerciseOverrides, setExerciseOverrides] = useState<
    Record<string, Omit<Partial<GymExercise>, 'completedSets'>>
  >({});

  // Add Exercise Modal state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newExName, setNewExName] = useState('');
  const [newExSets, setNewExSets] = useState<number>(4);
  const [newExReps, setNewExReps] = useState('8-10 reps');
  const [newExWeight, setNewExWeight] = useState<number | ''>(20);
  const [newExNotes, setNewExNotes] = useState('');

  const rawRoutine = routines.find((r) => r.dayOfWeek === selectedDay) || {
    id: `gym-${selectedDay}`,
    name: `Rutina de ${selectedDay}`,
    dayOfWeek: selectedDay,
    tag: 'Entrenamiento',
    exercises: [],
  };

  // Merge local overrides only when parent hasn't connected onUpdateExercise yet
  const currentRoutine: GymRoutine = {
    ...rawRoutine,
    exercises: rawRoutine.exercises.map((ex) => ({
      ...ex,
      ...(onUpdateExercise ? {} : exerciseOverrides[ex.id] || {}),
    })),
  };

  const selectedExerciseForModal =
    selectedExerciseIdForModal
      ? currentRoutine.exercises.find((ex) => ex.id === selectedExerciseIdForModal) || null
      : null;

  const selectedExerciseForVideoModal =
    selectedExerciseIdForVideoModal
      ? currentRoutine.exercises.find((ex) => ex.id === selectedExerciseIdForVideoModal) || null
      : null;

  const selectedExerciseForWeightModal =
    selectedExerciseIdForWeightModal
      ? currentRoutine.exercises.find((ex) => ex.id === selectedExerciseIdForWeightModal) || null
      : null;

  const handleSaveQuickWeight = (newWeight: number, reps: string) => {
    if (!selectedExerciseForWeightModal) return;

    const currentPR =
      selectedExerciseForWeightModal.personalRecordKg ||
      (selectedExerciseForWeightModal.weightKg
        ? Math.round(selectedExerciseForWeightModal.weightKg * 1.1)
        : 80);
    const isNewPR = newWeight > currentPR;

    const newHistoryEntry: ExerciseHistoryEntry = {
      date: new Date().toISOString().split('T')[0],
      weightKg: newWeight,
      reps: reps.trim(),
    };

    const updated: GymExercise = {
      ...selectedExerciseForWeightModal,
      weightKg: newWeight,
      reps: reps.trim(),
      personalRecordKg: isNewPR ? newWeight : currentPR,
      history: [...(selectedExerciseForWeightModal.history || []), newHistoryEntry],
    };

    handleUpdateExerciseFromModal(updated);
  };

  // Calculate day progress
  let totalSets = 0;
  let completedSets = 0;
  currentRoutine.exercises.forEach((ex) => {
    totalSets += ex.sets;
    completedSets += ex.completedSets.filter(Boolean).length;
  });

  const progressPercent = totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0;

  const handleToggleSetWithTimer = (
    routineId: string,
    exerciseId: string,
    setIndex: number,
    currentlyDone: boolean
  ) => {
    onToggleSet(routineId, exerciseId, setIndex);

    // Trigger celebration & auto rest timer when completing a set
    if (!currentlyDone) {
      triggerConfetti();
      if (autoTimerEnabled) {
        setTimerAutoStart(true);
        setIsTimerOpen(true);
        setTimerKey((k) => k + 1);
      }
    }
  };

  const handleUpdateExerciseFromModal = (updated: GymExercise) => {
    if (onUpdateExercise) {
      onUpdateExercise(selectedDay, updated);
      return;
    }

    // Fallback when App.tsx hasn't passed onUpdateExercise yet
    const { completedSets: _ignoredSets, ...restUpdated } = updated;
    void _ignoredSets;
    setExerciseOverrides((prev) => ({
      ...prev,
      [updated.id]: restUpdated,
    }));

    try {
      const raw = localStorage.getItem('student_os_state_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.gymRoutines)) {
          parsed.gymRoutines = parsed.gymRoutines.map((r: GymRoutine) => ({
            ...r,
            exercises: r.exercises.map((e: GymExercise) =>
              e.id === updated.id ? { ...e, ...restUpdated } : e
            ),
          }));
          localStorage.setItem('student_os_state_v1', JSON.stringify(parsed));
        }
      }
    } catch {
      // Ignore storage errors in restricted environments
    }
  };

  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExName.trim()) return;

    const setsCount = Math.max(1, Math.min(12, Number(newExSets) || 3));
    const parsedWeight = newExWeight !== '' && Number(newExWeight) > 0 ? Number(newExWeight) : undefined;

    const exercise: GymExercise = {
      id: `ex-${Date.now()}`,
      name: newExName.trim(),
      sets: setsCount,
      reps: newExReps.trim() || '10 reps',
      weightKg: parsedWeight,
      completedSets: Array(setsCount).fill(false),
      personalRecordKg: parsedWeight,
      notes: newExNotes.trim() || undefined,
    };

    onAddExercise(selectedDay, exercise);
    setNewExName('');
    setNewExNotes('');
    setShowAddForm(false);
    triggerConfetti();
  };

  const recommendedRestDuration = gymProfile
    ? getRecommendedRestSeconds(gymProfile.goal)
    : 90;

  const isConfiguredRestDay =
    Boolean(gymProfile) &&
    !gymProfile?.selectedDays.includes(selectedDay) &&
    currentRoutine.exercises.length === 0;

  const nextTrainingDay: DayOfWeek | undefined = (() => {
    if (!gymProfile || gymProfile.selectedDays.length === 0) return undefined;
    const currentIndex = DAYS_LIST.indexOf(selectedDay);
    for (let offset = 1; offset <= 7; offset++) {
      const candidate = DAYS_LIST[(currentIndex + offset) % 7];
      if (gymProfile.selectedDays.includes(candidate)) {
        return candidate;
      }
    }
    return gymProfile.selectedDays[0];
  })();

  return (
    <div className="space-y-6">
      {/* Header */}
      <SectionHeader
        title="Entrenamiento y gimnasio"
        subtitle="Marca tus series en un toque, controla tus descansos y supera tus marcas."
        actions={
          <>
            <button
              type="button"
              onClick={() => setIsOnboardingOpen(true)}
              className="t-btn t-btn-secondary"
            >
              <Settings2 className="w-4 h-4" aria-hidden="true" />
              <span>{gymProfile ? 'Mi perfil gym' : 'Configurar gym'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setTimerAutoStart(false);
                setIsTimerOpen((prev) => !prev);
              }}
              aria-pressed={isTimerOpen}
              className={`t-btn t-btn-secondary ${
                isTimerOpen ? '!border-[var(--action)] !text-[var(--action)]' : ''
              }`}
            >
              <Timer className="w-4 h-4" aria-hidden="true" />
              <span>Cronómetro</span>
            </button>

            <button
              type="button"
              role="switch"
              aria-checked={autoTimerEnabled}
              onClick={() => setAutoTimerEnabled((prev) => !prev)}
              className={`min-h-[44px] px-3.5 rounded-[12px] border text-[14px] font-medium inline-flex items-center gap-2.5 cursor-pointer select-none transition-colors focus-visible:outline-2 focus-visible:outline-[var(--action)] focus-visible:outline-offset-2 ${
                autoTimerEnabled
                  ? 'bg-[color-mix(in_oklab,var(--action)_12%,var(--surface))] border-[color-mix(in_oklab,var(--action)_32%,transparent)] text-[var(--ink)]'
                  : 'bg-[var(--surface)] border-[var(--line-strong)] text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
              title="Abrir el cronómetro automáticamente al completar una serie"
            >
              <span
                aria-hidden="true"
                className={`w-2.5 h-2.5 rounded-full transition-colors ${
                  autoTimerEnabled ? 'bg-[var(--ok)]' : 'bg-[var(--muted)] opacity-45'
                }`}
              />
              <span>Descanso automático</span>
            </button>

            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="t-btn t-btn-primary"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>Agregar ejercicio</span>
            </button>
          </>
        }
      />

      {/* Profile Summary & BMI Card (or first-time setup prompt) */}
      {gymProfile ? (
        <GymProfileCard
          profile={gymProfile}
          onOpenOnboarding={() => setIsOnboardingOpen(true)}
          onOpenWeightCheckIn={() => setIsWeightCheckInOpen(true)}
        />
      ) : (
        <div className="t-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[15px] font-medium text-[var(--ink)]">
              Personaliza tu gimnasio, frecuencia semanal, objetivo e IMC
            </p>
            <p className="text-[14px] text-[var(--muted)] mt-0.5">
              Configúralo una sola vez para generar rutinas adaptadas a tus días y sede.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsOnboardingOpen(true)}
            className="t-btn t-btn-primary shrink-0"
          >
            <Settings2 className="w-4 h-4" aria-hidden="true" />
            <span>Configurar mi plan</span>
          </button>
        </div>
      )}

      {/* Tactile Day Selector (Lunes - Domingo, >=44px height) */}
      <div
        role="tablist"
        aria-label="Seleccionar día de entrenamiento"
        className="flex md:grid md:grid-cols-7 items-center gap-1.5 p-1.5 rounded-[16px] bg-[var(--surface-2)] border border-[var(--line)] overflow-x-auto no-scrollbar"
      >
        {DAYS_LIST.map((day) => {
          const isToday = day === todayDay;
          const isSelected = day === selectedDay;
          const isScheduledDay = gymProfile ? gymProfile.selectedDays.includes(day) : false;

          return (
            <button
              key={day}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => setSelectedDay(day)}
              className={`min-h-[46px] min-w-[86px] md:min-w-0 px-3 py-2 rounded-[12px] text-[14px] font-medium inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer select-none transition-all focus-visible:outline-2 focus-visible:outline-[var(--action)] ${
                isSelected
                  ? 'bg-[var(--surface)] text-[var(--ink)] border border-[var(--line-strong)] shadow-2xs'
                  : 'border border-transparent text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              {isScheduledDay && (
                <span
                  aria-hidden="true"
                  className="w-1.5 h-1.5 rounded-full bg-[var(--gym)] shrink-0"
                />
              )}
              <span className="sm:hidden">{day.slice(0, 3)}</span>
              <span className="hidden sm:inline">{day}</span>
              {isToday && (
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[13px] leading-none font-medium ${
                    isSelected
                      ? 'bg-[color-mix(in_oklab,var(--action)_16%,transparent)] text-[var(--action)]'
                      : 'bg-[var(--surface)] text-[var(--muted)] border border-[var(--line)]'
                  }`}
                >
                  Hoy
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main Routine Card OR Active Recovery Rest Day Banner */}
      {isConfiguredRestDay ? (
        <GymRestDayBanner
          selectedDay={selectedDay}
          nextTrainingDay={nextTrainingDay}
          goal={gymProfile?.goal}
          onSelectDay={(day) => setSelectedDay(day)}
          onAddExtraExercise={() => setShowAddForm(true)}
        />
      ) : (
      <section className="t-card p-6">
        {/* Routine Header & Progress */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-5 border-b border-[var(--line)]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="t-badge t-badge-gym">{currentRoutine.tag}</span>
              <span className="text-[13px] text-[var(--muted)]">· {selectedDay}</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-medium tracking-[-0.025em] text-[var(--ink)] leading-snug">
              {currentRoutine.name}
            </h3>
          </div>

          <div className="w-full md:w-72 shrink-0">
            <div className="flex items-center justify-between gap-2 text-[13px] mb-2">
              <span className="text-[var(--muted)]">Progreso del día</span>
              <span className="t-num font-medium text-[var(--ink)]">
                {completedSets}/{totalSets} series · {progressPercent}%
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-[var(--surface-2)] overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  progressPercent === 100 ? 'bg-[var(--ok)]' : 'bg-[var(--action)]'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Exercises List (clean .t-row separation, zero triple nesting) */}
        <div className="pt-4">
          {currentRoutine.exercises.length === 0 ? (
            <div className="py-12 text-center">
              <Dumbbell className="w-8 h-8 mx-auto text-[var(--muted)] mb-3" />
              <p className="text-[16px] font-medium text-[var(--ink)]">
                No hay ejercicios programados para el {selectedDay}
              </p>
              <p className="text-[14px] text-[var(--muted)] mt-1">
                Agrega un ejercicio para registrar tus series y cargas.
              </p>
              <button
                type="button"
                onClick={() => setShowAddForm(true)}
                className="t-btn t-btn-secondary mt-4"
              >
                <Plus className="w-4 h-4" />
                <span>Agregar ejercicio</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3.5">
              {currentRoutine.exercises.map((exercise) => (
                <ExerciseCard
                  key={exercise.id}
                  exercise={exercise}
                  routineId={currentRoutine.id}
                  onToggleSet={(routineId, exerciseId, setIdx, currentlyDone) =>
                    handleToggleSetWithTimer(routineId, exerciseId, setIdx, currentlyDone)
                  }
                  onOpenVideo={(ex) => setSelectedExerciseIdForVideoModal(ex.id)}
                  onOpenWeightLog={(ex) => setSelectedExerciseIdForWeightModal(ex.id)}
                  onOpenProgressModal={(id) => setSelectedExerciseIdForModal(id)}
                  onDelete={(routineId, exerciseId) => onDeleteExercise(routineId, exerciseId)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Routine Footer CTA */}
        {currentRoutine.exercises.length > 0 && (
          <div className="mt-6 pt-5 border-t border-[var(--line)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-[14px] text-[var(--muted)]">
              {progressPercent === 100
                ? 'Completaste todas las series programadas para este día.'
                : 'Registra tu entrenamiento al terminar para sumar un día más a tu racha.'}
            </p>
            <button
              type="button"
              onClick={() => {
                triggerBigCelebration();
                onFinishWorkout();
              }}
              className="t-btn t-btn-primary w-full sm:w-auto"
            >
              <Trophy className="w-4 h-4" />
              <span>Terminar rutina de hoy</span>
            </button>
          </div>
        )}
      </section>
      )}

      {/* Add Exercise Modal */}
      <ModalShell
        isOpen={showAddForm}
        onClose={() => setShowAddForm(false)}
        badge={selectedDay}
        title="Agregar ejercicio a la rutina"
        subtitle={`Se añadirá a "${currentRoutine.name}"`}
        icon={<Dumbbell className="w-5 h-5" />}
        maxWidth="lg"
        footer={
          <>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="t-btn t-btn-ghost"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form={`${formId}-add-exercise`}
              className="t-btn t-btn-primary"
            >
              <Plus className="w-4 h-4" />
              <span>Guardar ejercicio</span>
            </button>
          </>
        }
      >
        <form
          id={`${formId}-add-exercise`}
          onSubmit={handleQuickAdd}
          className="space-y-4"
        >
          <div>
            <label htmlFor={`${formId}-name`} className="t-label">
              Nombre del ejercicio
            </label>
            <input
              id={`${formId}-name`}
              type="text"
              required
              placeholder="Ej. Press inclinado con mancuernas"
              value={newExName}
              onChange={(e) => setNewExName(e.target.value)}
              className="t-input"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor={`${formId}-sets`} className="t-label">
                Series
              </label>
              <input
                id={`${formId}-sets`}
                type="number"
                min={1}
                max={12}
                required
                value={newExSets}
                onChange={(e) => setNewExSets(Number(e.target.value))}
                className="t-input t-num"
              />
            </div>

            <div>
              <label htmlFor={`${formId}-reps`} className="t-label">
                Repeticiones
              </label>
              <input
                id={`${formId}-reps`}
                type="text"
                required
                placeholder="Ej. 8-10 reps"
                value={newExReps}
                onChange={(e) => setNewExReps(e.target.value)}
                className="t-input t-num"
              />
            </div>

            <div>
              <label htmlFor={`${formId}-weight`} className="t-label">
                Peso en kg (opcional)
              </label>
              <input
                id={`${formId}-weight`}
                type="number"
                min={0}
                step={0.5}
                placeholder="Ej. 30"
                value={newExWeight}
                onChange={(e) =>
                  setNewExWeight(e.target.value === '' ? '' : Number(e.target.value))
                }
                className="t-input t-num"
              />
            </div>
          </div>

          <div>
            <label htmlFor={`${formId}-notes`} className="t-label">
              Nota técnica (opcional)
            </label>
            <input
              id={`${formId}-notes`}
              type="text"
              placeholder="Ej. Controlar la bajada durante 2 segundos"
              value={newExNotes}
              onChange={(e) => setNewExNotes(e.target.value)}
              className="t-input"
            />
          </div>
        </form>
      </ModalShell>

      {/* Floating Rest Timer */}
      <RestTimerFloating
        key={`${timerKey}-${recommendedRestDuration}`}
        isOpen={isTimerOpen}
        onClose={() => setIsTimerOpen(false)}
        defaultDuration={recommendedRestDuration}
        autoStart={timerAutoStart}
      />

      {/* Gym Onboarding & Profile Setup Wizard */}
      <GymOnboardingModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        initialProfile={gymProfile}
        hasExistingRoutines={routines.some((r) => r.exercises.length > 0)}
        onComplete={(payload) => {
          onSaveGymPlan?.(payload);
          setIsOnboardingOpen(false);
          triggerConfetti();
          if (
            payload.profile.selectedDays.length > 0 &&
            !payload.profile.selectedDays.includes(selectedDay)
          ) {
            setSelectedDay(payload.profile.selectedDays[0]);
          }
        }}
      />

      {/* Body Weight Check-in & BMI History Modal */}
      <WeightCheckInModal
        isOpen={isWeightCheckInOpen}
        onClose={() => setIsWeightCheckInOpen(false)}
        currentWeightKg={gymProfile?.weightKg ?? 72}
        heightCm={gymProfile?.heightCm ?? 174}
        targetWeightKg={gymProfile?.targetWeightKg}
        weightHistory={weightHistory}
        onSaveWeight={(newWeight) => {
          onLogBodyWeight?.(newWeight);
          triggerConfetti();
        }}
      />

      {/* Exercise Progress & 1RM Modal */}
      <ExerciseProgressModal
        key={selectedExerciseForModal?.id ?? 'closed'}
        exercise={selectedExerciseForModal}
        isOpen={Boolean(selectedExerciseForModal)}
        onClose={() => setSelectedExerciseIdForModal(null)}
        onUpdateExercise={handleUpdateExerciseFromModal}
      />

      {/* Exercise Video & Technique Modal */}
      <ExerciseVideoModal
        key={selectedExerciseForVideoModal?.id ?? 'video-closed'}
        exercise={selectedExerciseForVideoModal}
        isOpen={Boolean(selectedExerciseForVideoModal)}
        onClose={() => setSelectedExerciseIdForVideoModal(null)}
        onOpenWeightLog={() => {
          setSelectedExerciseIdForWeightModal(selectedExerciseIdForVideoModal);
        }}
      />

      {/* Quick Weight Progress Logging Modal */}
      <QuickWeightModal
        key={selectedExerciseForWeightModal?.id ?? 'weight-closed'}
        exercise={selectedExerciseForWeightModal}
        isOpen={Boolean(selectedExerciseForWeightModal)}
        onClose={() => setSelectedExerciseIdForWeightModal(null)}
        onSaveWeight={handleSaveQuickWeight}
      />
    </div>
  );
};
