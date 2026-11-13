import React, { useState, useId } from 'react';
import { Scale, History, TrendingUp, TrendingDown } from 'lucide-react';
import { ModalShell } from '../common/ModalShell';
import {
  type WeightHistoryEntry,
  type BmiCategory,
  calculateBmi,
  getBmiCategory,
  getBmiCategoryLabel,
} from './gymProfileTypes';

export interface WeightCheckInModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentWeightKg: number;
  heightCm: number;
  targetWeightKg?: number;
  weightHistory?: WeightHistoryEntry[];
  onSaveWeight: (newWeightKg: number) => void;
}

const renderBmiBadge = (category: BmiCategory) => {
  const label = getBmiCategoryLabel(category);
  switch (category) {
    case 'normal':
      return <span className="t-badge t-badge-ok">{label}</span>;
    case 'bajo_peso':
    case 'sobrepeso':
      return <span className="t-badge t-badge-warn">{label}</span>;
    case 'obesidad':
      return <span className="t-badge t-badge-danger">{label}</span>;
  }
};

const WeightCheckInModalContent: React.FC<WeightCheckInModalProps> = ({
  isOpen,
  onClose,
  currentWeightKg,
  heightCm,
  targetWeightKg,
  weightHistory = [],
  onSaveWeight,
}) => {
  const inputId = useId();
  const [weight, setWeight] = useState<number>(() => currentWeightKg || 70);

  const calculatedBmi = calculateBmi(weight, heightCm);
  const bmiCategory = getBmiCategory(calculatedBmi);
  const delta = Number((weight - currentWeightKg).toFixed(1));

  const handleAdjust = (step: number) => {
    setWeight((prev) => {
      const updated = Number((prev + step).toFixed(1));
      return Math.min(250, Math.max(30, updated));
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val)) {
      setWeight(val);
    } else {
      setWeight(0);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (weight >= 30 && weight <= 250) {
      onSaveWeight(weight);
      onClose();
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="Registrar peso corporal"
      subtitle="Actualiza tu peso actual para calibrar tus métricas de IMC y sobrecarga progresiva"
      badge="Check-in físico"
      icon={<Scale className="w-5 h-5 text-[var(--action)]" aria-hidden="true" />}
      maxWidth="lg"
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <button
            type="button"
            onClick={onClose}
            className="t-btn t-btn-ghost min-h-[44px] cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="weight-checkin-form"
            className="t-btn t-btn-primary min-h-[44px] cursor-pointer"
          >
            Guardar peso
          </button>
        </div>
      }
    >
      <form id="weight-checkin-form" onSubmit={handleSubmit} className="space-y-4">
        {/* Input numérico de peso accesible */}
        <div>
          <label htmlFor={inputId} className="t-label">
            Peso actual (kg)
          </label>
          <div className="relative">
            <input
              id={inputId}
              type="number"
              step="0.1"
              min="30"
              max="250"
              value={weight === 0 ? '' : weight}
              onChange={handleInputChange}
              className="t-input t-num text-lg font-semibold pr-12"
              placeholder="70.0"
              required
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-[var(--muted)] select-none pointer-events-none">
              kg
            </span>
          </div>
          <span className="text-[13px] text-[var(--muted)] mt-1 block">
            Rango admitido: 30 a 250 kg (pasos de 0.1 kg)
          </span>
        </div>

        {/* Botones rápidos de ajuste */}
        <div>
          <span className="text-[13px] text-[var(--muted)] block mb-1.5">Ajuste rápido</span>
          <div className="grid grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => handleAdjust(-1.0)}
              className="t-btn t-btn-secondary min-h-[44px] cursor-pointer t-num text-sm px-1"
              aria-label="Restar 1 kilogramo"
            >
              -1.0 kg
            </button>
            <button
              type="button"
              onClick={() => handleAdjust(-0.5)}
              className="t-btn t-btn-secondary min-h-[44px] cursor-pointer t-num text-sm px-1"
              aria-label="Restar 0.5 kilogramos"
            >
              -0.5 kg
            </button>
            <button
              type="button"
              onClick={() => handleAdjust(0.5)}
              className="t-btn t-btn-secondary min-h-[44px] cursor-pointer t-num text-sm px-1"
              aria-label="Sumar 0.5 kilogramos"
            >
              +0.5 kg
            </button>
            <button
              type="button"
              onClick={() => handleAdjust(1.0)}
              className="t-btn t-btn-secondary min-h-[44px] cursor-pointer t-num text-sm px-1"
              aria-label="Sumar 1 kilogramo"
            >
              +1.0 kg
            </button>
          </div>
        </div>

        {/* Resumen del cálculo en vivo */}
        <div className="pt-2 divide-y divide-[var(--line)] border-t border-[var(--line)]">
          <div className="t-row flex items-center justify-between">
            <div>
              <span className="text-[13px] text-[var(--muted)] block">Delta vs. peso previo</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                {delta === 0 ? (
                  <span className="text-sm text-[var(--muted)] t-num font-medium">
                    Sin cambio (0.0 kg)
                  </span>
                ) : delta < 0 ? (
                  <span className="text-sm text-[var(--ok)] t-num font-semibold flex items-center gap-1">
                    <TrendingDown className="w-4 h-4" aria-hidden="true" />
                    {delta} kg
                  </span>
                ) : (
                  <span className="text-sm text-[var(--ink)] t-num font-semibold flex items-center gap-1">
                    <TrendingUp className="w-4 h-4 text-[var(--muted)]" aria-hidden="true" />
                    +{delta} kg
                  </span>
                )}
                <span className="text-[13px] text-[var(--muted)]">
                  (previo: <span className="t-num">{currentWeightKg}</span> kg)
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[13px] text-[var(--muted)] block">Nuevo IMC</span>
              <div className="flex items-center justify-end gap-1.5 mt-0.5">
                <span className="t-num font-semibold text-base text-[var(--ink)]">
                  {calculatedBmi.toFixed(1)}
                </span>
                {renderBmiBadge(bmiCategory)}
              </div>
            </div>
          </div>

          {targetWeightKg !== undefined && (
            <div className="t-row flex items-center justify-between text-[13px]">
              <span className="text-[var(--muted)]">
                Peso meta: <span className="t-num font-medium text-[var(--ink)]">{targetWeightKg} kg</span>
              </span>
              <span className="t-num font-medium text-[var(--ink)]">
                {Math.abs(Number((targetWeightKg - weight).toFixed(1))) === 0
                  ? '¡Meta alcanzada!'
                  : `${targetWeightKg - weight > 0 ? 'Faltan ' : 'Supera por '}${Math.abs(Number((targetWeightKg - weight).toFixed(1)))} kg`}
              </span>
            </div>
          )}
        </div>

        {/* Historial Reciente */}
        {weightHistory.length > 0 && (
          <div className="pt-2">
            <h4 className="text-sm font-semibold text-[var(--ink)] mb-2 flex items-center gap-1.5">
              <History className="w-4 h-4 text-[var(--muted)]" aria-hidden="true" />
              <span>Historial reciente</span>
            </h4>
            <div className="divide-y divide-[var(--line)] max-h-44 overflow-y-auto pr-1">
              {weightHistory.slice(0, 5).map((entry, idx) => (
                <div
                  key={`${entry.date}-${idx}`}
                  className="t-row py-2 flex items-center justify-between text-sm"
                >
                  <span className="text-[13px] text-[var(--muted)] t-num">{entry.date}</span>
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-[var(--ink)] t-num">
                      {entry.weightKg.toFixed(1)} kg
                    </span>
                    <span className="text-[13px] text-[var(--muted)] t-num">
                      IMC {entry.bmi.toFixed(1)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </form>
    </ModalShell>
  );
};

export const WeightCheckInModal: React.FC<WeightCheckInModalProps> = (props) => {
  if (!props.isOpen) return null;
  return <WeightCheckInModalContent {...props} />;
};
