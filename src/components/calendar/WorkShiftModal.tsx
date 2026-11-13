import React, { useId, useState } from 'react';
import {
  AlertTriangle,
  Briefcase,
  CalendarCheck2,
  Clock,
  Moon,
  Sparkles,
} from 'lucide-react';
import type { DayOfWeek, WorkShiftConfig } from '../../types';
import { ORDERED_DAYS } from '../../utils/routineGenerator';
import {
  DEFAULT_NIGHT_WORK_SHIFT,
  formatShiftDurationLabel,
  getNextDayOfWeek,
  isOvernightTimeRange,
} from '../../utils/workSchedule';
import { ModalShell } from '../common/ModalShell';
import { ReminderPresetPicker } from './ReminderPresetPicker';

export interface WorkShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  workShift: WorkShiftConfig;
  isGoogleConnected?: boolean;
  isSaving?: boolean;
  onOpenGoogleSync?: () => void;
  onSave: (config: WorkShiftConfig, options: { syncToGoogle: boolean }) => Promise<void> | void;
}

const DAY_PILLS: Array<{ day: DayOfWeek; short: string }> = [
  { day: 'Lunes', short: 'Lun' },
  { day: 'Martes', short: 'Mar' },
  { day: 'Miércoles', short: 'Mié' },
  { day: 'Jueves', short: 'Jue' },
  { day: 'Viernes', short: 'Vie' },
  { day: 'Sábado', short: 'Sáb' },
  { day: 'Domingo', short: 'Dom' },
];

interface FormBodyProps {
  initialConfig: WorkShiftConfig;
  isGoogleConnected: boolean;
  isSaving: boolean;
  onOpenGoogleSync?: () => void;
  onClose: () => void;
  onSave: (config: WorkShiftConfig, options: { syncToGoogle: boolean }) => Promise<void> | void;
}

