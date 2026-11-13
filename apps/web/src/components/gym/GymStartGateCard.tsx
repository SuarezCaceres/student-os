import React, { useId, useState } from 'react';
import { CalendarX2, ChevronDown, Clock, Dumbbell, Layers, Play } from 'lucide-react';
import type { DayOfWeek, GymRoutine } from '../../types';
import { formatShortSpanishDate } from '../../utils/gymAttendance';

export interface GymStartGateCardProps {
  routine: GymRoutine;
  dayOfWeek: DayOfWeek;
  dateIso: string;
  gymDisplayName?: string;
  restSeconds?: number;
  onStartSession: () => void;
  onReportMissed: () => void;
}

export const GymStartGateCard: React.FC<GymStartGateCardProps> = ({
  routine,
  dayOfWeek,
  dateIso,
  gymDisplayName,
  restSeconds = 90,
  onStartSession,
  onReportMissed,
}) => {
  const [showPreview, setShowPreview] = useState(false);
  const previewPanelId = useId();

  const totalExercises = routine.exercises.length;
  const totalSets = routine.exercises.reduce((acc, ex) => acc + ex.sets, 0);

  return (
    <section className="t-card p-6 sm:p-10">
      <div className="max-w-xl mx-auto py-2 sm:py-4 flex flex-col items-center text-center">
        <div className="w-14 h-14 rounded-2xl bg-[var(--surface-2)] border border-[var(--line-strong)] flex items-center justify-center text-[var(--action)] mb-5">
          <Dumbbell className="w-6 h-6" aria-hidden="true" />
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 mb-3">
          <span className="t-badge t-badge-gym">{routine.tag}</span>
          <span className="t-badge">
            {dayOfWeek} · {formatShortSpanishDate(dateIso)}
          </span>
        </div>

        <h2 className="text-2xl sm:text-[30px] font-semibold tracking-[-0.028em] text-[var(--ink)] leading-tight text-balance max-w-[22ch]">
          {routine.name}
        </h2>

        <p className="text-[15px] text-[var(--muted)] mt-2.5 max-w-[46ch] leading-relaxed">
          {gymDisplayName ? `Sesión planificada en ${gymDisplayName}. ` : 'Sesión planificada de hoy. '}
          Presiona iniciar cuando estés listo para desbloquear tus series y cronómetro.
        </p>

        {/* Hairline 3-column session telemetry strip (zero box-in-box nesting) */}
        <div className="w-full mt-5 pt-4 pb-4 border-y border-[var(--line)] grid grid-cols-3 gap-2 text-center">
          <div className="px-2">
            <div className="text-[13px] text-[var(--muted)] flex items-center justify-center gap-1">
              <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Duración</span>
            </div>
            <p className="text-[15px] font-semibold text-[var(--ink)] t-num mt-0.5">~2 horas</p>
          </div>

          <div className="px-2 border-x border-[var(--line)]">
            <div className="text-[13px] text-[var(--muted)] flex items-center justify-center gap-1">
              <Layers className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Volumen</span>
            </div>
            <p className="text-[15px] font-semibold text-[var(--ink)] t-num mt-0.5">
              {totalExercises} ej · {totalSets} ser
            </p>
          </div>

          <div className="px-2">
            <div className="text-[13px] text-[var(--muted)]">Descanso base</div>
            <p className="text-[15px] font-semibold text-[var(--ink)] t-num mt-0.5">
              {restSeconds} seg
            </p>
          </div>
        </div>

        {/* Primary & Secondary Action Pair */}
        <div className="mt-6 w-full flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
          <button
            type="button"
            onClick={onStartSession}
            className="t-btn t-btn-primary !whitespace-normal !py-3 !px-5 sm:!px-7 min-h-[54px] text-[15px] sm:text-[16px] font-semibold text-center leading-snug w-full sm:w-auto"
          >
            <Play className="w-5 h-5 shrink-0" aria-hidden="true" />
            <span>Iniciemos con el entrenamiento de hoy</span>
          </button>

          <button
            type="button"
            onClick={onReportMissed}
            className="t-btn t-btn-secondary !whitespace-normal !py-3 !px-5 min-h-[54px] text-center leading-snug w-full sm:w-auto"
          >
            <CalendarX2 className="w-4 h-4 shrink-0 text-[var(--warn)]" aria-hidden="true" />
            <span>Hoy no puedo ir</span>
          </button>
        </div>

        {/* Progressive disclosure lightweight routine preview */}
        <div className="mt-5 w-full">
          <button
            type="button"
            aria-expanded={showPreview}
            aria-controls={previewPanelId}
            onClick={() => setShowPreview((prev) => !prev)}
            className="t-btn t-btn-ghost min-h-[44px] px-3 text-[13px] text-[var(--muted)] hover:text-[var(--ink)]"
          >
            <span>{showPreview ? 'Ocultar resumen de ejercicios' : 'Ver resumen rápido de ejercicios'}</span>
            <ChevronDown
              className={`w-4 h-4 shrink-0 transition-transform duration-150 motion-reduce:transition-none ${
                showPreview ? 'rotate-180' : ''
              }`}
              aria-hidden="true"
            />
          </button>

          {showPreview && (
            <div
              id={previewPanelId}
              className="mt-3 text-left border-t border-[var(--line)] pt-3 space-y-1.5"
            >
              {routine.exercises.map((ex, idx) => (
                <div
                  key={ex.id}
                  className="flex items-center justify-between gap-3 py-1.5 text-[14px] border-b border-[var(--line)] last:border-b-0"
                >
                  <span className="font-medium text-[var(--ink)] min-w-0 truncate">
                    <span className="t-num text-[var(--muted)] mr-2">{idx + 1}.</span>
                    {ex.name}
                  </span>
                  <span className="text-[13px] t-num text-[var(--muted)] shrink-0">
                    {ex.sets} × {ex.reps}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-[13px] text-[var(--muted)] mt-3 max-w-[44ch]">
          Si hoy se te complica asistir, registra el motivo para cuidar tu racha y reprogramarlo en la semana.
        </p>
      </div>
    </section>
  );
};
