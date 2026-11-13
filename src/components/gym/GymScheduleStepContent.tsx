import React, { useId } from 'react';
import {
  AlertTriangle,
  Calendar,
  CalendarCheck2,
  CalendarSync,
  CheckCircle2,
  Clock,
  Sparkles,
  Sun,
  Sunset,
  Moon,
  Wand2,
} from 'lucide-react';
import type { CalendarBlock, DayOfWeek } from '../../types';
import type { GoogleCalendarEvent } from '../../services/googleCalendar';
import type { BusyInterval } from '../../utils/calendarSlotFinder';
import {
  getDayFreeSuggestions,
  getDayOccupiedTimeline,
  MANUAL_GYM_START_OPTIONS,
  type PreferredTrainingPeriod,
  type ScheduledGymSlotDraft,
} from '../../utils/gymSchedulePlanner';
import { minutesToTimeString, timeStringToMinutes } from '../../utils/calendarSlotFinder';

export interface GymScheduleStepContentProps {
  selectedDays: DayOfWeek[];
  preferredPeriod: PreferredTrainingPeriod;
  onChangePreferredPeriod: (period: PreferredTrainingPeriod) => void;
  slotDrafts: ScheduledGymSlotDraft[];
  onSelectSlotStart: (
    day: DayOfWeek,
    startTime: string,
    source: 'recommended' | 'custom'
  ) => void;
  onRecommendAll: () => void;
  calendarBlocks: CalendarBlock[];
  externalBusyByDate?: Record<string, BusyInterval[]>;
  googleEvents?: GoogleCalendarEvent[];
  weekDates: Record<DayOfWeek, string>;
  isGoogleConnected?: boolean;
  isGoogleSyncing?: boolean;
  showSubmitSummaryError?: boolean;
  summaryErrorRef?: React.RefObject<HTMLDivElement | null>;
}

const PERIOD_OPTIONS: Array<{
  id: PreferredTrainingPeriod;
  label: string;
  hint: string;
  Icon: React.FC<{ className?: string }>;
}> = [
  { id: 'auto', label: 'Automático', hint: 'Mejor horario', Icon: Sparkles },
  { id: 'manana', label: 'Mañana', hint: '07:00–12:00', Icon: Sun },
  { id: 'tarde', label: 'Tarde', hint: '14:00–18:00', Icon: Sunset },
  { id: 'noche', label: 'Noche', hint: '18:00–22:00', Icon: Moon },
];