const WorkShiftFormBody: React.FC<FormBodyProps> = ({
  initialConfig,
  isGoogleConnected,
  isSaving,
  onOpenGoogleSync,
  onClose,
  onSave,
}) => {
  const [enabled, setEnabled] = useState<boolean>(initialConfig.enabled);
  const [title, setTitle] = useState<string>(initialConfig.title);
  const [startTime, setStartTime] = useState<string>(initialConfig.startTime);
  const [endTime, setEndTime] = useState<string>(initialConfig.endTime);
  const [restDay, setRestDay] = useState<DayOfWeek | null>(initialConfig.restDay);
  const [location, setLocation] = useState<string>(initialConfig.location ?? '');
  const [reminderMinutes, setReminderMinutes] = useState<number[]>(
    initialConfig.reminderMinutes ?? [30]
  );
  const [syncWithGoogle, setSyncWithGoogle] = useState<boolean>(
    initialConfig.syncWithGoogle ?? true
  );
  const [errorMsg, setErrorMsg] = useState<string>('');

  const formId = useId();
  const titleId = useId();
  const startId = useId();
  const endId = useId();
  const locId = useId();
  const enabledId = useId();
  const syncId = useId();

  const sameTimeError = enabled && startTime.trim() === endTime.trim();
  const isOvernight = isOvernightTimeRange(startTime, endTime);
  const durationLabel = formatShiftDurationLabel(startTime, endTime);
  const workDaysCount = restDay ? ORDERED_DAYS.length - 1 : ORDERED_DAYS.length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (enabled && startTime.trim() === endTime.trim()) {
      setErrorMsg('La hora de salida debe ser distinta a la hora de entrada.');
      return;
    }

    setErrorMsg('');
    const nextConfig: WorkShiftConfig = {
      enabled,
      title: title.trim() || DEFAULT_NIGHT_WORK_SHIFT.title,
      startTime,
      endTime,
      restDay,
      location: location.trim() || undefined,
      reminderMinutes,
      syncWithGoogle,
    };

    await onSave(nextConfig, {
      syncToGoogle: Boolean(enabled && isGoogleConnected && syncWithGoogle),
    });
    onClose();
  };

  const applyNightPreset = () => {
    setEnabled(true);
    setTitle(DEFAULT_NIGHT_WORK_SHIFT.title);
    setStartTime('22:00');
    setEndTime('06:00');
    setRestDay('Jueves');
    setLocation('Turno madrugada');
    setErrorMsg('');
  };

  return (
    <>
      <form id={formId} onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        {/* Enable Toggle Card */}
        <label
          htmlFor={enabledId}
          className={`flex items-start justify-between gap-3 p-3.5 rounded-[12px] border cursor-pointer select-none transition-colors ${
            enabled
              ? 'border-[color-mix(in_oklab,var(--ok)_45%,var(--line))] bg-[color-mix(in_oklab,var(--ok)_8%,var(--surface))]'
              : 'border-[var(--line)] bg-[var(--surface-2)]'
          }`}
        >
          <div className="space-y-0.5">
            <span className="text-[14px] font-medium text-[var(--ink)] block">
              Activar turno laboral fijo en tu tablero
            </span>
            <span className="text-[13px] text-[var(--muted)] block leading-snug">
              Protege automáticamente estas horas frente a Gym, clases y eventos de Google Calendar.
            </span>
          </div>
          <input
            id={enabledId}
            type="checkbox"
            checked={enabled}
            onChange={(e) => {
              setEnabled(e.target.checked);
              setErrorMsg('');
            }}
            className="w-5 h-5 mt-0.5 rounded accent-[var(--action)] cursor-pointer shrink-0"
          />
        </label>

        {enabled && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[13px] text-[var(--muted)]">
                Configuración actual:{' '}
                <strong className="t-num text-[var(--ink)]">{workDaysCount} turnos/semana</strong>
              </span>
              <button
                type="button"
                onClick={applyNightPreset}
                className="t-btn t-btn-ghost text-[13px] px-2.5 min-h-[38px]"
              >
                <Sparkles className="w-3.5 h-3.5 text-[var(--action)] shrink-0" aria-hidden="true" />
                <span>Restaurar 22:00–06:00 (Descanso Jue)</span>
              </button>
            </div>

            <div>
              <label htmlFor={titleId} className="t-label">
                Nombre del turno
              </label>
              <input
                id={titleId}
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: Trabajo nocturno"
                className="t-input"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor={startId} className="t-label">
                  Hora de entrada
                </label>
                <input
                  id={startId}
                  type="time"
                  required
                  value={startTime}
                  onChange={(e) => {
                    setStartTime(e.target.value);
                    setErrorMsg('');
                  }}
                  className="t-input t-num"
                />
              </div>
              <div>
                <label htmlFor={endId} className="t-label">
                  Hora de salida
                </label>
                <input
                  id={endId}
                  type="time"
                  required
                  value={endTime}
                  onChange={(e) => {
                    setEndTime(e.target.value);
                    setErrorMsg('');
                  }}
                  className="t-input t-num"
                />
              </div>
            </div>

            {/* Overnight vs Daytime Status */}
            {sameTimeError || errorMsg ? (
              <div
                role="alert"
                className="rounded-[10px] border border-[var(--danger)] bg-[color-mix(in_oklab,var(--danger)_10%,var(--surface))] px-3 py-2.5 flex items-center gap-2 text-[13px] text-[var(--danger)]"
              >
                <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{errorMsg || 'La hora de salida debe ser distinta a la hora de entrada.'}</span>
              </div>
            ) : (
              <div className="rounded-[10px] border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2.5 flex items-start gap-2.5 text-[13px] text-[var(--ink)]">
                {isOvernight ? (
                  <Moon className="w-4 h-4 text-[var(--action)] shrink-0 mt-0.5" aria-hidden="true" />
                ) : (
                  <Clock className="w-4 h-4 text-[var(--ok)] shrink-0 mt-0.5" aria-hidden="true" />
                )}
                <div className="leading-snug">
                  {isOvernight ? (
                    <>
                      <span className="font-medium">Cruza medianoche (+1 día · </span>
                      <span className="t-num font-semibold">{durationLabel}</span>
                      <span className="font-medium"> por turno):</span>{' '}
                      <span className="text-[var(--muted)]">
                        entras a las <span className="t-num text-[var(--ink)]">{startTime}</span> y sales a las{' '}
                        <span className="t-num text-[var(--ink)]">{endTime}</span> de la mañana siguiente.
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="font-medium">Turno del mismo día (</span>
                      <span className="t-num font-semibold">{durationLabel}</span>
                      <span className="font-medium">):</span>{' '}
                      <span className="t-num text-[var(--muted)]">
                        {startTime} – {endTime}
                      </span>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Rest Day Selector */}
            <div className="space-y-2">
              <span className="t-label mb-0 block">Día de descanso</span>
              <div className="flex flex-wrap gap-1.5">
                {DAY_PILLS.map(({ day, short }) => {
                  const selected = restDay === day;
                  return (
                    <button
                      key={day}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setRestDay(day)}
                      className={`min-h-[44px] px-3 rounded-[10px] border text-[13px] font-medium cursor-pointer transition-colors ${
                        selected
                          ? 'bg-[var(--action)] text-[var(--action-ink)] border-[var(--action)]'
                          : 'bg-[var(--surface-2)] text-[var(--ink)] border-[var(--line)] hover:border-[var(--line-strong)]'
                      }`}
                    >
                      {short}
                    </button>
                  );
                })}
                <button
                  type="button"
                  aria-pressed={restDay === null}
                  onClick={() => setRestDay(null)}
                  className={`min-h-[44px] px-3 rounded-[10px] border text-[13px] font-medium cursor-pointer transition-colors ${
                    restDay === null
                      ? 'bg-[var(--action)] text-[var(--action-ink)] border-[var(--action)]'
                      : 'bg-[var(--surface-2)] text-[var(--muted)] border-[var(--line)] hover:text-[var(--ink)]'
                  }`}
                >
                  Sin descanso (7d)
                </button>
              </div>
              <p className="text-[13px] text-[var(--muted)] leading-relaxed">
                {restDay === null ? (
                  <>Trabajarás los 7 días ({startTime} – {endTime}).</>
                ) : isOvernight ? (
                  <>
                    No entras el <strong className="text-[var(--ink)]">{restDay} {startTime}</strong> hasta el{' '}
                    <strong className="text-[var(--ink)]">{getNextDayOfWeek(restDay)} {endTime}</strong>{' '}
                    (<span className="t-num">6</span> turnos/semana). Sí completas la salida de tu turno anterior a las{' '}
                    <span className="t-num">{endTime}</span> del {restDay}.
                  </>
                ) : (
                  <>
                    Descansas completo todo el <strong className="text-[var(--ink)]">{restDay}</strong> (<span className="t-num">6</span> turnos/semana).
                  </>
                )}
              </p>
            </div>

            <div>
              <label htmlFor={locId} className="t-label">
                Lugar o nota (opcional)
              </label>
              <input
                id={locId}
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Ej: Turno madrugada / Planta / Remoto"
                className="t-input"
              />
            </div>

            <div className="pt-2 border-t border-[var(--line)]">
              <ReminderPresetPicker
                compact
                value={reminderMinutes}
                onChange={setReminderMinutes}
                label="Alarma antes de entrar a trabajar"
                helperText="Se aplica como recordatorio popup si sincronizas tu turno a Google Calendar."
              />
            </div>

            {/* Google Calendar Sync Option */}
            <div className="pt-2 border-t border-[var(--line)] space-y-2">
              <label
                htmlFor={syncId}
                className="flex items-center justify-between gap-3 rounded-[10px] border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2.5 min-h-[44px] cursor-pointer select-none"
              >
                <span className="flex items-center gap-2 text-[13px] font-medium text-[var(--ink)]">
                  <CalendarCheck2 className="w-4 h-4 text-[var(--ok)] shrink-0" aria-hidden="true" />
                  <span>Sincronizar turnos con Google Calendar</span>
                </span>
                <input
                  id={syncId}
                  type="checkbox"
                  checked={syncWithGoogle}
                  onChange={(e) => setSyncWithGoogle(e.target.checked)}
                  className="w-4 h-4 rounded accent-[var(--action)] cursor-pointer shrink-0"
                />
              </label>

              {!isGoogleConnected && onOpenGoogleSync && (
                <div className="flex flex-wrap items-center justify-between gap-2 text-[13px] text-[var(--muted)]">
                  <span>Conecta tu cuenta Google para reflejar los turnos en tu celular.</span>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenGoogleSync();
                    }}
                    className="t-btn t-btn-ghost text-[13px] text-[var(--action)] px-2.5 min-h-[44px]"
                  >
                    Conectar Google Calendar
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </form>

      <div className="flex items-center justify-end gap-2.5 pt-4 mt-4 border-t border-[var(--line)]">
        <button type="button" onClick={onClose} className="t-btn t-btn-secondary">
          Cancelar
        </button>
        <button
          type="submit"
          form={formId}
          disabled={isSaving || sameTimeError}
          className="t-btn t-btn-primary"
        >
          <Briefcase className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>
            {isSaving
              ? 'Guardando turno...'
              : enabled && isGoogleConnected && syncWithGoogle
              ? 'Guardar y sincronizar Google'
              : 'Guardar turno'}
          </span>
        </button>
      </div>
    </>
  );
};

export const WorkShiftModal: React.FC<WorkShiftModalProps> = ({
  isOpen,
  onClose,
  workShift,
  isGoogleConnected = false,
  isSaving = false,
  onOpenGoogleSync,
  onSave,
}) => {
  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="Horario laboral recurrente"
      subtitle="Configura tu turno de madrugada, tu día de descanso y la sincronización automática."
      icon={<Briefcase className="w-4 h-4 text-[var(--ok)]" />}
      maxWidth="lg"
    >
      <WorkShiftFormBody
        key={`${isOpen ? 'open' : 'closed'}-${workShift.startTime}-${workShift.endTime}-${workShift.restDay ?? 'none'}-${String(workShift.enabled)}`}
        initialConfig={workShift}
        isGoogleConnected={isGoogleConnected}
        isSaving={isSaving}
        onOpenGoogleSync={onOpenGoogleSync}
        onClose={onClose}
        onSave={onSave}
      />
    </ModalShell>
  );
};
