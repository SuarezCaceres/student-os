import React, { useId } from 'react';
import {
  AlertTriangle,
  Calendar,
  CalendarCheck2,
  CalendarSync,
  CheckCircle2,
  Clock,
  Repeat,
  Sparkles,
  Sun,
  Sunset,
  Moon,
  Trash2,
  Wand2,
} from 'lucide-react';
import type { CalendarBlock, DayOfWeek, GymSessionDurationMinutes } from '../../types';
import type {
  DeleteGoogleGymEventsResult,
  GoogleCalendarEvent,
} from '../../services/googleCalendar';
import type { BusyInterval } from '../../utils/calendarSlotFinder';
import {
  formatGymDurationLabel,
  getDayFreeSuggestions,
  getDayOccupiedTimeline,
  getManualStartOptionsForDuration,
  GYM_DURATION_OPTIONS,
  type PreferredTrainingPeriod,
  type ScheduledGymSlotDraft,
} from '../../utils/gymSchedulePlanner';
import { minutesToTimeString, timeStringToMinutes } from '../../utils/calendarSlotFinder';

export interface PreviousGymDisplayItem {
  id: string;
  day: DayOfWeek;
  startTime: string;
  endTime: string;
  source: 'google' | 'local';
}

export interface GymScheduleStepContentProps {
  selectedDays: DayOfWeek[];
  preferredPeriod: PreferredTrainingPeriod;
  onChangePreferredPeriod: (period: PreferredTrainingPeriod) => void;
  defaultDurationMinutes: GymSessionDurationMinutes;
  onChangeDefaultDurationMinutes: (duration: GymSessionDurationMinutes) => void;
  slotDrafts: ScheduledGymSlotDraft[];
  onSelectSlotStart: (
    day: DayOfWeek,
    startTime: string,
    source: 'recommended' | 'custom'
  ) => void;
  onSelectSlotDuration: (
    day: DayOfWeek,
    durationMinutes: GymSessionDurationMinutes
  ) => void;
  onRecommendAll: () => void;
  calendarBlocks: CalendarBlock[];
  externalBusyByDate?: Record<string, BusyInterval[]>;
  googleEvents?: GoogleCalendarEvent[];
  weekDates: Record<DayOfWeek, string>;
  isGoogleConnected?: boolean;
  isGoogleSyncing?: boolean;
  previousGymItems?: PreviousGymDisplayItem[];
  replacePreviousGymSchedule?: boolean;
  onToggleReplacePreviousGymSchedule?: (nextValue: boolean) => void;
  onClearPreviousGymBlocks?: () => Promise<void> | void;
  onOpenGoogleSync?: () => void;
  isClearingPreviousGym?: boolean;
  clearPreviousResult?: DeleteGoogleGymEventsResult | null;
  didClearPreviousGym?: boolean;
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
  { id: 'manana', label: 'Mañana', hint: '06:00–12:00', Icon: Sun },
  { id: 'tarde', label: 'Tarde', hint: '14:00–18:00', Icon: Sunset },
  { id: 'noche', label: 'Noche', hint: '18:00–22:00', Icon: Moon },
];

