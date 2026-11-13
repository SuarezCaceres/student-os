import React, { useState, useId } from 'react';
import {
  Dumbbell,
  Building2,
  Calendar,
  Target,
  Scale,
  ArrowLeft,
  ArrowRight,
  Check,
  AlertCircle,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import type { DayOfWeek, GymRoutine } from '../../types';
import { ModalShell } from '../common/ModalShell';
import {
  GYM_CATALOG,
  GOAL_CATALOG,
  EXPERIENCE_OPTIONS,
  ORDERED_DAYS,
  DEFAULT_DAYS_BY_COUNT,
  getSplitTitleByDays,
  calculateBmi,
  generateAdaptiveRoutines,
} from '../../utils/routineGenerator';
import type {
  UserGymProfile,
  GymType,
  FitnessGoal,
  FitnessExperience,
  BmiCategory,
} from '../../utils/routineGenerator';

export interface GymOnboardingCompletePayload {
  profile: UserGymProfile;
  generatedRoutines: GymRoutine[];
  replaceRoutines: boolean;
}

export interface GymOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialProfile?: UserGymProfile;
  hasExistingRoutines?: boolean;
  onComplete: (payload: GymOnboardingCompletePayload) => void;
}

const TOTAL_STEPS = 4;

const STEP_LABELS: Record<number, string> = {
  1: 'Tu gimnasio',
  2: 'Frecuencia y días',
  3: 'Objetivo y nivel',
  4: 'Perfil físico e IMC',
};

const FREQUENCY_OPTIONS = [2, 3, 4, 5, 6] as const;

function getBmiBadgeClass(category: BmiCategory): string {
  switch (category) {
    case 'normal':
      return 't-badge t-badge-ok';
    case 'bajo_peso':
    case 'sobrepeso':
      return 't-badge t-badge-warn';
    case 'obesidad':
      return 't-badge t-badge-danger';
  }
}

function getBmiMarkerPercent(bmi: number): number {
  // Maps BMI range [15 .. 35] cleanly onto [2% .. 98%] across the 4 visual segments
  const clamped = Math.max(15, Math.min(35, bmi));
  return Number((((clamped - 15) / 20) * 100).toFixed(1));
}

export const GymOnboardingModal: React.FC<GymOnboardingModalProps> = ({
  isOpen,
  onClose,
  initialProfile,
  hasExistingRoutines = false,
  onComplete,
}) => {
  if (!isOpen) return null;

  return (
    <GymOnboardingModalContent
      isOpen={isOpen}
      onClose={onClose}
      initialProfile={initialProfile}
      hasExistingRoutines={hasExistingRoutines}
      onComplete={onComplete}
    />
  );
};