export const GymScheduleStepContent: React.FC<GymScheduleStepContentProps> = ({
  selectedDays,
  preferredPeriod,
  onChangePreferredPeriod,
  slotDrafts,
  onSelectSlotStart,
  onRecommendAll,
  calendarBlocks,
  externalBusyByDate,
  googleEvents,
  weekDates,
  isGoogleConnected = false,
  isGoogleSyncing = false,
  showSubmitSummaryError = false,
  summaryErrorRef,
}) => {
  const baseId = useId();
  const conflictedDrafts = slotDrafts.filter((draft) => draft.hasConflict);

  const jumpToDayControl = (day: DayOfWeek) => {
    const el = document.getElementById(`${baseId}-select-${day}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.focus();
    }
  };

  return (
    <div className="space-y-5">
      {/* Encabezado + estado Google Calendar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[14px] font-medium text-[var(--ink)]">
            <CalendarCheck2 className="w-4 h-4 text-[var(--action)] shrink-0" aria-hidden="true" />
            <span>Elige tu horario diario sin cruces (bloques de 2h)</span>
          </div>
          <p className="text-[13px] text-[var(--muted)] leading-relaxed">
            Comparamos cada día con tu Google Calendar y tus clases/bloques en StudentOS para evitar traslapes.
          </p>
        </div>

        <div className="shrink-0">
          {isGoogleSyncing ? (
            <span role="status" aria-live="polite" className="t-badge t-badge-accent">
              <CalendarSync
                className="w-3.5 h-3.5 animate-spin motion-reduce:animate-none shrink-0"
                aria-hidden="true"
              />
              <span>Sincronizando Google Calendar...</span>
            </span>
          ) : isGoogleConnected ? (
            <span className="t-badge t-badge-ok">
              <CalendarCheck2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Anti-cruces Google activo</span>
            </span>
          ) : (
            <span className="t-badge">
              <Calendar className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Solo bloques locales</span>
            </span>
          )}
        </div>
      </div>

      {/* Preferencia de franja horaria + botón recomendar */}
      <div className="rounded-[14px] border border-[var(--line)] bg-[var(--surface-2)] p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span className="text-[13px] font-medium text-[var(--ink)]">
            ¿En qué momento prefieres entrenar?
          </span>

          <button
            type="button"
            onClick={onRecommendAll}
            className="t-btn t-btn-secondary min-h-[44px] px-3.5 text-[13px] font-semibold w-full sm:w-auto"
          >
            <Wand2 className="w-4 h-4 text-[var(--action)] shrink-0" aria-hidden="true" />
            <span>Recomendar horarios sin cruces</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {PERIOD_OPTIONS.map(({ id, label, hint, Icon }) => {
            const isSelected = preferredPeriod === id;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onChangePreferredPeriod(id)}
                className={`min-h-[48px] p-2.5 rounded-[12px] border text-left cursor-pointer transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-[var(--action)] focus-visible:outline-offset-2 ${
                  isSelected
                    ? 'bg-[color-mix(in_oklab,var(--action)_12%,var(--surface))] border-[var(--action)] text-[var(--ink)]'
                    : 'bg-[var(--surface)] border-[var(--line)] text-[var(--ink)] hover:border-[var(--line-strong)]'
                }`}
              >
                <div className="flex items-center gap-1.5 text-[13px] font-semibold">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isSelected ? 'text-[var(--action)]' : 'text-[var(--muted)]'
                    }`}
                    aria-hidden="true"
                  />
                  <span>{label}</span>
                </div>
                <p className="t-num text-[13px] text-[var(--muted)] mt-0.5">{hint}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Focusable Error Summary si intenta guardar con algún cruce activo */}
      {showSubmitSummaryError && conflictedDrafts.length > 0 && (
        <div
          ref={summaryErrorRef}
          tabIndex={-1}
          role="alert"
          className="rounded-[14px] border border-[var(--danger)] bg-[color-mix(in_oklab,var(--danger)_10%,var(--surface))] p-4 space-y-2.5 focus:outline-2 focus:outline-[var(--danger)]"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-[var(--danger)] shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-1">
              <p className="text-[14px] font-semibold text-[var(--ink)]">
                Corrige {conflictedDrafts.length} cruce{conflictedDrafts.length === 1 ? '' : 's'} de
                horario antes de guardar tu plan
              </p>
              <p className="text-[13px] text-[var(--muted)]">
                Selecciona uno de los huecos libres sugeridos o cambia la hora en los días marcados:
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {conflictedDrafts.map((draft) => (
              <button
                key={`summary-jump-${draft.day}`}
                type="button"
                onClick={() => jumpToDayControl(draft.day)}
                className="min-h-[44px] px-3 py-2 rounded-[10px] border border-[var(--danger)] bg-[var(--surface)] text-[13px] font-medium text-[var(--ink)] hover:bg-[var(--surface-2)] cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--action)]"
              >
                Ir a {draft.day} ({draft.conflictTitle})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tarjetas por cada día entrenable */}
      <div className="space-y-3">
        {selectedDays.map((day) => {
          const dateIso = weekDates[day] ?? '';
          const draft = slotDrafts.find((item) => item.day === day);
          const startTime = draft?.startTime ?? '18:00';
          const endTime = draft?.endTime ?? '20:00';
          const hasConflict = draft?.hasConflict ?? false;

          const occupiedItems = getDayOccupiedTimeline({
            day,
            dateIso,
            calendarBlocks,
            externalBusyByDate,
            googleEvents,
          });

          const freeSuggestions = getDayFreeSuggestions({
            day,
            dateIso,
            preferredPeriod,
            calendarBlocks,
            externalBusyByDate,
            googleEvents,
            weekDates,
            limit: 3,
          });

          const selectId = `${baseId}-select-${day}`;
          const errorId = `${baseId}-error-${day}`;

          return (
            <section
              key={day}
              aria-label={`Horario del ${day}`}
              className={`rounded-[14px] border p-4 space-y-3 transition-colors duration-150 motion-reduce:transition-none ${
                hasConflict
                  ? 'border-[var(--danger)] bg-[color-mix(in_oklab,var(--danger)_6%,var(--surface))]'
                  : 'border-[var(--line)] bg-[var(--surface)]'
              }`}
            >
              {/* Fila título del día + estado libre/cruce */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h4 className="text-[15px] font-semibold text-[var(--ink)]">{day}</h4>
                  {dateIso && (
                    <span className="t-num text-[13px] text-[var(--muted)]">{dateIso}</span>
                  )}
                </div>

                {hasConflict ? (
                  <span className="t-badge t-badge-danger">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>
                      Cruce con {draft?.conflictSource === 'google' ? 'Google' : 'StudentOS'}
                    </span>
                  </span>
                ) : (
                  <span className="t-badge t-badge-ok">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span className="t-num">
                      Elegido: {startTime}–{endTime}
                    </span>
                  </span>
                )}
              </div>

              {/* Tira visual compacta de ocupados reales */}
              <div className="space-y-1.5">
                <p className="text-[13px] font-medium text-[var(--muted)]">
                  Eventos ocupados ese día:
                </p>
                {occupiedItems.length === 0 ? (
                  <p className="text-[13px] text-[var(--muted)]">
                    Sin eventos ocupados registrados en este día.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {occupiedItems.map((item) => (
                      <span
                        key={item.id}
                        className={`t-badge ${
                          item.source === 'google' ? 't-badge-accent' : ''
                        } !whitespace-normal`}
                      >
                        {item.source === 'google' ? (
                          <CalendarCheck2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        ) : (
                          <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        )}
                        <span>
                          {item.source === 'google' ? 'Google' : 'StudentOS'}: {item.title} ·{' '}
                          <span className="t-num">
                            {item.isAllDay
                              ? 'Todo el día'
                              : `${item.startTime}–${item.endTime}`}
                          </span>
                        </span>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Chips rápidos de huecos libres 2h */}
              <div className="space-y-1.5">
                <p className="text-[13px] font-medium text-[var(--muted)]">
                  Huecos libres recomendados (2h):
                </p>
                {freeSuggestions.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {freeSuggestions.map((sug) => {
                      const isChipSelected =
                        startTime === sug.startTime && !hasConflict;
                      return (
                        <button
                          key={sug.id}
                          type="button"
                          aria-pressed={isChipSelected}
                          onClick={() => onSelectSlotStart(day, sug.startTime, 'recommended')}
                          className={`min-h-[44px] px-3 py-2 rounded-[10px] border text-[13px] font-medium cursor-pointer transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-[var(--action)] focus-visible:outline-offset-2 ${
                            isChipSelected
                              ? 'bg-[var(--action)] text-[var(--action-ink)] border-[var(--action)]'
                              : 'bg-[var(--surface-2)] text-[var(--ink)] border-[var(--line)] hover:border-[var(--line-strong)]'
                          }`}
                        >
                          <span className="t-num font-semibold">
                            {sug.startTime}–{sug.endTime}
                          </span>{' '}
                          <span className="opacity-85">· {sug.periodLabel}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[13px] text-[var(--warn)]">
                    No quedan ventanas completas de 2 horas sin cruce entre 07:00 y 22:00 ese día.
                  </p>
                )}
              </div>

              {/* Selector de hora personalizada + validación inline */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[var(--line)] items-end">
                <div>
                  <label htmlFor={selectId} className="t-label text-[13px]">
                    O escoge tu hora de inicio ({day})
                  </label>
                  <select
                    id={selectId}
                    value={startTime}
                    aria-invalid={hasConflict}
                    aria-describedby={hasConflict ? errorId : undefined}
                    onChange={(e) => onSelectSlotStart(day, e.target.value, 'custom')}
                    className="t-input t-num min-h-[48px]"
                  >
                    {MANUAL_GYM_START_OPTIONS.map((optStart) => {
                      const optEnd = minutesToTimeString(timeStringToMinutes(optStart) + 120);
                      return (
                        <option key={`${day}-opt-${optStart}`} value={optStart}>
                          {optStart} – {optEnd} (2 horas)
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="text-[13px] text-[var(--muted)] pb-2 sm:pb-3">
                  Bloque automático:{' '}
                  <span className="t-num font-semibold text-[var(--ink)]">
                    {startTime} – {endTime}
                  </span>{' '}
                  (se publicará en Horario y Google Calendar).
                </div>
              </div>

              {hasConflict && (
                <div
                  id={errorId}
                  role="alert"
                  className="flex items-start gap-2 rounded-[10px] border border-[color-mix(in_oklab,var(--danger)_35%,transparent)] bg-[var(--surface)] p-3 text-[13px] text-[var(--ink)]"
                >
                  <AlertTriangle
                    className="w-4 h-4 text-[var(--danger)] shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <span>
                    Este horario se cruza con{' '}
                    <strong>&ldquo;{draft?.conflictTitle}&rdquo;</strong> (
                    {draft?.conflictSource === 'google' ? 'Google Calendar' : 'StudentOS'}
                    {draft?.conflictStart && draft?.conflictEnd ? (
                      <>
                        {' '}
                        ·{' '}
                        <span className="t-num">
                          {draft.conflictStart}–{draft.conflictEnd}
                        </span>
                      </>
                    ) : null}
                    ). Elige uno de los huecos libres sugeridos o cambia la hora para continuar.
                  </span>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
};
