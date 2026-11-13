import React, { useEffect, useId, useState } from 'react';
import {
  AlertCircle,
  CalendarCheck2,
  CalendarClock,
  Check,
  CheckCircle2,
  Clock,
  Dumbbell,
  Plus,
  RefreshCw,
  Settings2,
  Timer,
  Trophy,
} from 'lucide-react';
import type {
  CalendarBlock,
  DayOfWeek,
  ExerciseHistoryEntry,
  GymAttendanceLog,
  GymExercise,
  GymRoutine,
  MissReasonId,
  UserGymProfile,
  WeightHistoryEntry,
} from '../../types';
import type { BusyInterval } from '../../utils/calendarSlotFinder';
import type { GoogleCalendarEvent } from '../../services/googleCalendar';
import { triggerBigCelebration, triggerConfetti } from '../../utils/confetti';
import {
  buildSessionAttendanceLog,
  findPendingMissedDays,
  formatElapsedSeconds,
  formatShortSpanishDate,
  getCurrentWeekDateMap,
  getLocalIsoDate,
  getRescheduleOptions,
  getTodayDayOfWeek,
  type RescheduleMode,
} from '../../utils/gymAttendance';
import { getGymDisplayName, getRecommendedRestSeconds } from '../../utils/routineGenerator';
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
import { GymStartGateCard } from './GymStartGateCard';
import { GymMissFlowCard } from './GymMissFlowCard';
import { GymMissedSummaryCard } from './GymMissedSummaryCard';

