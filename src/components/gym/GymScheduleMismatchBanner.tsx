import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  CalendarPlus,
  CalendarX2,
  Check,
  EyeOff,
  RefreshCw,
  Settings2,
  X,
} from 'lucide-react';
import type { GoogleCalendarEvent } from '../../services/googleCalendar';
import type {
  CalendarBlock,
  DayOfWeek,
  GymRoutine,
  GymSessionDurationMinutes,
  UserGymProfile,
} from '../../types';
import {
  minutesToTimeString,
  timeStringToMinutes,
  type BusyInterval,
  type FreeTwoHourSlot,
} from '../../utils/calendarSlotFinder';
import {
  formatShortSpanishDate,
  getRescheduleOptions,
  type RescheduleMode,
} from '../../utils/gymAttendance';
import {
  getDayFreeSuggestions,
  getManualStartOptionsForDuration,
  normalizeGymDurationMinutes,
  validateGymSlotAgainstCalendar,
} from '../../utils/gymSchedulePlanner';
import {
  findFreePermanentDayCandidates,
  type MissingScheduledGymDay,
} from '../../utils/gymScheduleSync';
import { getGymDisplayName } from '../../utils/routineGenerator';
import { SmartSlotReschedulePicker } from './SmartSlotReschedulePicker';

type RecoveryMode = 'this_week' | 'swap_fixed';

export interface GymScheduleMismatchBannerProps {
  missingDays: MissingScheduledGymDay[];
  selectedDay: DayOfWeek;
  gymProfile?: UserGymProfile;
  routines: GymRoutine[];
  calendarBlocks?: CalendarBlock[];
  externalBusyByDate?: Record<string, BusyInterval[]>;
  googleEvents?: GoogleCalendarEvent[];
  weekDates: Record<DayOfWeek, string>;
  todayIso: string;
  isGoogleConnected?: boolean;
  isSyncingAction?: boolean;
  onSelectCalendarDay?: (day: DayOfWeek) => void;
  onOpenFullScheduleEditor: () => void;
  onOpenGoogleSync?: () => void;
  onMoveThisWeek: (payload: {
    fromDay: DayOfWeek;
    fromDate: string;
    toDay: DayOfWeek;
    mode: RescheduleMode;
    selectedSlot?: {
      dateIso: string;
      startTime: string;
      endTime: string;
    };
  }) => Promise<void> | void;
  onSwapFixedDay: (payload: {
    fromDay: DayOfWeek;
    fromDate: string;
    toDay: DayOfWeek;
    slot: {
      startTime: string;
      endTime: string;
      durationMinutes: GymSessionDurationMinutes;
    };
  }) => Promise<void> | void;
  onRemoveFixedDay: (payload: {
    dayOfWeek: DayOfWeek;
    dateIso: string;
  }) => Promise<void> | void;
  onDismissDay: (dateIso: string, dayOfWeek: DayOfWeek) => void;
}

/**
 * Interactive recovery banner shown automatically inside the Gym workspace when
 * one or more scheduled training days are absent from Horario / Google Calendar.
 */
