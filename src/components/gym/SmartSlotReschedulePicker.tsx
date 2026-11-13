import React, { useId } from 'react';
import {
  Calendar,
  CalendarClock,
  CheckCircle2,
  Clock,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import type { GymSessionDurationMinutes } from '../../types';
import {
  buildGoogleCalendarTemplateUrl,
  type FreeTwoHourSlot,
} from '../../utils/calendarSlotFinder';
import { formatShortSpanishDate } from '../../utils/gymAttendance';
import {
  formatGymDurationLabel,
  GYM_DURATION_OPTIONS,
} from '../../utils/gymSchedulePlanner';

export interface SmartSlotReschedulePickerProps {
  slots: FreeTwoHourSlot[];
  selectedSlotId: string;
  onSelectSlot: (slot: FreeTwoHourSlot) => void;
  durationMinutes?: GymSessionDurationMinutes;
  onChangeDurationMinutes?: (duration: GymSessionDurationMinutes) => void;
  routineName?: string;
  gymLocation?: string;
  isGoogleConnected?: boolean;
  onOpenGoogleSync?: () => void;
  legendText?: string;
  emptyMessage?: string;
}

export const SmartSlotReschedulePicker: React.FC<SmartSlotReschedulePickerProps> = ({
  slots,
  selectedSlotId,
  onSelectSlot,
  durationMinutes = 120,
  onChangeDurationMinutes,
  routineName,
  gymLocation,
  isGoogleConnected = false,
  onOpenGoogleSync,
  legendText,
  emptyMessage,
}) => {
  const baseId = useId();
  const radioGroupName = `${baseId}-smart-slot-group`;
  const durationLabel = formatGymDurationLabel(durationMinutes);
  const resolvedLegendText =
    legendText ?? `Elige un bloque libre de ${durationLabel} para reprogramar tu sesión`;
  const resolvedEmptyMessage =
    emptyMessage ??
    `No hay ventanas libres de ${durationLabel} entre las 06:00 y 22:00 en los días disponibles de esta semana.`;

  const activeSlot = slots.find((s) => s.id === selectedSlotId) ?? slots[0];
  const fallbackTemplateUrl =
    !isGoogleConnected && activeSlot
      ? buildGoogleCalendarTemplateUrl({
          title: routineName?.trim()
            ? `Gym: ${routineName.trim()}`
            : `Sesión de Gimnasio (${durationLabel})`,
          dateIso: activeSlot.dateIso,
          startTime: activeSlot.startTime,
          endTime: activeSlot.endTime,
          location: gymLocation,
          description: `Entrenamiento reprogramado (${activeSlot.day} ${activeSlot.startTime} – ${activeSlot.endTime}) desde StudentOS PRO MAX.`,
        })
      : null;

  return (
    <div className="space-y-3">
      <fieldset className="border-0 p-0 m-0 space-y-3">
        <legend className="text-[15px] font-semibold text-[var(--ink)] flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-[var(--action)] shrink-0" aria-hidden="true" />
          <span>{resolvedLegendText}</span>
        </legend>

        <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
          <p className="text-[13px] text-[var(--muted)] leading-snug">
            {isGoogleConnected
              ? 'Cruce verificado contra tu Horario semanal y Google Calendar.'
              : 'Calculado sobre tus bloques de Horario semanal (06:00 – 22:00).'}
          </p>

          {onOpenGoogleSync && (
            <button
              type="button"
              onClick={onOpenGoogleSync}
              className="t-btn t-btn-secondary min-h-[44px] px-3.5 text-[13px]"
            >
              <Calendar className="w-4 h-4 shrink-0 text-[var(--action)]" aria-hidden="true" />
              <span>
                {isGoogleConnected ? 'Sincronizar Google Calendar' : 'Conectar Google Calendar'}
              </span>
            </button>
          )}
        </div>

        {onChangeDurationMinutes && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-[12px] border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2.5">
            <span className="flex items-center gap-1.5 text-[13px] font-medium text-[var(--ink)]">
              <Clock className="w-3.5 h-3.5 text-[var(--action)] shrink-0" aria-hidden="true" />
              <span>Duración para esta recuperación</span>
            </span>
            <div
              role="group"
              aria-label="Duración para reprogramar sesión"
              className="grid grid-cols-3 sm:flex gap-1.5"
            >
              {GYM_DURATION_OPTIONS.map((mins) => {
                const isSelected = durationMinutes === mins;
                return (
                  <button
                    key={`resched-dur-${mins}`}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => onChangeDurationMinutes(mins)}
                    className={`min-h-[44px] px-3 py-1.5 rounded-[10px] border text-[13px] font-semibold t-num cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-[var(--action)] text-[var(--action-ink)] border-[var(--action)]'
                        : 'bg-[var(--surface)] text-[var(--ink)] border-[var(--line)] hover:border-[var(--line-strong)]'
                    }`}
                  >
                    {formatGymDurationLabel(mins)}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {slots.length > 0 ? (
          <div className="space-y-2">
            {slots.map((slot, index) => {
              const inputId = `${baseId}-slot-${slot.id}`;
              const isChecked = activeSlot?.id === slot.id;

              return (
                <div key={slot.id} className="relative">
                  <input
                    id={inputId}
                    type="radio"
                    name={radioGroupName}
                    value={slot.id}
                    checked={isChecked}
                    onChange={() => onSelectSlot(slot)}
                    className="sr-only peer"
                  />
                  <label
                    htmlFor={inputId}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-[14px] border cursor-pointer select-none transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-[var(--action)] peer-focus-visible:outline-offset-2 ${
                      isChecked
                        ? 'bg-[color-mix(in_oklab,var(--action)_10%,var(--surface))] border-[var(--action)]'
                        : 'bg-[var(--surface)] border-[var(--line-strong)] hover:bg-[var(--surface-2)]'
                    }`}
                  >
                    <span className="min-w-0 block space-y-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-[15px] font-semibold text-[var(--ink)]">
                          {slot.day}
                        </span>
                        <span className="text-[13px] t-num text-[var(--muted)]">
                          {formatShortSpanishDate(slot.dateIso)}
                        </span>
                        <span className="text-[14px] font-semibold t-num text-[var(--ink)]">
                          {slot.startTime} – {slot.endTime}
                        </span>
                        <span className="t-badge">{slot.periodLabel}</span>
                        {index === 0 && (
                          <span className="t-badge t-badge-accent">Sugerido</span>
                        )}
                      </span>

                      <span className="flex flex-wrap items-center gap-2">
                        <span className="t-badge t-badge-ok">
                          <ShieldCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                          <span>{slot.sourceBadge}</span>
                        </span>
                        <span className="text-[13px] text-[var(--muted)] leading-snug">
                          {slot.description}
                        </span>
                      </span>
                    </span>

                    <span
                      aria-hidden="true"
                      className={`w-5 h-5 rounded-full border shrink-0 flex items-center justify-center self-start sm:self-center ${
                        isChecked
                          ? 'border-[var(--action)] bg-[var(--action)] text-white'
                          : 'border-[var(--line-strong)] bg-[var(--surface-2)]'
                      }`}
                    >
                      {isChecked && <CheckCircle2 className="w-3.5 h-3.5" />}
                    </span>
                  </label>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-4 rounded-[14px] border border-[var(--line)] bg-[var(--surface)] space-y-1">
            <p className="text-[14px] font-medium text-[var(--ink)]">
              Sin ventanas de {durationLabel} disponibles
            </p>
            <p className="text-[13px] text-[var(--muted)] leading-relaxed">{resolvedEmptyMessage}</p>
          </div>
        )}
      </fieldset>

      {fallbackTemplateUrl && activeSlot && (
        <div className="pt-1 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line)]">
          <span className="text-[13px] text-[var(--muted)]">
            ¿Sin OAuth? Crea el recordatorio directo en tu cuenta:
          </span>
          <a
            href={fallbackTemplateUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="t-btn t-btn-ghost !whitespace-normal !py-2 text-center leading-snug min-h-[44px] px-3 text-[13px] text-[var(--action)]"
          >
            <ExternalLink className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>
              Abrir en Google Calendar ({activeSlot.startTime} – {activeSlot.endTime})
            </span>
          </a>
        </div>
      )}
    </div>
  );
};
