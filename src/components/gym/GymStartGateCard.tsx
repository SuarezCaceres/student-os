import React from 'react';
import { CalendarX2, Clock, Dumbbell, Play } from 'lucide-react';
import type { DayOfWeek, GymRoutine } from '../../types';
import { formatShortSpanishDate } from '../../utils/gymAttendance';

export interface GymStartGateCardProps {
  routine: GymRoutine;
  dayOfWeek: DayOfWeek;
  dateIso: string;
  gymDisplayName?: string;
  onStartSession: () => void;
  onReportMissed: () => void;
}

export const GymStartGateCard: React.FC<GymStartGateCardProps> = ({
  routine,
  dayOfWeek,
  dateIso,
  gymDisplayName,
  onStartSession,
  onReportMissed,
}) => {
  const totalExercises = routine.exercises.length;
  const totalSets = routine.exercises.reduce((acc, ex) => acc + ex.sets, 0);

  return (
    <section className="t-card p-6 sm:p-10">
      <div className="max-w-xl mx-auto py-4 sm:py-6 flex flex-col items-center text-center">
        <div className="w-14 h-14 rounded-2xl bg-[var(--surface-2)] border border-[var(--line-strong)] flex items-center justify-center text-[var(--action)] mb-5">
          <Dumbbell className="w-6 h-6" aria-hidden="true" />
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 mb-3">
          <span className="t-badge t-badge-gym">{routine.tag}</span>
          <span className="t-badge">
            {dayOfWeek} · {formatShortSpanishDate(dateIso)}
          </span>
          <span className="t-badge t-num">
            <Clock className="w-3.5 h-3.5" aria-hidden="true" />
            ~2h objetivo
          </span>
        </div>

        <h2 className="text-2xl sm:text-[30px] font-semibold tracking-[-0.028em] text-[var(--ink)] leading-tight">
          {routine.name}
        </h2>

        <p className="text-[15px] text-[var(--muted)] mt-2.5 max-w-[46ch] leading-relaxed">
          Hoy toca entrenar.{' '}
          <span className="t-num font-medium text-[var(--ink)]">
            {totalExercises} {totalExercises === 1 ? 'ejercicio' : 'ejercicios'} · {totalSets} series
          </span>
          {gymDisplayName ? ` en ${gymDisplayName}` : ''}. Cuando presiones iniciar, se abrirán tus
          series y cronómetro de sesión.
        </p>

        <div className="mt-7 w-full flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
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

        <p className="text-[13px] text-[var(--muted)] mt-4">
          Si hoy se te complica asistir, registra el motivo para cuidar tu racha y reprogramarlo en la semana.
        </p>
      </div>
    </section>
  );
};