export const GymScheduleMismatchBanner: React.FC<GymScheduleMismatchBannerProps> = ({
  missingDays,
  selectedDay,
  gymProfile,
  routines,
  calendarBlocks = [],
  externalBusyByDate,
  googleEvents,
  weekDates,
  todayIso,
  isGoogleConnected = false,
  isSyncingAction = false,
  onSelectCalendarDay,
  onOpenFullScheduleEditor,
  onOpenGoogleSync,
  onMoveThisWeek,
  onSwapFixedDay,
  onRemoveFixedDay,
  onDismissDay,
}) => {
  const [focusedMissingDay, setFocusedMissingDay] = useState<DayOfWeek | null>(null);
  const [activeMode, setActiveMode] = useState<RecoveryMode | null>(null);
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  const [chosenThisWeekKey, setChosenThisWeekKey] = useState<string>('');
  const [chosenFixedTargetDay, setChosenFixedTargetDay] = useState<DayOfWeek | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string>('');
  const [manualStartTime, setManualStartTime] = useState<string>('');
  const [durationMinutes, setDurationMinutes] = useState<GymSessionDurationMinutes>(() =>
    normalizeGymDurationMinutes(gymProfile?.defaultSessionMinutes)
  );
  const [localError, setLocalError] = useState<string | null>(null);

  const activeMissing =
    (focusedMissingDay && missingDays.find((m) => m.dayOfWeek === focusedMissingDay)) ||
    missingDays.find((m) => m.dayOfWeek === selectedDay) ||
    missingDays[0];

  const thisWeekOptions = useMemo(() => {
    if (!activeMissing) return [];
    return getRescheduleOptions(
      activeMissing.dayOfWeek,
      routines,
      gymProfile,
      weekDates,
      todayIso
    );
  }, [activeMissing, routines, gymProfile, weekDates, todayIso]);

  const fixedDayCandidates = useMemo(() => {
    if (!activeMissing || activeMissing.isRescheduledInstance) return [];
    return findFreePermanentDayCandidates(
      gymProfile?.selectedDays ?? [],
      activeMissing.dayOfWeek
    );
  }, [activeMissing, gymProfile?.selectedDays]);

  const activeThisWeekOption =
    thisWeekOptions.find((o) => `${o.targetDay}::${o.mode}` === chosenThisWeekKey) ??
    thisWeekOptions[0];

  const activeFixedTargetDay =
    (chosenFixedTargetDay && fixedDayCandidates.includes(chosenFixedTargetDay)
      ? chosenFixedTargetDay
      : fixedDayCandidates[0]) ?? null;

  const resolvedTargetDay: DayOfWeek | null =
    activeMode === 'this_week'
      ? activeThisWeekOption?.targetDay ?? null
      : activeMode === 'swap_fixed'
        ? activeFixedTargetDay
        : null;

  const resolvedTargetDate: string =
    activeMode === 'this_week'
      ? activeThisWeekOption?.targetDate ?? ''
      : resolvedTargetDay
        ? weekDates[resolvedTargetDay]
        : '';

  const smartSlots = useMemo<FreeTwoHourSlot[]>(() => {
    if (!activeMode || !resolvedTargetDay || !resolvedTargetDate) return [];
    const sampleGymEvent = (googleEvents ?? []).find(
      (ev) => ev.isStudentOsGym || ev.studentOsCategory === 'gym'
    );
    const sampleStartMinutes = sampleGymEvent
      ? timeStringToMinutes(sampleGymEvent.startTime)
      : undefined;
    const inferredPeriod =
      sampleStartMinutes !== undefined
        ? sampleStartMinutes < 12 * 60
          ? 'manana'
          : sampleStartMinutes < 18 * 60
            ? 'tarde'
            : 'noche'
        : 'manana';
    return getDayFreeSuggestions({
      day: resolvedTargetDay,
      dateIso: resolvedTargetDate,
      preferredPeriod: inferredPeriod,
      durationMinutes,
      calendarBlocks,
      externalBusyByDate,
      googleEvents,
      weekDates,
      limit: 4,
    });
  }, [
    activeMode,
    resolvedTargetDay,
    resolvedTargetDate,
    durationMinutes,
    calendarBlocks,
    externalBusyByDate,
    googleEvents,
    weekDates,
  ]);

  const activeSlot = smartSlots.find((s) => s.id === selectedSlotId) ?? smartSlots[0];
  const manualStartOptions = useMemo(
    () => getManualStartOptionsForDuration(durationMinutes),
    [durationMinutes]
  );

  const manualSlotSelection = useMemo(() => {
    if (activeSlot || !resolvedTargetDay || !resolvedTargetDate) return null;
    const start = manualStartOptions.includes(manualStartTime)
      ? manualStartTime
      : manualStartOptions[0];
    if (!start) return null;
    const end = minutesToTimeString(timeStringToMinutes(start) + durationMinutes);
    const conflict = validateGymSlotAgainstCalendar({
      day: resolvedTargetDay,
      dateIso: resolvedTargetDate,
      startTime: start,
      durationMinutes,
      calendarBlocks,
      externalBusyByDate,
      googleEvents,
    });
    return { startTime: start, endTime: end, conflict };
  }, [
    activeSlot,
    resolvedTargetDay,
    resolvedTargetDate,
    manualStartOptions,
    manualStartTime,
    durationMinutes,
    calendarBlocks,
    externalBusyByDate,
    googleEvents,
  ]);

  if (!activeMissing) return null;

  const canMoveThisWeek = thisWeekOptions.length > 0;
  const canSwapFixed = !activeMissing.isRescheduledInstance && fixedDayCandidates.length > 0;
  const canRemoveFixed =
    !activeMissing.isRescheduledInstance && (gymProfile?.selectedDays.length ?? 0) > 1;
  const resolvedGymLocation = gymProfile
    ? getGymDisplayName(gymProfile.gymType, gymProfile.customGymName)
    : undefined;

  const resetDrawerState = () => {
    setActiveMode(null);
    setConfirmingRemove(false);
    setSelectedSlotId('');
    setManualStartTime('');
    setLocalError(null);
  };

  const toggleMode = (mode: RecoveryMode) => {
    setLocalError(null);
    setConfirmingRemove(false);
    if (activeMode === mode) {
      setActiveMode(null);
      return;
    }
    setDurationMinutes(
      normalizeGymDurationMinutes(
        activeMissing.preferredSlot?.durationMinutes ?? gymProfile?.defaultSessionMinutes
      )
    );
    setSelectedSlotId('');
    setManualStartTime('');
    setActiveMode(mode);
  };

  const handleConfirmMoveThisWeek = async () => {
    if (!activeThisWeekOption) return;
    setLocalError(null);
    const slotToUse = activeSlot
      ? {
          dateIso: activeSlot.dateIso,
          startTime: activeSlot.startTime,
          endTime: activeSlot.endTime,
        }
      : manualSlotSelection
        ? {
            dateIso: resolvedTargetDate,
            startTime: manualSlotSelection.startTime,
            endTime: manualSlotSelection.endTime,
          }
        : undefined;

    await onMoveThisWeek({
      fromDay: activeMissing.dayOfWeek,
      fromDate: activeMissing.dateIso,
      toDay: activeThisWeekOption.targetDay,
      mode: activeThisWeekOption.mode,
      selectedSlot: slotToUse,
    });
    resetDrawerState();
  };

  const handleConfirmSwapFixed = async () => {
    if (!activeFixedTargetDay) return;
    setLocalError(null);
    const startTime = activeSlot?.startTime ?? manualSlotSelection?.startTime;
    const endTime = activeSlot?.endTime ?? manualSlotSelection?.endTime;
    if (!startTime || !endTime) {
      setLocalError('Elige un horario para el nuevo día fijo semanal.');
      return;
    }
    await onSwapFixedDay({
      fromDay: activeMissing.dayOfWeek,
      fromDate: activeMissing.dateIso,
      toDay: activeFixedTargetDay,
      slot: {
        startTime,
        endTime,
        durationMinutes,
      },
    });
    resetDrawerState();
  };

  const formattedDate = formatShortSpanishDate(activeMissing.dateIso);

  return (
    <section
      role="alert"
      aria-labelledby="gym-schedule-mismatch-title"
      data-testid="gym-schedule-mismatch-banner"
      className="rounded-[18px] border border-[color-mix(in_oklab,var(--warn)_48%,var(--line))] bg-[color-mix(in_oklab,var(--warn)_8%,var(--surface))] p-4 sm:p-5 space-y-4 min-w-0"
    >
      {/* Header + Multi-day Switcher */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <span
            aria-hidden="true"
            className="w-10 h-10 rounded-[12px] bg-[color-mix(in_oklab,var(--warn)_18%,var(--surface))] border border-[color-mix(in_oklab,var(--warn)_38%,transparent)] flex items-center justify-center shrink-0 text-[var(--warn)]"
          >
            <AlertTriangle className="w-5 h-5" />
          </span>

          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2
                id="gym-schedule-mismatch-title"
                className="text-[15px] sm:text-[16px] font-semibold text-[var(--ink)] leading-snug"
              >
                Se modificó tu horario de entrenamiento
              </h2>
              <span className="t-badge border-[color-mix(in_oklab,var(--warn)_45%,transparent)] text-[var(--warn)] bg-[color-mix(in_oklab,var(--warn)_14%,var(--surface))] t-num">
                {missingDays.length === 1
                  ? '1 día sin bloque'
                  : `${missingDays.length} días sin bloque`}
              </span>
            </div>

            <p className="text-[14px] text-[var(--muted)] leading-relaxed">
              El entrenamiento del{' '}
              <strong className="font-semibold text-[var(--ink)]">
                {activeMissing.dayOfWeek} ({formattedDate})
              </strong>{' '}
              {activeMissing.preferredSlot
                ? `(${activeMissing.preferredSlot.startTime}–${activeMissing.preferredSlot.endTime}) `
                : ''}
              ya no está en {isGoogleConnected ? 'Google Calendar ni en tu horario' : 'tu horario'}.
              ¿Quieres modificar el día en el cual ya no está tu entrenamiento ({activeMissing.routineName})?
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onDismissDay(activeMissing.dateIso, activeMissing.dayOfWeek)}
          aria-label={`Ignorar aviso del ${activeMissing.dayOfWeek} por esta semana`}
          title="Ignorar por esta semana"
          className="min-w-[44px] min-h-[44px] rounded-[12px] inline-flex items-center justify-center text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] cursor-pointer shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-[var(--action)]"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      {/* Multi-day selector pills when >1 scheduled days disappeared */}
      {missingDays.length > 1 && (
        <div
          role="group"
          aria-label="Días faltantes en el calendario"
          className="flex flex-wrap items-center gap-2"
        >
          {missingDays.map((item) => {
            const isActive = item.dayOfWeek === activeMissing.dayOfWeek;
            return (
              <button
                key={item.dateIso}
                type="button"
                aria-pressed={isActive}
                onClick={() => {
                  setFocusedMissingDay(item.dayOfWeek);
                  onSelectCalendarDay?.(item.dayOfWeek);
                  resetDrawerState();
                }}
                className={`min-h-[44px] px-3.5 rounded-[12px] border text-[13px] font-medium inline-flex items-center gap-2 cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-[var(--action)] ${
                  isActive
                    ? 'bg-[var(--surface)] border-[var(--warn)] text-[var(--ink)] shadow-2xs'
                    : 'bg-[var(--surface-2)] border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)]'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-[var(--warn)] shrink-0" aria-hidden="true" />
                <span>{item.dayOfWeek}</span>
                <span className="text-[12px] text-[var(--muted)] t-num">
                  ({formatShortSpanishDate(item.dateIso)})
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Primary Action Strip (ui-ux-pro-max: clear recovery paths, >= 44px touch targets) */}
      <div className="flex flex-wrap items-center gap-2">
        {canMoveThisWeek && (
          <button
            type="button"
            disabled={isSyncingAction}
            aria-expanded={activeMode === 'this_week'}
            onClick={() => toggleMode('this_week')}
            data-testid="mismatch-action-move-week"
            className={`min-h-[44px] px-3.5 py-2 rounded-[12px] text-[14px] font-medium inline-flex items-center justify-center gap-2 border cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-[var(--action)] ${
              activeMode === 'this_week'
                ? 'bg-[var(--action)] text-[var(--action-ink)] border-[var(--action)]'
                : 'bg-[color-mix(in_oklab,var(--action)_10%,var(--surface))] border-[color-mix(in_oklab,var(--action)_42%,transparent)] text-[var(--ink)] hover:border-[var(--action)]'
            }`}
          >
            <CalendarClock className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Mover solo esta semana</span>
          </button>
        )}

        {canSwapFixed && (
          <button
            type="button"
            disabled={isSyncingAction}
            aria-expanded={activeMode === 'swap_fixed'}
            onClick={() => toggleMode('swap_fixed')}
            data-testid="mismatch-action-swap-fixed"
            className={`min-h-[44px] px-3.5 py-2 rounded-[12px] text-[14px] font-medium inline-flex items-center justify-center gap-2 border cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-[var(--action)] ${
              activeMode === 'swap_fixed'
                ? 'bg-[var(--action)] text-[var(--action-ink)] border-[var(--action)]'
                : 'bg-[var(--surface)] border-[var(--line-strong)] text-[var(--ink)] hover:border-[var(--action)]'
            }`}
          >
            <CalendarPlus className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Cambiar día fijo semanal</span>
          </button>
        )}

        {canRemoveFixed && (
          <button
            type="button"
            disabled={isSyncingAction}
            aria-expanded={confirmingRemove}
            onClick={() => {
              setActiveMode(null);
              setLocalError(null);
              setConfirmingRemove((prev) => !prev);
            }}
            data-testid="mismatch-action-remove-day"
            className={`min-h-[44px] px-3.5 py-2 rounded-[12px] text-[14px] font-medium inline-flex items-center justify-center gap-2 border cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-[var(--action)] ${
              confirmingRemove
                ? 'bg-[color-mix(in_oklab,var(--danger)_14%,var(--surface))] border-[color-mix(in_oklab,var(--danger)_48%,transparent)] text-[var(--danger)]'
                : 'bg-[var(--surface)] border-[var(--line-strong)] text-[var(--ink)] hover:border-[var(--danger)]'
            }`}
          >
            <CalendarX2 className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Quitar día del plan</span>
          </button>
        )}

        <button
          type="button"
          disabled={isSyncingAction}
          onClick={onOpenFullScheduleEditor}
          className="min-h-[44px] px-3.5 py-2 rounded-[12px] text-[14px] font-medium inline-flex items-center justify-center gap-2 border border-[var(--line-strong)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-[var(--action)]"
        >
          <Settings2 className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>Editar horario completo</span>
        </button>

        <button
          type="button"
          disabled={isSyncingAction}
          onClick={() => onDismissDay(activeMissing.dateIso, activeMissing.dayOfWeek)}
          data-testid="mismatch-action-dismiss"
          className="min-h-[44px] px-3.5 py-2 rounded-[12px] text-[14px] font-medium inline-flex items-center justify-center gap-2 text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-[var(--action)]"
        >
          <EyeOff className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>Ignorar esta semana</span>
        </button>
      </div>

      {!canMoveThisWeek && !canSwapFixed && (
        <p className="text-[13px] text-[var(--muted)]">
          Ya no quedan otros días libres esta semana. Usa{' '}
          <strong className="text-[var(--ink)]">Editar horario completo</strong> o{' '}
          <strong className="text-[var(--ink)]">Ignorar esta semana</strong>.
        </p>
      )}

      {/* Confirmation drawer for permanent weekday removal */}
      {confirmingRemove && canRemoveFixed && (
        <div
          data-testid="mismatch-remove-confirm-panel"
          className="rounded-[14px] border border-[color-mix(in_oklab,var(--danger)_38%,var(--line))] bg-[var(--surface)] p-4 space-y-3"
        >
          <p className="text-[14px] text-[var(--ink)] font-medium">
            ¿Quitar el {activeMissing.dayOfWeek} de tu plan fijo semanal?
          </p>
          <p className="text-[13px] text-[var(--muted)]">
            Tu frecuencia bajará a {(gymProfile?.selectedDays.length ?? 1) - 1} días por semana y{' '}
            {isGoogleConnected
              ? 'se cortará la serie recurrente (RRULE) de este día en Google Calendar conservando semanas anteriores.'
              : 'se actualizará tu horario semanal.'}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isSyncingAction}
              onClick={() =>
                void onRemoveFixedDay({
                  dayOfWeek: activeMissing.dayOfWeek,
                  dateIso: activeMissing.dateIso,
                })
              }
              data-testid="mismatch-confirm-remove-btn"
              className="min-h-[44px] px-4 rounded-[12px] bg-[var(--danger)] text-white dark:text-[#0a0d14] text-[14px] font-medium inline-flex items-center gap-2 cursor-pointer hover:opacity-95 focus-visible:outline-2 focus-visible:outline-[var(--action)]"
            >
              {isSyncingAction ? (
                <RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" />
              ) : (
                <Check className="w-4 h-4" aria-hidden="true" />
              )}
              <span>Sí, quitar {activeMissing.dayOfWeek} del plan</span>
            </button>

            <button
              type="button"
              onClick={() => setConfirmingRemove(false)}
              className="t-btn t-btn-secondary"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Inline Picker Drawer for Move This Week or Swap Fixed Weekday */}
      {(activeMode === 'this_week' || activeMode === 'swap_fixed') && (
        <div
          data-testid="mismatch-picker-panel"
          className="rounded-[16px] border border-[var(--line-strong)] bg-[var(--surface)] p-4 sm:p-5 space-y-4"
        >
          <div className="space-y-1">
            <h3 className="text-[14px] sm:text-[15px] font-semibold text-[var(--ink)]">
              {activeMode === 'this_week'
                ? `Reprogramar "${activeMissing.routineName}" solo por esta semana`
                : `Cambiar ${activeMissing.dayOfWeek} por otro día fijo semanal`}
            </h3>
            <p className="text-[13px] text-[var(--muted)]">
              {activeMode === 'this_week'
                ? 'Tu horario fijo de próximas semanas no cambiará y se conservarán todos tus ejercicios, pesos y récords (PR).'
                : `Se trasladará "${activeMissing.routineName}" con todos tus pesos/PRs al nuevo día y se actualizará tu serie recurrente (RRULE + UNTIL) en Google Calendar.`}
            </p>
          </div>

          {/* Target weekday selection */}
          {activeMode === 'this_week' ? (
            <div className="space-y-2">
              <p className="text-[13px] font-medium text-[var(--ink)]">
                1. Elige a qué día de esta semana pasarla
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {thisWeekOptions.map((opt) => {
                  const key = `${opt.targetDay}::${opt.mode}`;
                  const isChosen =
                    activeThisWeekOption?.targetDay === opt.targetDay &&
                    activeThisWeekOption?.mode === opt.mode;
                  return (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={isChosen}
                      onClick={() => {
                        setChosenThisWeekKey(key);
                        setSelectedSlotId('');
                        setManualStartTime('');
                      }}
                      className={`min-h-[48px] p-3 rounded-[12px] border text-left cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-[var(--action)] ${
                        isChosen
                          ? 'bg-[color-mix(in_oklab,var(--action)_10%,var(--surface))] border-[var(--action)]'
                          : 'bg-[var(--surface-2)] border-[var(--line)] hover:border-[var(--line-strong)]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[14px] font-semibold text-[var(--ink)]">
                          {opt.title} ({formatShortSpanishDate(opt.targetDate)})
                        </span>
                        <span className="t-badge text-[12px]">{opt.badge}</span>
                      </div>
                      <p className="text-[12px] text-[var(--muted)] mt-1">{opt.subtitle}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-[13px] font-medium text-[var(--ink)]">
                1. Elige el nuevo día fijo disponible en tu semana
              </p>
              <div className="flex flex-wrap gap-2">
                {fixedDayCandidates.map((candidate) => {
                  const isChosen = activeFixedTargetDay === candidate;
                  const candidateDate = weekDates[candidate];
                  const isNextWeekStart = candidateDate < todayIso;
                  return (
                    <button
                      key={candidate}
                      type="button"
                      aria-pressed={isChosen}
                      onClick={() => {
                        setChosenFixedTargetDay(candidate);
                        setSelectedSlotId('');
                        setManualStartTime('');
                      }}
                      className={`min-h-[44px] px-3.5 py-2 rounded-[12px] border text-[14px] font-medium inline-flex items-center gap-2 cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-[var(--action)] ${
                        isChosen
                          ? 'bg-[color-mix(in_oklab,var(--action)_12%,var(--surface))] border-[var(--action)] text-[var(--ink)]'
                          : 'bg-[var(--surface-2)] border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)]'
                      }`}
                    >
                      <span>{candidate}</span>
                      {isNextWeekStart && (
                        <span className="text-[12px] text-[var(--muted)]">(Próx. sem.)</span>
                      )}
                    </button>
                  );
                })}
              </div>
              {activeFixedTargetDay && weekDates[activeFixedTargetDay] < todayIso && (
                <p className="text-[12px] text-[var(--muted)]">
                  El {activeFixedTargetDay} de esta semana ya pasó; tu entrenamiento fijo se
                  sincronizará desde la próxima semana y tus ejercicios quedarán listos en la pestaña{' '}
                  <strong className="text-[var(--ink)]">{activeFixedTargetDay}</strong>.
                </p>
              )}
            </div>
          )}

          {/* Hour / duration smart picker */}
          {resolvedTargetDay && resolvedTargetDate && (
            <div className="pt-3 border-t border-[var(--line)] space-y-3">
              <SmartSlotReschedulePicker
                slots={smartSlots}
                selectedSlotId={activeSlot?.id ?? ''}
                onSelectSlot={(slot) => setSelectedSlotId(slot.id)}
                durationMinutes={durationMinutes}
                onChangeDurationMinutes={(mins) => {
                  setDurationMinutes(mins);
                  setSelectedSlotId('');
                }}
                routineName={activeMissing.routineName}
                gymLocation={resolvedGymLocation}
                isGoogleConnected={isGoogleConnected}
                onOpenGoogleSync={onOpenGoogleSync}
                legendText="2. Elige la hora en tu calendario sin cruces"
                emptyMessage={`No hay ventanas completamente libres de ${durationMinutes} min ese día; puedes elegir una hora manual abajo o acortar la duración.`}
              />

              {smartSlots.length === 0 && manualSlotSelection && (
                <div className="rounded-[12px] border border-[var(--line)] bg-[var(--surface-2)] p-3.5 space-y-2">
                  <label
                    htmlFor="mismatch-manual-start"
                    className="block text-[13px] font-medium text-[var(--ink)]"
                  >
                    Hora de inicio manual ({resolvedTargetDay})
                  </label>
                  <div className="flex flex-wrap items-center gap-3">
                    <select
                      id="mismatch-manual-start"
                      value={manualSlotSelection.startTime}
                      onChange={(e) => setManualStartTime(e.target.value)}
                      className="min-h-[44px] px-3 rounded-[10px] border border-[var(--line-strong)] bg-[var(--surface)] text-[14px] text-[var(--ink)] t-num"
                    >
                      {manualStartOptions.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt} → {minutesToTimeString(timeStringToMinutes(opt) + durationMinutes)}
                        </option>
                      ))}
                    </select>
                    {manualSlotSelection.conflict.hasConflict && (
                      <span className="text-[12px] text-[var(--warn)]">
                        Se cruza con{' '}
                        {manualSlotSelection.conflict.conflictTitle ?? 'otro bloque del horario'}.
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {localError && (
            <p className="text-[13px] text-[var(--danger)] font-medium">{localError}</p>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-[var(--line)]">
            <button
              type="button"
              onClick={resetDrawerState}
              className="t-btn t-btn-secondary"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={isSyncingAction || !resolvedTargetDay}
              onClick={() =>
                void (activeMode === 'this_week'
                  ? handleConfirmMoveThisWeek()
                  : handleConfirmSwapFixed())
              }
              data-testid="mismatch-confirm-save-btn"
              className="t-btn t-btn-primary"
            >
              {isSyncingAction ? (
                <RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" />
              ) : (
                <Check className="w-4 h-4" aria-hidden="true" />
              )}
              <span>
                {activeMode === 'this_week'
                  ? `Mover a ${resolvedTargetDay ?? ''} esta semana`
                  : `Cambiar día fijo a ${resolvedTargetDay ?? ''}`}
              </span>
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