export const GymScheduleStepContent: React.FC<GymScheduleStepContentProps> = ({
  selectedDays,
  preferredPeriod,
  onChangePreferredPeriod,
  defaultDurationMinutes,
  onChangeDefaultDurationMinutes,
  slotDrafts,
  onSelectSlotStart,
  onSelectSlotDuration,
  onRecommendAll,
  calendarBlocks,
  externalBusyByDate,
  googleEvents,
  weekDates,
  isGoogleConnected = false,
  isGoogleSyncing = false,
  previousGymItems = [],
  replacePreviousGymSchedule = true,
  onToggleReplacePreviousGymSchedule,
  onClearPreviousGymBlocks,
  onOpenGoogleSync,
  isClearingPreviousGym = false,
  clearPreviousResult = null,
  didClearPreviousGym = false,
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

  const clearErrorBanner =
    clearPreviousResult &&
    (clearPreviousResult.status === 'auth_missing' ||
      clearPreviousResult.status === 'error' ||
      clearPreviousResult.status === 'partial') ? (
      <div
        role="alert"
        className="rounded-[12px] border border-[var(--danger)] bg-[color-mix(in_oklab,var(--danger)_10%,var(--surface))] px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2.5 text-[13px] text-[var(--ink)]"
      >
        <div className="flex items-start gap-2 min-w-0 flex-1">
          <AlertTriangle
            className="w-4 h-4 text-[var(--danger)] shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <span>{clearPreviousResult.message}</span>
        </div>
        {onOpenGoogleSync && (
          <button
            type="button"
            onClick={onOpenGoogleSync}
            className="min-h-[40px] px-3 py-1.5 rounded-[10px] border border-[var(--line-strong)] bg-[var(--surface)] text-[13px] font-semibold text-[var(--ink)] hover:border-[var(--action)] transition-colors shrink-0"
          >
            Abrir Google Sync
          </button>
        )}
      </div>
    ) : null;

  return (
    <div className="space-y-5">
      {/* Encabezado + estado Google Calendar */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 text-[14px] font-medium text-[var(--ink)]">
            <CalendarCheck2 className="w-4 h-4 text-[var(--action)] shrink-0" aria-hidden="true" />
            <span>Elige tu horario semanal sin cruces</span>
          </div>
          <p className="text-[13px] text-[var(--muted)] leading-relaxed">
            Cada día crea su propia serie recurrente semanal en Google Calendar con la duración exacta que elijas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          <span className="t-badge">
            <Repeat className="w-3.5 h-3.5 shrink-0 text-[var(--action)]" aria-hidden="true" />
            <span>Serie semanal</span>
          </span>
          {isGoogleSyncing ? (
            <span role="status" aria-live="polite" className="t-badge t-badge-accent">
              <CalendarSync
                className="w-3.5 h-3.5 animate-spin motion-reduce:animate-none shrink-0"
                aria-hidden="true"
              />
              <span>Sincronizando Google...</span>
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

      {/* Preferencia de franja horaria + duración global + botón recomendar */}
      <div className="rounded-[14px] border border-[var(--line)] bg-[var(--surface-2)] p-4 space-y-3.5">
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

        <div className="pt-3 border-t border-[var(--line)] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 text-[13px] font-medium text-[var(--ink)] min-w-0">
            <Clock className="w-4 h-4 text-[var(--action)] shrink-0" aria-hidden="true" />
            <span>Duración por sesión (aplicar a todos)</span>
          </div>

          <div
            role="group"
            aria-label="Duración global por sesión"
            className="grid grid-cols-3 sm:flex sm:flex-wrap gap-1.5"
          >
            {GYM_DURATION_OPTIONS.map((mins) => {
              const isSelected = defaultDurationMinutes === mins;
              return (
                <button
                  key={`global-duration-${mins}`}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => onChangeDefaultDurationMinutes(mins)}
                  className={`min-h-[44px] px-3.5 py-2 rounded-[10px] border text-[13px] font-semibold t-num cursor-pointer transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-[var(--action)] focus-visible:outline-offset-2 ${
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
      </div>

      {/* Gestión de horario anterior de gimnasio (Google Calendar + copias locales) */}
      {previousGymItems.length > 0 && (
        <div
          className="rounded-[14px] border border-[var(--line)] bg-[var(--surface-2)] p-4 space-y-3"
          data-testid="previous-gym-schedule-panel"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <CalendarSync className="w-4 h-4 text-[var(--action)] shrink-0" aria-hidden="true" />
              <span className="text-[13px] font-bold text-[var(--ink)]">
                Horario anterior de gimnasio ({previousGymItems.length}{' '}
                {previousGymItems.length === 1 ? 'sesión' : 'sesiones'})
              </span>
              <span
                className={`t-badge ${replacePreviousGymSchedule ? 't-badge-ok' : 't-badge-accent'}`}
              >
                {replacePreviousGymSchedule ? 'Se reemplazará al guardar' : 'Conservado'}
              </span>
            </div>

            {onClearPreviousGymBlocks && (
              <button
                type="button"
                onClick={() => void onClearPreviousGymBlocks()}
                disabled={isClearingPreviousGym}
                aria-label="Borrar horario anterior de gimnasio"
                className="min-h-[44px] inline-flex items-center gap-2 px-3 py-2 rounded-[10px] border border-[var(--danger)] bg-[var(--surface)] text-[13px] font-semibold text-[var(--danger)] hover:bg-[color-mix(in_oklab,var(--danger)_8%,var(--surface))] disabled:opacity-50 transition-colors"
              >
                <Trash2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>
                  {isClearingPreviousGym ? 'Borrando en Google...' : 'Borrar horario anterior'}
                </span>
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {previousGymItems.map((item) => (
              <span
                key={item.id}
                className="inline-flex items-center gap-1.5 rounded-[8px] border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-[13px] font-medium text-[var(--ink)] t-num"
              >
                <span>{item.day}</span>
                <span className="text-[var(--muted)]">
                  {item.startTime}–{item.endTime}
                </span>
                <span
                  className={`text-[12px] font-semibold ${
                    item.source === 'google' ? 'text-[var(--action)]' : 'text-[var(--warn)]'
                  }`}
                >
                  {item.source === 'google' ? 'Google' : 'Local'}
                </span>
              </span>
            ))}
          </div>

          {clearErrorBanner}

          {onToggleReplacePreviousGymSchedule && (
            <label
              htmlFor={`${baseId}-replace-prev-gym`}
              className="min-h-[44px] flex items-start gap-2.5 cursor-pointer select-none pt-0.5"
            >
              <input
                id={`${baseId}-replace-prev-gym`}
                type="checkbox"
                checked={replacePreviousGymSchedule}
                onChange={(e) => onToggleReplacePreviousGymSchedule(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-[var(--action)] shrink-0"
              />
              <span className="text-[13px] leading-snug text-[var(--muted)]">
                <strong className="font-semibold text-[var(--ink)] block">
                  Sobrescribir / reemplazar horario anterior de gimnasio y Google Calendar al guardar
                </strong>
                {replacePreviousGymSchedule
                  ? 'Tus sesiones anteriores de gym (en Google Calendar o locales) se cortarán desde este lunes (conservando el historial pasado) y no causan auto-cruces al cambiar p. ej. de 07:00–09:00 a 06:00–08:00.'
                  : 'Modo comparación activo: si eliges una hora que choca con tus sesiones anteriores de gym, aparecerá alerta de cruce por cada día.'}
              </span>
            </label>
          )}
        </div>
      )}

      {previousGymItems.length === 0 && clearErrorBanner}

      {didClearPreviousGym &&
        previousGymItems.length === 0 &&
        (!clearPreviousResult || clearPreviousResult.status === 'ok') && (
          <div
            role="status"
            className="rounded-[14px] border border-[var(--line)] bg-[var(--surface-2)] px-4 py-3 flex items-center gap-2.5 text-[13px] text-[var(--ink)]"
          >
            <CheckCircle2 className="w-4 h-4 text-[var(--action)] shrink-0" aria-hidden="true" />
            <span>
              {clearPreviousResult?.message ||
                'Horario anterior de gimnasio limpiado. Ya puedes asignar cada día desde las 06:00 sin auto-cruces.'}
            </span>
          </div>
        )}

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
          const durationMinutes: GymSessionDurationMinutes =
            draft?.durationMinutes ?? defaultDurationMinutes;
          const durationLabel = formatGymDurationLabel(durationMinutes);
          const startTime = draft?.startTime ?? '18:00';
          const endTime =
            draft?.endTime ??
            minutesToTimeString(timeStringToMinutes(startTime) + durationMinutes);
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
            durationMinutes,
            calendarBlocks,
            externalBusyByDate,
            googleEvents,
            weekDates,
            limit: 4,
          });

          const manualStartOptions = getManualStartOptionsForDuration(durationMinutes);
          const selectId = `${baseId}-select-${day}`;
          const durationLabelId = `${baseId}-duration-${day}`;
          const errorId = `${baseId}-error-${day}`;

          return (
            <section
              key={day}
              aria-label={`Horario del ${day}`}
              className={`rounded-[14px] border p-3.5 sm:p-4 space-y-3 transition-colors duration-150 motion-reduce:transition-none ${
                hasConflict
                  ? 'border-[var(--danger)] bg-[color-mix(in_oklab,var(--danger)_6%,var(--surface))]'
                  : 'border-[var(--line)] bg-[var(--surface)]'
              }`}
            >
              {/* Fila título del día + estado libre/cruce */}
              <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <h4 className="text-[15px] font-semibold text-[var(--ink)]">{day}</h4>
                  {dateIso && (
                    <span className="t-num text-[13px] text-[var(--muted)]">{dateIso}</span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                  {hasConflict ? (
                    <span className="t-badge t-badge-danger !whitespace-normal">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>
                        Cruce con {draft?.conflictSource === 'google' ? 'Google' : 'StudentOS'}
                      </span>
                    </span>
                  ) : (
                    <span className="t-badge t-badge-ok !whitespace-normal">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span className="t-num">
                        {startTime}–{endTime} ({durationLabel})
                      </span>
                    </span>
                  )}
                  <span className="t-badge" title="Se repite todas las semanas en Google Calendar">
                    <Repeat className="w-3 h-3 shrink-0 text-[var(--action)]" aria-hidden="true" />
                    <span>Semanal</span>
                  </span>
                </div>
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

              {/* Chips rápidos de huecos libres según duración elegida */}
              <div className="space-y-1.5">
                <p className="text-[13px] font-medium text-[var(--muted)]">
                  Huecos libres recomendados ({durationLabel}):
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
                    No quedan ventanas completas de {durationLabel} sin cruce entre 06:00 y 22:00 ese día. Prueba bajar la duración a 1 h 30 o 1 h.
                  </p>
                )}
              </div>

              {/* Selectores por día: Duración (1h / 1h30 / 2h) + Hora de inicio */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-2.5 border-t border-[var(--line)] items-end">
                <div className="md:col-span-5 min-w-0">
                  <span id={durationLabelId} className="t-label text-[13px]">
                    Duración ({day})
                  </span>
                  <div
                    role="group"
                    aria-labelledby={durationLabelId}
                    className="grid grid-cols-3 gap-1.5"
                  >
                    {GYM_DURATION_OPTIONS.map((mins) => {
                      const isActive = durationMinutes === mins;
                      return (
                        <button
                          key={`${day}-dur-${mins}`}
                          type="button"
                          aria-pressed={isActive}
                          aria-label={`Duración ${day}: ${formatGymDurationLabel(mins)}`}
                          onClick={() => onSelectSlotDuration(day, mins)}
                          className={`min-h-[44px] px-2 py-2 rounded-[10px] border text-[13px] font-semibold t-num cursor-pointer transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-[var(--action)] focus-visible:outline-offset-2 ${
                            isActive
                              ? 'bg-[var(--action)] text-[var(--action-ink)] border-[var(--action)]'
                              : 'bg-[var(--surface-2)] text-[var(--ink)] border-[var(--line)] hover:border-[var(--line-strong)]'
                          }`}
                        >
                          {formatGymDurationLabel(mins)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="md:col-span-7 min-w-0">
                  <label htmlFor={selectId} className="t-label text-[13px]">
                    Hora de inicio ({day})
                  </label>
                  <select
                    id={selectId}
                    value={startTime}
                    aria-invalid={hasConflict}
                    aria-describedby={hasConflict ? errorId : undefined}
                    onChange={(e) => onSelectSlotStart(day, e.target.value, 'custom')}
                    className="t-input t-num min-h-[44px]"
                  >
                    {manualStartOptions.map((optStart) => {
                      const optEnd = minutesToTimeString(
                        timeStringToMinutes(optStart) + durationMinutes
                      );
                      return (
                        <option key={`${day}-opt-${optStart}`} value={optStart}>
                          {optStart} – {optEnd} ({durationLabel})
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              <p className="text-[13px] text-[var(--muted)]">
                Serie semanal:{' '}
                <span className="t-num font-semibold text-[var(--ink)]">
                  cada {day} · {startTime} – {endTime} ({durationLabel})
                </span>{' '}
                en Google Calendar.
              </p>

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
