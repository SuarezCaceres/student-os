import React from 'react';
import { CalendarClock, HeartHandshake, Play, ShieldCheck } from 'lucide-react';
import type { DayOfWeek, GymAttendanceLog } from '../../types';
import { formatShortSpanishDate, MISS_REASON_OPTIONS } from '../../utils/gymAttendance';

export interface GymMissedSummaryCardProps {
  log: GymAttendanceLog;
  isToday: boolean;
  canReschedule: boolean;
  onGoToDay: (day: DayOfWeek) => void;
  onOpenReschedule: () => void;
  onOverrideStartToday?: () => void;
}

export const GymMissedSummaryCard: React.FC<GymMissedSummaryCardProps> = ({
  log,
  isToday,
  canReschedule,
  onGoToDay,
  onOpenReschedule,
  onOverrideStartToday,
}) => {
  const reasonObj = MISS_REASON_OPTIONS.find((item) => item.id === log.missReason);
  const isRescheduled = log.status === 'rescheduled' && Boolean(log.rescheduledToDay);

  return (
    <section className="t-card p-6 sm:p-8">
      <div className="max-w-xl mx-auto space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`t-badge ${isRescheduled ? 't-badge-ok' : 't-badge-warn'}`}>
            {isRescheduled && log.rescheduledToDay
              ? `Reprogramado → ${log.rescheduledToDay}`
              : 'Inasistencia registrada'}
          </span>
          <span className="t-badge">
            {log.dayOfWeek} · {formatShortSpanishDate(log.date)}
          </span>
          {log.streakProtected && (
            <span className="t-badge t-badge-ok">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              Racha protegida
            </span>
          )}
        </div>

        <h2 className="text-xl sm:text-2xl font-semibold tracking-[-0.025em] text-[var(--ink)] text-balance">
          {log.routineName}
        </h2>

        {/* Hairline structured metadata list */}
        <dl className="border-y border-[var(--line)] divide-y divide-[var(--line)] text-[14px]">
          {reasonObj && (
            <div className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <dt className="text-[var(--muted)]">Motivo principal</dt>
              <dd className="font-medium text-[var(--ink)]">{reasonObj.label}</dd>
            </div>
          )}
          {log.missNote && (
            <div className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <dt className="text-[var(--muted)]">Nota</dt>
              <dd className="text-[var(--ink)] break-words">“{log.missNote}”</dd>
            </div>
          )}
          {isRescheduled && log.rescheduledToDay && (
            <div className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <dt className="text-[var(--muted)]">Nueva fecha asignada</dt>
              <dd className="font-medium text-[var(--ok)] t-num">
                {log.rescheduledToDay}
                {log.rescheduledToDate ? ` · ${formatShortSpanishDate(log.rescheduledToDate)}` : ''}
                {log.rescheduledSlotStart && log.rescheduledSlotEnd
                  ? ` (${log.rescheduledSlotStart} – ${log.rescheduledSlotEnd})`
                  : ''}
              </dd>
            </div>
          )}
        </dl>

        {log.encouragementMessage && (
          <div className="p-4 rounded-[14px] bg-[var(--surface-2)] border border-[var(--line)] flex items-start gap-3">
            <HeartHandshake className="w-5 h-5 text-[var(--gym)] shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-[14px] text-[var(--ink)] leading-relaxed">
              {log.encouragementMessage}
            </p>
          </div>
        )}

        <div className="pt-1 flex flex-wrap items-center gap-3">
          {isRescheduled && log.rescheduledToDay && (
            <button
              type="button"
              onClick={() => onGoToDay(log.rescheduledToDay!)}
              className="t-btn t-btn-primary !whitespace-normal !py-2.5 text-center leading-snug"
            >
              <CalendarClock className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Ir al entrenamiento del {log.rescheduledToDay}</span>
            </button>
          )}

          {!isRescheduled && canReschedule && (
            <button
              type="button"
              onClick={onOpenReschedule}
              className="t-btn t-btn-primary !whitespace-normal !py-2.5 text-center leading-snug"
            >
              <CalendarClock className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Reprogramar rutina (~2h)</span>
            </button>
          )}

          {isToday && !isRescheduled && onOverrideStartToday && (
            <button
              type="button"
              onClick={onOverrideStartToday}
              className="t-btn t-btn-secondary !whitespace-normal !py-2.5 text-center leading-snug"
            >
              <Play className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Al final sí pude venir: iniciar ahora</span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
};