const GymOnboardingModalContent: React.FC<GymOnboardingModalProps> = ({
  isOpen,
  onClose,
  initialProfile,
  hasExistingRoutines = false,
  onComplete,
}) => {
  const formId = useId();

  const [step, setStep] = useState<number>(1);
  const [gymType, setGymType] = useState<GymType>(initialProfile?.gymType ?? 'smart_fit');
  const [customGymName, setCustomGymName] = useState<string>(initialProfile?.customGymName ?? '');
  const [trainingDaysCount, setTrainingDaysCount] = useState<number>(
    initialProfile?.trainingDaysCount ?? 4
  );
  const [selectedDays, setSelectedDays] = useState<DayOfWeek[]>(
    initialProfile?.selectedDays ?? DEFAULT_DAYS_BY_COUNT[4]
  );
  const [goal, setGoal] = useState<FitnessGoal>(initialProfile?.goal ?? 'hipertrofia');
  const [experience, setExperience] = useState<FitnessExperience>(
    initialProfile?.experience ?? 'intermedio'
  );
  const [heightCm, setHeightCm] = useState<string>(
    String(initialProfile?.heightCm ?? 174)
  );
  const [weightKg, setWeightKg] = useState<string>(
    String(initialProfile?.weightKg ?? 72)
  );
  const [targetWeightKg, setTargetWeightKg] = useState<string>(
    initialProfile?.targetWeightKg ? String(initialProfile.targetWeightKg) : ''
  );
  const [replaceRoutines, setReplaceRoutines] = useState<boolean>(!initialProfile);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const parsedHeight = Number(heightCm);
  const parsedWeight = Number(weightKg);
  const isValidMetrics =
    Number.isFinite(parsedHeight) &&
    parsedHeight >= 110 &&
    parsedHeight <= 240 &&
    Number.isFinite(parsedWeight) &&
    parsedWeight >= 30 &&
    parsedWeight <= 250;

  const liveBmi = isValidMetrics
    ? calculateBmi(parsedWeight, parsedHeight)
    : { bmi: 0, category: 'normal' as BmiCategory, label: 'Ingresa tus medidas' };

  const handleSelectFrequency = (count: number) => {
    setTrainingDaysCount(count);
    setSelectedDays(DEFAULT_DAYS_BY_COUNT[count] || DEFAULT_DAYS_BY_COUNT[3]);
    setErrorMsg(null);
  };

  const handleToggleDay = (day: DayOfWeek) => {
    setErrorMsg(null);
    setSelectedDays((prev) => {
      if (prev.includes(day)) {
        return prev.filter((d) => d !== day);
      }
      return ORDERED_DAYS.filter((d) => prev.includes(d) || d === day);
    });
  };

  const handleNextStep = () => {
    setErrorMsg(null);

    if (step === 1 && gymType === 'otro' && !customGymName.trim()) {
      setErrorMsg('Escribe el nombre de tu gimnasio para continuar.');
      return;
    }

    if (step === 2 && selectedDays.length !== trainingDaysCount) {
      setErrorMsg(
        `Seleccionaste ${selectedDays.length} ${
          selectedDays.length === 1 ? 'día' : 'días'
        }. Elige exactamente ${trainingDaysCount} días o cambia tu frecuencia semanal.`
      );
      return;
    }

    if (step < TOTAL_STEPS) {
      setStep((s) => s + 1);
    }
  };

  const handlePrevStep = () => {
    setErrorMsg(null);
    if (step > 1) {
      setStep((s) => s - 1);
    } else {
      onClose();
    }
  };

  const handleSubmitPlan = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!isValidMetrics) {
      setErrorMsg('Ingresa una altura válida (110–240 cm) y un peso válido (30–250 kg).');
      return;
    }

    const parsedTarget =
      targetWeightKg.trim() !== '' && Number(targetWeightKg) > 30
        ? Number(targetWeightKg)
        : undefined;

    const bmiInfo = calculateBmi(parsedWeight, parsedHeight);

    const profile: UserGymProfile = {
      gymType,
      customGymName: gymType === 'otro' ? customGymName.trim() : undefined,
      trainingDaysCount,
      selectedDays,
      goal,
      experience,
      heightCm: parsedHeight,
      weightKg: parsedWeight,
      targetWeightKg: parsedTarget,
      bmi: bmiInfo.bmi,
      bmiCategory: bmiInfo.category,
      configuredAt: new Date().toISOString().split('T')[0],
    };

    const generatedRoutines = generateAdaptiveRoutines(profile);

    onComplete({
      profile,
      generatedRoutines,
      replaceRoutines: !hasExistingRoutines || replaceRoutines,
    });
  };

  const stepProgressPercent = Math.round((step / TOTAL_STEPS) * 100);

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      badge={`Paso ${step} de ${TOTAL_STEPS} · ${STEP_LABELS[step]}`}
      title={
        initialProfile
          ? 'Actualizar mi perfil y plan de gimnasio'
          : 'Configura tu gimnasio y plan semanal'
      }
      subtitle="Personaliza tus rutinas, descansos y cálculo de IMC en menos de un minuto."
      icon={<Dumbbell className="w-5 h-5" />}
      maxWidth="2xl"
      footer={
        <>
          <button
            type="button"
            onClick={handlePrevStep}
            className="t-btn t-btn-secondary"
          >
            {step > 1 ? (
              <>
                <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                <span>Anterior</span>
              </>
            ) : (
              <span>Cancelar</span>
            )}
          </button>

          {step < TOTAL_STEPS ? (
            <button
              type="button"
              onClick={handleNextStep}
              className="t-btn t-btn-primary"
            >
              <span>Continuar</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="submit"
              form={`${formId}-onboarding-form`}
              className="t-btn t-btn-primary"
            >
              <Check className="w-4 h-4" aria-hidden="true" />
              <span>Guardar perfil y rutina</span>
            </button>
          )}
        </>
      }
    >
      <form
        id={`${formId}-onboarding-form`}
        onSubmit={handleSubmitPlan}
        className="space-y-6"
      >
        {/* Step Progress Bar (UI/UX Pro Max: clear multi-step progress) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[13px]">
            <span className="font-medium text-[var(--ink)]">{STEP_LABELS[step]}</span>
            <span className="t-num text-[var(--muted)]">
              Paso {step}/{TOTAL_STEPS} · {stepProgressPercent}%
            </span>
          </div>
          <div
            className="w-full h-1.5 rounded-full bg-[var(--surface-2)] overflow-hidden"
            role="progressbar"
            aria-valuenow={step}
            aria-valuemin={1}
            aria-valuemax={TOTAL_STEPS}
            aria-label={`Progreso de configuración: paso ${step} de ${TOTAL_STEPS}`}
          >
            <div
              className="h-full rounded-full bg-[var(--action)] transition-all duration-200"
              style={{ width: `${stepProgressPercent}%` }}
            />
          </div>
        </div>

        {/* Inline Error Message */}
        {errorMsg && (
          <div
            role="alert"
            className="flex items-start gap-2.5 p-3.5 rounded-[12px] border border-[color-mix(in_oklab,var(--danger)_35%,transparent)] bg-[color-mix(in_oklab,var(--danger)_10%,var(--surface))] text-[14px] text-[var(--ink)]"
          >
            <AlertCircle className="w-4 h-4 text-[var(--danger)] shrink-0 mt-0.5" aria-hidden="true" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* STEP 1: GYM SELECTION */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-[14px] font-medium text-[var(--ink)]">
              <Building2 className="w-4 h-4 text-[var(--action)]" aria-hidden="true" />
              <span>¿A qué gimnasio vas normalmente?</span>
            </div>
            <p className="text-[14px] text-[var(--muted)]">
              Adaptaremos las máquinas, pesos libres o ejercicios con peso corporal según tu sede. Solo se configura una vez.
            </p>

            <div
              role="radiogroup"
              aria-label="Seleccionar gimnasio"
              className="grid grid-cols-1 sm:grid-cols-2 gap-3"
            >
              {GYM_CATALOG.map((option) => {
                const isSelected = gymType === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => {
                      setGymType(option.id);
                      setErrorMsg(null);
                    }}
                    className={`min-h-[68px] p-4 rounded-[12px] border text-left cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-[var(--action)] focus-visible:outline-offset-2 ${
                      isSelected
                        ? 'bg-[color-mix(in_oklab,var(--action)_10%,var(--surface))] border-[var(--action)]'
                        : 'bg-[var(--surface)] border-[var(--line)] hover:border-[var(--line-strong)]'
                    } ${option.id === 'otro' ? 'sm:col-span-2' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[15px] font-medium text-[var(--ink)]">
                        {option.name}
                      </span>
                      {isSelected && (
                        <Check className="w-4 h-4 text-[var(--action)] shrink-0" aria-hidden="true" />
                      )}
                    </div>
                    <p className="text-[13px] text-[var(--muted)] mt-1">
                      {option.equipmentNote}
                    </p>
                  </button>
                );
              })}
            </div>

            {gymType === 'otro' && (
              <div className="pt-1">
                <label htmlFor={`${formId}-custom-gym`} className="t-label">
                  Nombre de tu gimnasio
                </label>
                <input
                  id={`${formId}-custom-gym`}
                  type="text"
                  placeholder="Ej. Bodytech Miraflores, Gold's Gym, Sportlife..."
                  value={customGymName}
                  onChange={(e) => {
                    setCustomGymName(e.target.value);
                    setErrorMsg(null);
                  }}
                  className="t-input"
                />
              </div>
            )}
          </div>
        )}

        {/* STEP 2: WEEKLY FREQUENCY & SPECIFIC DAYS */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <div className="flex items-center gap-2 text-[14px] font-medium text-[var(--ink)] mb-1">
                <Calendar className="w-4 h-4 text-[var(--action)]" aria-hidden="true" />
                <span>¿Cuántos días a la semana quieres entrenar?</span>
              </div>
              <p className="text-[14px] text-[var(--muted)]">
                Según tu disponibilidad, organizaremos la división muscular ideal para ti.
              </p>
            </div>

            <div
              role="radiogroup"
              aria-label="Días de entrenamiento por semana"
              className="grid grid-cols-5 gap-2"
            >
              {FREQUENCY_OPTIONS.map((count) => {
                const isSelected = trainingDaysCount === count;
                return (
                  <button
                    key={count}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => handleSelectFrequency(count)}
                    className={`min-h-[56px] px-2 py-2.5 rounded-[12px] border flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-[var(--action)] focus-visible:outline-offset-2 ${
                      isSelected
                        ? 'bg-[var(--action)] text-[var(--action-ink)] border-[var(--action)]'
                        : 'bg-[var(--surface)] text-[var(--ink)] border-[var(--line)] hover:border-[var(--line-strong)]'
                    }`}
                  >
                    <span className="t-num text-[18px] font-semibold leading-none">
                      {count}
                    </span>
                    <span
                      className={`text-[13px] ${
                        isSelected ? 'text-[var(--action-ink)] opacity-90' : 'text-[var(--muted)]'
                      }`}
                    >
                      días
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Split Recommendation Preview */}
            <div className="p-4 rounded-[12px] border border-[var(--line)] bg-[var(--surface-2)] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-[13px] text-[var(--muted)]">División asignada</span>
              <span className="text-[14px] font-medium text-[var(--ink)]">
                {getSplitTitleByDays(trainingDaysCount)}
              </span>
            </div>

            {/* Specific Days Selection */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[14px] font-medium text-[var(--ink)]">
                  Elige los días exactos de tu rutina
                </span>
                <span
                  className={`t-num text-[13px] font-medium ${
                    selectedDays.length === trainingDaysCount
                      ? 'text-[var(--ok)]'
                      : 'text-[var(--warn)]'
                  }`}
                >
                  {selectedDays.length} / {trainingDaysCount} seleccionados
                </span>
              </div>

              <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                {ORDERED_DAYS.map((day) => {
                  const isActive = selectedDays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => handleToggleDay(day)}
                      className={`min-h-[46px] px-2 py-2 rounded-[12px] border text-[13px] font-medium cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-[var(--action)] focus-visible:outline-offset-2 ${
                        isActive
                          ? 'bg-[color-mix(in_oklab,var(--action)_14%,var(--surface))] border-[var(--action)] text-[var(--ink)]'
                          : 'bg-[var(--surface)] border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)] hover:border-[var(--line-strong)]'
                      }`}
                    >
                      {day.slice(0, 3)}
                    </button>
                  );
                })}
              </div>
              <p className="text-[13px] text-[var(--muted)]">
                Los días no marcados aparecerán como días de recuperación activa en tu tablero.
              </p>
            </div>
          </div>
        )}

        {/* STEP 3: GOAL & EXPERIENCE */}
        {step === 3 && (
          <div className="space-y-5">
            <div>
              <div className="flex items-center gap-2 text-[14px] font-medium text-[var(--ink)] mb-1">
                <Target className="w-4 h-4 text-[var(--gym)]" aria-hidden="true" />
                <span>¿Cuál es tu objetivo principal?</span>
              </div>
              <p className="text-[14px] text-[var(--muted)]">
                Ajustaremos el rango de repeticiones, cargas estimadas y el temporizador de descanso.
              </p>
            </div>

            <div
              role="radiogroup"
              aria-label="Objetivo de entrenamiento"
              className="grid grid-cols-1 sm:grid-cols-2 gap-3"
            >
              {GOAL_CATALOG.map((item) => {
                const isSelected = goal === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => setGoal(item.id)}
                    className={`min-h-[88px] p-4 rounded-[12px] border text-left cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-[var(--action)] focus-visible:outline-offset-2 ${
                      isSelected
                        ? 'bg-[color-mix(in_oklab,var(--action)_10%,var(--surface))] border-[var(--action)]'
                        : 'bg-[var(--surface)] border-[var(--line)] hover:border-[var(--line-strong)]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[15px] font-medium text-[var(--ink)]">
                        {item.label}
                      </span>
                      {isSelected && (
                        <Check className="w-4 h-4 text-[var(--action)] shrink-0" aria-hidden="true" />
                      )}
                    </div>
                    <p className="text-[13px] text-[var(--muted)] mt-1">{item.summary}</p>
                    <div className="mt-2.5 flex items-center gap-2">
                      <span className="t-badge t-badge-gym t-num">
                        {item.repsRange} · {item.restSeconds}s descanso
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Experience Level */}
            <div className="space-y-2.5 pt-2 border-t border-[var(--line)]">
              <span className="text-[14px] font-medium text-[var(--ink)] block">
                Nivel de experiencia entrenando
              </span>
              <div
                role="radiogroup"
                aria-label="Nivel de experiencia"
                className="grid grid-cols-1 sm:grid-cols-3 gap-2.5"
              >
                {EXPERIENCE_OPTIONS.map((opt) => {
                  const isSelected = experience === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => setExperience(opt.id)}
                      className={`min-h-[52px] p-3 rounded-[12px] border text-left cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-[var(--action)] focus-visible:outline-offset-2 ${
                        isSelected
                          ? 'bg-[color-mix(in_oklab,var(--action)_10%,var(--surface))] border-[var(--action)]'
                          : 'bg-[var(--surface)] border-[var(--line)] hover:border-[var(--line-strong)]'
                      }`}
                    >
                      <span className="text-[14px] font-medium text-[var(--ink)] block">
                        {opt.label}
                      </span>
                      <span className="text-[13px] text-[var(--muted)] block mt-0.5">
                        {opt.hint}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: BODY METRICS, LIVE BMI & ROUTINE CONFIRMATION */}
        {step === 4 && (
          <div className="space-y-5">
            <div>
              <div className="flex items-center gap-2 text-[14px] font-medium text-[var(--ink)] mb-1">
                <Scale className="w-4 h-4 text-[var(--action)]" aria-hidden="true" />
                <span>Tus medidas para calcular tu IMC</span>
              </div>
              <p className="text-[14px] text-[var(--muted)]">
                Usaremos estos datos para calcular tu Índice de Masa Corporal (IMC) y calibrar tus cargas iniciales.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor={`${formId}-height`} className="t-label">
                  Altura (cm)
                </label>
                <input
                  id={`${formId}-height`}
                  type="number"
                  min={110}
                  max={240}
                  step={1}
                  required
                  placeholder="Ej. 174"
                  value={heightCm}
                  onChange={(e) => {
                    setHeightCm(e.target.value);
                    setErrorMsg(null);
                  }}
                  className="t-input t-num"
                />
              </div>

              <div>
                <label htmlFor={`${formId}-weight`} className="t-label">
                  Peso actual (kg)
                </label>
                <input
                  id={`${formId}-weight`}
                  type="number"
                  min={30}
                  max={250}
                  step={0.1}
                  required
                  placeholder="Ej. 72.5"
                  value={weightKg}
                  onChange={(e) => {
                    setWeightKg(e.target.value);
                    setErrorMsg(null);
                  }}
                  className="t-input t-num"
                />
              </div>

              <div>
                <label htmlFor={`${formId}-target-weight`} className="t-label">
                  Peso meta kg (opcional)
                </label>
                <input
                  id={`${formId}-target-weight`}
                  type="number"
                  min={30}
                  max={250}
                  step={0.5}
                  placeholder="Ej. 75"
                  value={targetWeightKg}
                  onChange={(e) => setTargetWeightKg(e.target.value)}
                  className="t-input t-num"
                />
              </div>
            </div>

            {/* Live BMI Preview Gauge */}
            <div className="p-4 rounded-[12px] border border-[var(--line)] bg-[var(--surface-2)] space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-[13px] text-[var(--muted)] block">
                    Índice de Masa Corporal (IMC)
                  </span>
                  <div className="flex items-baseline gap-2.5 mt-0.5">
                    <span className="t-num text-2xl font-semibold text-[var(--ink)]">
                      {isValidMetrics ? liveBmi.bmi.toFixed(1) : '--'}
                    </span>
                    <span className="text-[13px] text-[var(--muted)]">kg/m²</span>
                  </div>
                </div>

                {isValidMetrics && (
                  <span className={getBmiBadgeClass(liveBmi.category)}>
                    {liveBmi.label}
                  </span>
                )}
              </div>

              {/* OMS BMI Scale Visual Bar */}
              <div className="space-y-1.5">
                <div className="relative h-2.5 rounded-full overflow-hidden flex bg-[var(--surface)] border border-[var(--line)]">
                  <div className="h-full bg-[var(--warn)] opacity-75" style={{ width: '17.5%' }} />
                  <div className="h-full bg-[var(--ok)] opacity-85" style={{ width: '32.5%' }} />
                  <div className="h-full bg-[var(--warn)] opacity-85" style={{ width: '25%' }} />
                  <div className="h-full bg-[var(--danger)] opacity-85" style={{ width: '25%' }} />
                  {isValidMetrics && (
                    <div
                      aria-hidden="true"
                      className="absolute top-0 bottom-0 w-1 bg-[var(--ink)] shadow-xs transition-all duration-200"
                      style={{ left: `calc(${getBmiMarkerPercent(liveBmi.bmi)}% - 2px)` }}
                    />
                  )}
                </div>
                <div className="flex justify-between text-[13px] text-[var(--muted)] t-num">
                  <span>&lt;18.5</span>
                  <span>18.5–24.9</span>
                  <span>25–29.9</span>
                  <span>&ge;30</span>
                </div>
              </div>
            </div>

            {/* Smart Routine Confirmation if Existing Routines Exist */}
            {hasExistingRoutines && (
              <div className="pt-2 border-t border-[var(--line)] space-y-2.5">
                <span className="text-[14px] font-medium text-[var(--ink)] block">
                  ¿Cómo aplicamos los cambios a tu rutina?
                </span>
                <div
                  role="radiogroup"
                  aria-label="Opción de actualización de rutina"
                  className="grid grid-cols-1 sm:grid-cols-2 gap-2.5"
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={replaceRoutines}
                    onClick={() => setReplaceRoutines(true)}
                    className={`min-h-[56px] p-3.5 rounded-[12px] border text-left cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-[var(--action)] focus-visible:outline-offset-2 ${
                      replaceRoutines
                        ? 'bg-[color-mix(in_oklab,var(--action)_10%,var(--surface))] border-[var(--action)]'
                        : 'bg-[var(--surface)] border-[var(--line)] hover:border-[var(--line-strong)]'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-[14px] font-medium text-[var(--ink)]">
                      <RefreshCw className="w-4 h-4 text-[var(--action)] shrink-0" aria-hidden="true" />
                      <span>Generar nueva rutina</span>
                    </div>
                    <p className="text-[13px] text-[var(--muted)] mt-1">
                      Reemplaza tus ejercicios actuales con el plan de {trainingDaysCount} días.
                    </p>
                  </button>

                  <button
                    type="button"
                    role="radio"
                    aria-checked={!replaceRoutines}
                    onClick={() => setReplaceRoutines(false)}
                    className={`min-h-[56px] p-3.5 rounded-[12px] border text-left cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-[var(--action)] focus-visible:outline-offset-2 ${
                      !replaceRoutines
                        ? 'bg-[color-mix(in_oklab,var(--action)_10%,var(--surface))] border-[var(--action)]'
                        : 'bg-[var(--surface)] border-[var(--line)] hover:border-[var(--line-strong)]'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-[14px] font-medium text-[var(--ink)]">
                      <ShieldCheck className="w-4 h-4 text-[var(--ok)] shrink-0" aria-hidden="true" />
                      <span>Conservar mis ejercicios</span>
                    </div>
                    <p className="text-[13px] text-[var(--muted)] mt-1">
                      Solo guarda tu gimnasio, objetivo e IMC sin borrar tus pesos.
                    </p>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </form>
    </ModalShell>
  );
};