export interface GymTrackerProps {
  routines: GymRoutine[];
  gymProfile?: UserGymProfile;
  weightHistory?: WeightHistoryEntry[];
  attendanceLogs?: GymAttendanceLog[];
  calendarBlocks?: CalendarBlock[];
  externalBusyByDate?: Record<string, BusyInterval[]>;
  googleEvents?: GoogleCalendarEvent[];
  isGoogleConnected?: boolean;
  isGoogleSyncing?: boolean;
  isSyncingGymToGoogle?: boolean;
  autoOpenOnboarding?: boolean;
  onOnboardingOpenChange?: (isOpen: boolean) => void;
  onOpenGoogleSync?: () => void;
  onSyncGymWeekToGoogle?: () => Promise<void> | void;
  onSaveGymPlan?: (payload: GymOnboardingCompletePayload) => void;
  onLogBodyWeight?: (newWeightKg: number) => void;
  onStartSession?: (payload: {
    dayOfWeek: DayOfWeek;
    date: string;
    routineId: string;
    routineName: string;
  }) => void;
  onLogMissedWorkout?: (payload: {
    dayOfWeek: DayOfWeek;
    dateIso: string;
    routineId: string;
    routineName: string;
    reason: MissReasonId;
    note?: string;
    encouragementMessage: string;
  }) => void;
  onRescheduleWorkout?: (payload: {
    fromDay: DayOfWeek;
    fromDate: string;
    toDay: DayOfWeek;
    mode: RescheduleMode;
    reminderMinutes?: number[];
    selectedSlot?: {
      dateIso: string;
      startTime: string;
      endTime: string;
    };
  }) => void;
  onToggleSet: (routineId: string, exerciseId: string, setIndex: number) => void;
  onAddExercise: (day: DayOfWeek, exercise: GymExercise) => void;
  onDeleteExercise: (routineId: string, exerciseId: string) => void;
  onFinishWorkout: (payload?: {
    dayOfWeek: DayOfWeek;
    date: string;
    routineId: string;
    routineName: string;
    durationMinutes?: number;
  }) => void;
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

export const GymTracker: React.FC<GymTrackerProps> = ({
  routines,
  gymProfile,
  weightHistory,
  attendanceLogs,
  calendarBlocks = [],
  externalBusyByDate,
  googleEvents,
  isGoogleConnected = false,
  isGoogleSyncing = false,
  isSyncingGymToGoogle = false,
  autoOpenOnboarding,
  onOnboardingOpenChange,
  onOpenGoogleSync,
  onSyncGymWeekToGoogle,
  onSaveGymPlan,
  onLogBodyWeight,
  onStartSession,
  onLogMissedWorkout,
  onRescheduleWorkout,
  onToggleSet,
  onAddExercise,
  onDeleteExercise,
  onFinishWorkout,
  onUpdateExercise,
}) => {
  const formId = useId();

  // Purity-safe lazy state initialization for today's day, local week dates & onboarding
  const [todayDay] = useState<DayOfWeek>(() => getTodayDayOfWeek());
  const [todayIso] = useState<string>(() => getLocalIsoDate());
  const [weekDates] = useState<Record<DayOfWeek, string>>(() => getCurrentWeekDateMap());
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(() => getTodayDayOfWeek());
  const [internalOnboardingOpen, setInternalOnboardingOpen] = useState<boolean>(
    () => autoOpenOnboarding ?? !gymProfile
  );
  const isOnboardingOpen =
    autoOpenOnboarding !== undefined ? autoOpenOnboarding : internalOnboardingOpen;
  const setIsOnboardingOpen = (nextOpen: boolean) => {
    setInternalOnboardingOpen(nextOpen);
    onOnboardingOpenChange?.(nextOpen);
  };
  const [isWeightCheckInOpen, setIsWeightCheckInOpen] = useState<boolean>(false);
  const [fallbackLogs, setFallbackLogs] = useState<GymAttendanceLog[]>([]);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [statusAnnouncement, setStatusAnnouncement] = useState<string>('');
  const [pinnedMissDay, setPinnedMissDay] = useState<{
    dayOfWeek: DayOfWeek;
    dateIso: string;
    routine: GymRoutine;
    isRetroactive: boolean;
    initialStage: 'reason' | 'encouragement_reschedule';
    existingReason?: MissReasonId;
  } | null>(null);

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
      date: todayIso,
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

  const effectiveLogs = attendanceLogs ?? fallbackLogs;
  const selectedDateIso = weekDates[selectedDay];
  const selectedDayLog = effectiveLogs.find((l) => l.date === selectedDateIso);
  const isSessionInProgress = selectedDayLog?.status === 'in_progress';

  useEffect(() => {
    if (!isSessionInProgress) return;
    const id = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(id);
  }, [isSessionInProgress]);

  const startedMs = selectedDayLog?.startedAt
    ? new Date(selectedDayLog.startedAt).getTime()
    : Number.NaN;
  const elapsedSeconds =
    isSessionInProgress && Number.isFinite(startedMs)
      ? Math.max(0, Math.floor((nowMs - startedMs) / 1000))
      : 0;

  const pendingMissedDays = findPendingMissedDays(
    gymProfile,
    routines,
    effectiveLogs,
    weekDates,
    todayIso
  );

  const pendingForSelected = pendingMissedDays.find((p) => p.dayOfWeek === selectedDay);
  const autoPendingMiss =
    selectedDay === todayDay ? pendingMissedDays[0] : pendingForSelected;

  const activeMissFlow =
    pinnedMissDay ??
    (autoPendingMiss
      ? {
          dayOfWeek: autoPendingMiss.dayOfWeek,
          dateIso: autoPendingMiss.date,
          routine: autoPendingMiss.routine,
          isRetroactive: true,
          initialStage: 'reason' as const,
          existingReason: undefined,
        }
      : null);

  const hasAnyCompletedSet = currentRoutine.exercises.some((ex) =>
    ex.completedSets.some(Boolean)
  );

  const gymDisplayName = gymProfile
    ? getGymDisplayName(gymProfile.gymType, gymProfile.customGymName)
    : undefined;

  const upsertFallbackLog = (nextLog: GymAttendanceLog) => {
    setFallbackLogs((prev) => [...prev.filter((l) => l.date !== nextLog.date), nextLog]);
  };

  const handleStartTodaySession = () => {
    const { nowMs: startNow, log } = buildSessionAttendanceLog({
      date: todayIso,
      dayOfWeek: todayDay,
      routineId: currentRoutine.id,
      routineName: currentRoutine.name,
      status: 'in_progress',
    });
    setNowMs(startNow);
    setStatusAnnouncement(`Sesión de ${todayDay} iniciada. Cronómetro de 2 horas en marcha.`);
    const payload = {
      dayOfWeek: todayDay,
      date: todayIso,
      routineId: currentRoutine.id,
      routineName: currentRoutine.name,
    };
    if (onStartSession) {
      onStartSession(payload);
    } else {
      upsertFallbackLog(log);
    }
  };

  const handleCompleteTodayWorkout = () => {
    const durationMinutes =
      elapsedSeconds > 0 ? Math.max(1, Math.round(elapsedSeconds / 60)) : undefined;
    triggerBigCelebration();
    setStatusAnnouncement(`Entrenamiento del ${selectedDay} registrado como completado.`);
    const payload = {
      dayOfWeek: selectedDay,
      date: selectedDateIso,
      routineId: currentRoutine.id,
      routineName: currentRoutine.name,
      durationMinutes,
    };
    if (!onStartSession) {
      const { log } = buildSessionAttendanceLog({
        date: selectedDateIso,
        dayOfWeek: selectedDay,
        routineId: currentRoutine.id,
        routineName: currentRoutine.name,
        status: 'completed',
        durationMinutes,
      });
      upsertFallbackLog(log);
    }
    onFinishWorkout(payload);
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

  const shouldShowTodayStartGate =
    selectedDay === todayDay &&
    currentRoutine.exercises.length > 0 &&
    selectedDayLog?.status !== 'in_progress' &&
    selectedDayLog?.status !== 'completed' &&
    !hasAnyCompletedSet;

  const selectedMissRescheduleOptions =
    selectedDayLog?.status === 'missed'
      ? getRescheduleOptions(selectedDay, routines, gymProfile, weekDates, todayIso)
      : [];

  // Derived weekly adherence telemetry (avoid duplicating in state)
  const weeklyPlannedCount = DAYS_LIST.reduce((acc, day) => {
    const dayRoutine = routines.find((r) => r.dayOfWeek === day);
    const hasExercises = Boolean(dayRoutine && dayRoutine.exercises.length > 0);
    const isScheduled = gymProfile ? gymProfile.selectedDays.includes(day) : hasExercises;
    return acc + (isScheduled ? 1 : 0);
  }, 0);

  const weeklyCompletedCount = DAYS_LIST.reduce((acc, day) => {
    const dayLog = effectiveLogs.find((l) => l.date === weekDates[day]);
    return acc + (dayLog?.status === 'completed' ? 1 : 0);
  }, 0);

  const weeklyRescheduledCount = DAYS_LIST.reduce((acc, day) => {
    const dayLog = effectiveLogs.find((l) => l.date === weekDates[day]);
    return acc + (dayLog?.status === 'rescheduled' ? 1 : 0);
  }, 0);

  return (
    <div className="space-y-6 min-w-0 w-full">
      <p role="status" aria-atomic="true" className="sr-only">
        {statusAnnouncement}
      </p>
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

            {onSyncGymWeekToGoogle && (
              <button
                type="button"
                onClick={isGoogleConnected ? onSyncGymWeekToGoogle : onOpenGoogleSync}
                disabled={isSyncingGymToGoogle}
                className="t-btn t-btn-secondary"
                title="Publicar tus sesiones de entrenamiento de esta semana en Google Calendar con avisos previos"
              >
                {isSyncingGymToGoogle ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-[var(--action)] shrink-0" aria-hidden="true" />
                ) : (
                  <CalendarCheck2 className="w-4 h-4 text-[var(--ok)] shrink-0" aria-hidden="true" />
                )}
                <span>
                  {isSyncingGymToGoogle
                    ? 'Sincronizando gym...'
                    : isGoogleConnected
                      ? 'Sincronizar Gym con Google'
                      : 'Conectar avisos Google'}
                </span>
              </button>
            )}

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

      {/* Weekly Adherence Telemetry Strip + Tactile Day Selector */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[13px] text-[var(--muted)]">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>
              Asistencia esta semana:{' '}
              <strong className="t-num font-semibold text-[var(--ink)]">
                {weeklyCompletedCount}/{weeklyPlannedCount}
              </strong>{' '}
              completadas
            </span>
            {weeklyRescheduledCount > 0 && (
              <span className="t-num">· {weeklyRescheduledCount} reprogramada{weeklyRescheduledCount > 1 ? 's' : ''}</span>
            )}
          </div>

          {pendingMissedDays.length > 0 && selectedDay !== pendingMissedDays[0].dayOfWeek && (
            <button
              type="button"
              onClick={() => {
                setPinnedMissDay(null);
                setSelectedDay(pendingMissedDays[0].dayOfWeek);
              }}
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--warn)] hover:underline cursor-pointer"
            >
              <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Registrar falta pendiente ({pendingMissedDays[0].dayOfWeek})</span>
            </button>
          )}
        </div>

        <div
          role="tablist"
          aria-label="Seleccionar día de entrenamiento"
          className="w-full max-w-full min-w-0 flex md:grid md:grid-cols-7 items-center gap-1.5 p-1.5 rounded-[16px] bg-[var(--surface-2)] border border-[var(--line)] overflow-x-auto no-scrollbar"
        >
          {DAYS_LIST.map((day) => {
            const isToday = day === todayDay;
            const isSelected = day === selectedDay;
            const dayDateIso = weekDates[day];
            const dayLog = effectiveLogs.find((l) => l.date === dayDateIso);
            const dayRoutine = routines.find((r) => r.dayOfWeek === day);
            const hasExercises = Boolean(dayRoutine && dayRoutine.exercises.length > 0);
            const isScheduledDay = gymProfile ? gymProfile.selectedDays.includes(day) : hasExercises;
            const isPendingMissTab = pendingMissedDays.some((p) => p.dayOfWeek === day);

            let statusIcon: React.ReactNode = null;
            let dayStatusLabel = 'descanso';
            if (dayLog?.status === 'completed') {
              statusIcon = <Check className="w-3.5 h-3.5 text-[var(--ok)] shrink-0" aria-hidden="true" />;
              dayStatusLabel = 'completada';
            } else if (isPendingMissTab) {
              statusIcon = (
                <AlertCircle className="w-3.5 h-3.5 text-[var(--warn)] shrink-0" aria-hidden="true" />
              );
              dayStatusLabel = 'falta pendiente por registrar';
            } else if (dayLog?.status === 'missed') {
              statusIcon = (
                <AlertCircle className="w-3.5 h-3.5 text-[var(--warn)] shrink-0" aria-hidden="true" />
              );
              dayStatusLabel = 'falta registrada';
            } else if (dayLog?.status === 'rescheduled') {
              statusIcon = (
                <CalendarClock className="w-3.5 h-3.5 text-[var(--muted)] shrink-0" aria-hidden="true" />
              );
              dayStatusLabel = 'reprogramada';
            } else if (dayLog?.status === 'in_progress') {
              statusIcon = <Clock className="w-3.5 h-3.5 text-[var(--action)] shrink-0" aria-hidden="true" />;
              dayStatusLabel = 'sesión en curso';
            } else if (isScheduledDay || hasExercises) {
              statusIcon = (
                <span
                  aria-hidden="true"
                  className="w-1.5 h-1.5 rounded-full shrink-0 bg-[var(--gym)]"
                />
              );
              dayStatusLabel = 'rutina programada';
            }

            return (
              <button
                key={day}
                type="button"
                role="tab"
                aria-selected={isSelected}
                aria-label={`${day}${isToday ? ' (Hoy)' : ''}: ${dayStatusLabel}`}
                onClick={() => {
                  setPinnedMissDay(null);
                  setSelectedDay(day);
                }}
                className={`min-h-[46px] min-w-[86px] md:min-w-0 px-3 py-2 rounded-[12px] text-[14px] font-medium inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer select-none transition-all focus-visible:outline-2 focus-visible:outline-[var(--action)] ${
                  isSelected
                    ? 'bg-[var(--surface)] text-[var(--ink)] border border-[var(--line-strong)] shadow-2xs'
                    : 'border border-transparent text-[var(--muted)] hover:text-[var(--ink)]'
                }`}
              >
                {statusIcon}
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
      </div>

      {/* Main Routine Gate / Missed Flow / Rest Day / Active Exercise Routine */}
      {activeMissFlow ? (
        <GymMissFlowCard
          key={activeMissFlow.dateIso}
          dayOfWeek={activeMissFlow.dayOfWeek}
          dateIso={activeMissFlow.dateIso}
          routine={activeMissFlow.routine}
          isRetroactive={activeMissFlow.isRetroactive}
          pendingCount={pendingMissedDays.length}
          initialStage={activeMissFlow.initialStage}
          existingReason={activeMissFlow.existingReason}
          goal={gymProfile?.goal}
          gymType={gymProfile?.gymType}
          customGymName={gymProfile?.customGymName}
          defaultReminderMinutes={gymProfile?.reminderMinutesBefore}
          rescheduleOptions={getRescheduleOptions(
            activeMissFlow.dayOfWeek,
            routines,
            gymProfile,
            weekDates,
            todayIso
          )}
          calendarBlocks={calendarBlocks}
          externalBusyByDate={externalBusyByDate}
          isGoogleConnected={isGoogleConnected}
          onOpenGoogleSync={onOpenGoogleSync}
          weekDates={weekDates}
          onCancel={() => setPinnedMissDay(null)}
          onSubmitMissReason={(payload) => {
            setStatusAnnouncement(
              `Inasistencia del ${payload.dayOfWeek} registrada. Elige cómo reprogramar tu semana.`
            );
            setPinnedMissDay({
              ...activeMissFlow,
              initialStage: 'encouragement_reschedule',
              existingReason: payload.reason,
            });
            if (onLogMissedWorkout) {
              onLogMissedWorkout({
                dayOfWeek: payload.dayOfWeek,
                dateIso: payload.dateIso,
                routineId: payload.routine.id,
                routineName: payload.routine.name,
                reason: payload.reason,
                note: payload.note,
                encouragementMessage: payload.encouragementMessage,
              });
            } else {
              upsertFallbackLog({
                id: `att-${payload.dateIso}-${payload.routine.id}`,
                date: payload.dateIso,
                dayOfWeek: payload.dayOfWeek,
                routineId: payload.routine.id,
                routineName: payload.routine.name,
                status: 'missed',
                missReason: payload.reason,
                missNote: payload.note,
                encouragementMessage: payload.encouragementMessage,
                streakProtected: true,
              });
            }
          }}
          onReschedule={(payload) => {
            if (onRescheduleWorkout) {
              onRescheduleWorkout(payload);
            } else {
              upsertFallbackLog({
                id: `att-${payload.fromDate}-${activeMissFlow.routine.id}`,
                date: payload.fromDate,
                dayOfWeek: payload.fromDay,
                routineId: activeMissFlow.routine.id,
                routineName: activeMissFlow.routine.name,
                status: 'rescheduled',
                missReason: activeMissFlow.existingReason,
                rescheduledToDay: payload.toDay,
                rescheduledToDate: weekDates[payload.toDay],
                rescheduledSlotStart: payload.selectedSlot?.startTime,
                rescheduledSlotEnd: payload.selectedSlot?.endTime,
                streakProtected: true,
              });
            }
            setStatusAnnouncement(
              payload.selectedSlot
                ? `Rutina reprogramada del ${payload.fromDay} al ${payload.toDay} (${payload.selectedSlot.startTime} – ${payload.selectedSlot.endTime}).`
                : `Rutina reprogramada del ${payload.fromDay} al ${payload.toDay}.`
            );
            setPinnedMissDay(null);
            triggerConfetti();
          }}
          onFinishWithoutReschedule={() => setPinnedMissDay(null)}
        />
      ) : selectedDayLog?.status === 'missed' || selectedDayLog?.status === 'rescheduled' ? (
        <GymMissedSummaryCard
          log={selectedDayLog}
          isToday={selectedDay === todayDay}
          canReschedule={selectedMissRescheduleOptions.length > 0}
          onGoToDay={(day) => {
            setPinnedMissDay(null);
            setSelectedDay(day);
          }}
          onOpenReschedule={() =>
            setPinnedMissDay({
              dayOfWeek: selectedDay,
              dateIso: selectedDateIso,
              routine: currentRoutine,
              isRetroactive: selectedDay !== todayDay,
              initialStage: 'encouragement_reschedule',
              existingReason: selectedDayLog.missReason,
            })
          }
          onOverrideStartToday={
            selectedDay === todayDay && currentRoutine.exercises.length > 0
              ? handleStartTodaySession
              : undefined
          }
        />
      ) : isConfiguredRestDay ? (
        <GymRestDayBanner
          selectedDay={selectedDay}
          nextTrainingDay={nextTrainingDay}
          goal={gymProfile?.goal}
          onSelectDay={(day) => {
            setPinnedMissDay(null);
            setSelectedDay(day);
          }}
          onAddExtraExercise={() => setShowAddForm(true)}
        />
      ) : shouldShowTodayStartGate ? (
        <GymStartGateCard
          routine={currentRoutine}
          dayOfWeek={selectedDay}
          dateIso={selectedDateIso}
          gymDisplayName={gymDisplayName}
          restSeconds={recommendedRestDuration}
          onStartSession={handleStartTodaySession}
          onReportMissed={() =>
            setPinnedMissDay({
              dayOfWeek: todayDay,
              dateIso: todayIso,
              routine: currentRoutine,
              isRetroactive: false,
              initialStage: 'reason',
            })
          }
        />
      ) : (
      <section className="t-card p-6">
        {/* Routine Header, Session Status & Progress */}
        <div className="pb-5 border-b border-[var(--line)]">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="t-badge t-badge-gym">{currentRoutine.tag}</span>
                <span className="text-[13px] text-[var(--muted)]">
                  · {selectedDay} ({formatShortSpanishDate(selectedDateIso)})
                </span>
                {isSessionInProgress && (
                  <span className="t-badge t-badge-accent">
                    <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>Sesión en curso</span>
                  </span>
                )}
                {selectedDayLog?.status === 'completed' && (
                  <span className="t-badge t-badge-ok t-num">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    Completado
                    {selectedDayLog.durationMinutes ? ` · ${selectedDayLog.durationMinutes} min` : ''}
                  </span>
                )}
                {selectedDateIso > todayIso && currentRoutine.exercises.length > 0 && (
                  <span className="t-badge">Próxima sesión · ~2h</span>
                )}
              </div>
              <h3 className="text-xl sm:text-2xl font-medium tracking-[-0.025em] text-[var(--ink)] leading-snug text-balance">
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

          {isSessionInProgress && (
            <div className="mt-4 pt-3.5 border-t border-[var(--line)] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 text-[13px] text-[var(--muted)]">
                <Clock className="w-4 h-4 text-[var(--action)] shrink-0" aria-hidden="true" />
                <span>Cronómetro de sesión (~2h objetivo)</span>
                <span className="t-num font-semibold text-[var(--ink)]">
                  {formatElapsedSeconds(elapsedSeconds)} / 02:00:00
                </span>
              </div>
              <div
                className="w-full sm:w-56 h-1.5 rounded-full bg-[var(--surface-2)] overflow-hidden"
                aria-hidden="true"
              >
                <div
                  className="h-full rounded-full bg-[var(--action)] transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.round((elapsedSeconds / 7200) * 100))}%` }}
                />
              </div>
            </div>
          )}
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
              {selectedDayLog?.status === 'completed'
                ? 'Entrenamiento registrado en tu historial de esta semana.'
                : progressPercent === 100
                ? 'Completaste todas las series programadas para este día.'
                : 'Registra tu entrenamiento al terminar para sumar un día más a tu racha.'}
            </p>
            <button
              type="button"
              onClick={handleCompleteTodayWorkout}
              className="t-btn t-btn-primary w-full sm:w-auto"
            >
              <Trophy className="w-4 h-4" />
              <span>
                {selectedDayLog?.status === 'completed'
                  ? 'Sesión completada'
                  : 'Terminar rutina de hoy'}
              </span>
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
        calendarBlocks={calendarBlocks}
        externalBusyByDate={externalBusyByDate}
        googleEvents={googleEvents}
        weekDates={weekDates}
        isGoogleConnected={isGoogleConnected}
        isGoogleSyncing={isGoogleSyncing || isSyncingGymToGoogle}
        onComplete={(payload) => {
          onSaveGymPlan?.(payload);
          setPinnedMissDay(null);
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
