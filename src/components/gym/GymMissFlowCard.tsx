import React, { useEffect, useId, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  HeartHandshake,
  ShieldCheck,
} from 'lucide-react';
import type {
  DayOfWeek,
  FitnessGoal,
  GymRoutine,
  GymType,
  MissReasonId,
} from '../../types';
import {
  formatShortSpanishDate,
  getEncouragementFeedback,
  MISS_REASON_OPTIONS,
  type EncouragementFeedback,
  type RescheduleMode,
  type RescheduleOption,
} from '../../utils/gymAttendance';

export interface GymMissFlowCardProps {
  dayOfWeek: DayOfWeek;
  dateIso: string;
  routine: GymRoutine;
  isRetroactive: boolean;
  pendingCount?: number;
  initialStage?: 'reason' | 'encouragement_reschedule';
  existingReason?: MissReasonId;
  goal?: FitnessGoal;
  gymType?: GymType;
  customGymName?: string;
  rescheduleOptions: RescheduleOption[];
  onCancel?: () => void;
  onSubmitMissReason: (payload: {
    dayOfWeek: DayOfWeek;
    dateIso: string;
    routine: GymRoutine;
    reason: MissReasonId;
    note?: string;
    encouragementMessage: string;
  }) => void;
  onReschedule: (payload: {
    fromDay: DayOfWeek;
    fromDate: string;
    toDay: DayOfWeek;
    mode: RescheduleMode;
  }) => void;
  onFinishWithoutReschedule: () => void;
}

export const GymMissFlowCard: React.FC<GymMissFlowCardProps> = ({
  dayOfWeek,
  dateIso,
  routine,
  isRetroactive,
  pendingCount = 1,
  initialStage = 'reason',
  existingReason = 'estudios_examenes',
  goal,
  gymType,
  customGymName,
  rescheduleOptions,
  onCancel,
  onSubmitMissReason,
  onReschedule,
  onFinishWithoutReschedule,
}) => {
  const baseId = useId();
  const [stage, setStage] = useState<'reason' | 'encouragement_reschedule'>(initialStage);
  const [selectedReason, setSelectedReason] = useState<MissReasonId>(existingReason);
  const [missNote, setMissNote] = useState('');
  const [selectedOptionKey, setSelectedOptionKey] = useState<string>(() => {
    const first = rescheduleOptions[0];
    return first ? `${first.targetDay}::${first.mode}` : '';
  });

  const stageTwoHeadingRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    if (stage === 'encouragement_reschedule') {
      stageTwoHeadingRef.current?.focus();
    }
  }, [stage]);

  const encouragement: EncouragementFeedback = getEncouragementFeedback(
    selectedReason,
    goal,
    gymType,
    customGymName,
    dayOfWeek
  );

  const selectedOption = rescheduleOptions.find(
    (opt) => `${opt.targetDay}::${opt.mode}` === selectedOptionKey
  );

  const handleReasonFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const combinedEncouragement = `${encouragement.headline} ${encouragement.body}`;
    onSubmitMissReason({
      dayOfWeek,
      dateIso,
      routine,
      reason: selectedReason,
      note: missNote.trim() || undefined,
      encouragementMessage: combinedEncouragement,
    });
    if (rescheduleOptions.length > 0 && !selectedOptionKey) {
      setSelectedOptionKey(`${rescheduleOptions[0].targetDay}::${rescheduleOptions[0].mode}`);
    }
    setStage('encouragement_reschedule');
  };

  const handleRescheduleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOption) {
      onFinishWithoutReschedule();
      return;
    }
    onReschedule({
      fromDay: dayOfWeek,
      fromDate: dateIso,
      toDay: selectedOption.targetDay,
      mode: selectedOption.mode,
    });
  };

  return (
    <section className="t-card p-6 sm:p-8">
      <div className="max-w-2xl mx-auto">
        {stage === 'reason' ? (
          <form onSubmit={handleReasonFormSubmit} className="space-y-6">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="t-badge t-badge-warn">
                    {isRetroactive ? 'Sesión pendiente por registrar' : 'Inasistencia de hoy'}
                  </span>
                  <span className="t-badge">
                    {dayOfWeek} · {formatShortSpanishDate(dateIso)}
                  </span>
                  {isRetroactive && pendingCount > 1 && (
                    <span className="t-badge t-num">1 de {pendingCount}</span>
                  )}
                </div>

                {onCancel && !isRetroactive && (
                  <button
                    type="button"
                    onClick={onCancel}
                    className="t-btn t-btn-ghost min-h-[40px] px-3 text-[14px]"
                  >
                    <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                    <span>Volver</span>
                  </button>
                )}
              </div>

              <h2 className="text-xl sm:text-2xl font-semibold tracking-[-0.025em] text-[var(--ink)] leading-snug">
                {isRetroactive
                  ? `¿Por qué no pudiste ir el ${dayOfWeek}?`
                  : '¿Por qué no puedes entrenar hoy?'}
              </h2>
              <p className="text-[14px] text-[var(--muted)] mt-1.5 leading-relaxed">
                {isRetroactive ? (
                  <>
                    Antes de iniciar hoy, cuéntanos qué pasó con tu rutina{' '}
                    <span className="font-medium text-[var(--ink)]">{routine.name}</span> para
                    cuidar tu historial y ayudarte a recuperarla.
                  </>
                ) : (
                  <>
                    Registrar el motivo de <span className="font-medium text-[var(--ink)]">{routine.name}</span>{' '}
                    mantiene tu proceso realista y te permite reprogramarla sin perder ritmo.
                  </>
                )}
              </p>
            </div>

            <fieldset className="border-0 p-0 m-0">
              <legend className="text-[14px] font-medium text-[var(--ink)] mb-3">
                Selecciona el motivo principal
              </legend>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {MISS_REASON_OPTIONS.map((option) => {
                  const inputId = `${baseId}-reason-${option.id}`;
                  const isChecked = selectedReason === option.id;

                  return (
                    <div key={option.id} className="relative">
                      <input
                        id={inputId}
                        type="radio"
                        name={`${baseId}-miss-reason`}
                        value={option.id}
                        checked={isChecked}
                        onChange={() => setSelectedReason(option.id)}
                        className="sr-only peer"
                      />
                      <label
                        htmlFor={inputId}
                        className={`block h-full min-h-[64px] p-3.5 rounded-[14px] border cursor-pointer select-none transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-[var(--action)] peer-focus-visible:outline-offset-2 ${
                          isChecked
                            ? 'bg-[color-mix(in_oklab,var(--action)_10%,var(--surface))] border-[var(--action)]'
                            : 'bg-[var(--surface-2)] border-[var(--line-strong)] hover:border-[color-mix(in_oklab,var(--ink)_34%,transparent)]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-[14px] font-semibold text-[var(--ink)] leading-snug">
                            {option.label}
                          </span>
                          <span
                            aria-hidden="true"
                            className={`w-4 h-4 mt-0.5 rounded-full border shrink-0 flex items-center justify-center ${
                              isChecked
                                ? 'border-[var(--action)] bg-[var(--action)]'
                                : 'border-[var(--line-strong)] bg-[var(--surface)]'
                            }`}
                          >
                            {isChecked && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </span>
                        </div>
                        <p className="text-[13px] text-[var(--muted)] mt-1 leading-snug">
                          {option.description}
                        </p>
                      </label>
                    </div>
                  );
                })}
              </div>
            </fieldset>

            <div>
              <label htmlFor={`${baseId}-miss-note`} className="t-label">
                Nota breve (opcional)
              </label>
              <input
                id={`${baseId}-miss-note`}
                type="text"
                maxLength={140}
                value={missNote}
                onChange={(e) => setMissNote(e.target.value)}
                placeholder="Ej. Parcial de Algoritmos a las 7 pm o me dormí tarde"
                className="t-input"
              />
            </div>

            <div className="pt-2 border-t border-[var(--line)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-[13px] text-[var(--muted)]">
                Tu progreso acumulado en pesos y cargas permanece intacto.
              </p>
              <button
                type="submit"
                className="t-btn t-btn-primary !whitespace-normal !py-2.5 text-center leading-snug w-full sm:w-auto"
              >
                <span>Registrar motivo y continuar</span>
                <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-6">
            {/* Empathetic encouragement block */}
            <div
              role="status"
              aria-live="polite"
              className="p-5 rounded-[16px] bg-[var(--surface-2)] border border-[var(--line-strong)] space-y-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="t-badge t-badge-ok">
                  <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                  Racha protegida si reprogramas
                </span>
                <span className="t-badge">
                  {dayOfWeek} · {formatShortSpanishDate(dateIso)}
                </span>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-[12px] bg-[var(--surface)] border border-[var(--line)] flex items-center justify-center text-[var(--gym)] shrink-0 mt-0.5">
                  <HeartHandshake className="w-5 h-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <h2
                    ref={stageTwoHeadingRef}
                    tabIndex={-1}
                    className="text-lg sm:text-xl font-semibold tracking-[-0.02em] text-[var(--ink)] outline-none"
                  >
                    {encouragement.headline}
                  </h2>
                  <p className="text-[14px] text-[var(--muted)] mt-1.5 leading-relaxed">
                    {encouragement.body}
                  </p>
                  <p className="text-[13px] text-[var(--ink)] mt-2 font-medium leading-relaxed">
                    {encouragement.tip}
                  </p>
                </div>
              </div>
            </div>

            {/* Reschedule form */}
            <form onSubmit={handleRescheduleFormSubmit} className="space-y-4">
              {rescheduleOptions.length > 0 ? (
                <fieldset className="border-0 p-0 m-0">
                  <legend className="text-[15px] font-semibold text-[var(--ink)] flex items-center gap-2 mb-1">
                    <CalendarClock className="w-4 h-4 text-[var(--action)]" aria-hidden="true" />
                    <span>Reprogramar "{routine.name}" en esta semana (~2h)</span>
                  </legend>
                  <p className="text-[13px] text-[var(--muted)] mb-3">
                    Priorizamos tus días libres para no doblar dos rutinas en una sola jornada.
                  </p>

                  <div className="space-y-2">
                    {rescheduleOptions.map((option) => {
                      const key = `${option.targetDay}::${option.mode}`;
                      const inputId = `${baseId}-reschedule-${option.targetDay}-${option.mode}`;
                      const isChecked = selectedOptionKey === key;

                      return (
                        <div key={key} className="relative">
                          <input
                            id={inputId}
                            type="radio"
                            name={`${baseId}-reschedule-day`}
                            value={key}
                            checked={isChecked}
                            onChange={() => setSelectedOptionKey(key)}
                            className="sr-only peer"
                          />
                          <label
                            htmlFor={inputId}
                            className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 rounded-[14px] border cursor-pointer select-none transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-[var(--action)] peer-focus-visible:outline-offset-2 ${
                              isChecked
                                ? 'bg-[color-mix(in_oklab,var(--action)_10%,var(--surface))] border-[var(--action)]'
                                : 'bg-[var(--surface)] border-[var(--line-strong)] hover:bg-[var(--surface-2)]'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[15px] font-semibold text-[var(--ink)]">
                                  {option.title}
                                </span>
                                <span className="text-[13px] t-num text-[var(--muted)]">
                                  {formatShortSpanishDate(option.targetDate)}
                                </span>
                                <span
                                  className={`t-badge ${
                                    option.recommended ? 't-badge-ok' : 't-badge-accent'
                                  }`}
                                >
                                  {option.badge}
                                </span>
                              </div>
                              <p className="text-[13px] text-[var(--muted)] mt-1">
                                {option.subtitle}
                              </p>
                              {option.shiftSummary && option.shiftSummary.length > 0 && (
                                <p className="text-[13px] text-[var(--ink)] mt-1 t-num">
                                  Ajuste semanal: {option.shiftSummary.join(' · ')}
                                </p>
                              )}
                            </div>

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
                </fieldset>
              ) : (
                <div className="p-4 rounded-[14px] border border-[var(--line)] bg-[var(--surface)]">
                  <p className="text-[14px] font-medium text-[var(--ink)]">
                    Ya no quedan días disponibles esta semana para mover la sesión.
                  </p>
                  <p className="text-[13px] text-[var(--muted)] mt-1">
                    Descansa bien y retoma tu calendario el lunes con la mente despejada.
                  </p>
                </div>
              )}

              <div className="pt-2 border-t border-[var(--line)] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                {rescheduleOptions.length > 0 ? (
                  <>
                    <button
                      type="button"
                      onClick={onFinishWithoutReschedule}
                      className="t-btn t-btn-ghost !whitespace-normal !py-2.5 text-center leading-snug w-full sm:w-auto"
                    >
                      <span>{isRetroactive ? 'Solo registrar falta y seguir a hoy' : 'Descansar esta vez'}</span>
                    </button>

                    <button
                      type="submit"
                      className="t-btn t-btn-primary !whitespace-normal !py-2.5 text-center leading-snug w-full sm:w-auto"
                    >
                      <CalendarClock className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>Reprogramar rutina (~2h)</span>
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={onFinishWithoutReschedule}
                    className="t-btn t-btn-primary w-full sm:w-auto sm:ml-auto"
                  >
                    <span>{isRetroactive ? 'Continuar a hoy' : 'Entendido'}</span>
                  </button>
                )}
              </div>
            </form>
          </div>
        )}
      </div>
    </section>
  );
};
