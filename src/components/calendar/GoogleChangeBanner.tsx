import React from 'react';
import {
  AlertTriangle,
  CalendarSync,
  CheckCircle2,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import type { GoogleImpactReport, GoogleScheduleChange } from '../../utils/googleCalendarDiff';

export interface GoogleChangeBannerProps {
  report: GoogleImpactReport | null;
  onOpenEvaluator: () => void;
  onDismiss: () => void;
}

function summarizeLeadChange(change: GoogleScheduleChange | undefined): string {
  if (!change) return 'Se detectaron cambios recientes en tu Google Calendar.';

  const timeRange = change.isAllDay
    ? `${change.day} (todo el día)`
    : `${change.day} ${change.startTime}–${change.endTime}`;

  switch (change.kind) {
    case 'moved':
      return `Moviste "${change.title}" a ${timeRange}.`;
    case 'added':
      return `Agregaste "${change.title}" (${timeRange}).`;
    case 'deleted':
      return `Eliminaste "${change.title}" (${change.day} ${change.startTime}).`;
    case 'updated':
      return `Actualizaste "${change.title}" (${timeRange}).`;
  }
}

export const GoogleChangeBanner: React.FC<GoogleChangeBannerProps> = ({
  report,
  onOpenEvaluator,
  onDismiss,
}) => {
  if (!report) return null;

  const isConflict = report.status === 'conflict' && report.conflicts.length > 0;
  const firstConflict = report.conflicts[0];
  const changeCount = report.changes.length;
  const leadSummary = summarizeLeadChange(report.changes[0]);

  const borderStyle = isConflict
    ? 'border-[var(--danger)] bg-[color-mix(in_oklab,var(--danger)_10%,var(--surface))]'
    : 'border-[var(--ok)] bg-[color-mix(in_oklab,var(--ok)_10%,var(--surface))]';

  return (
    <section
      role="region"
      aria-label="Notificación de sincronización automática con Google Calendar"
      className="mb-6"
    >
      <div
        role={isConflict ? 'alert' : 'status'}
        aria-atomic="true"
        className={`rounded-[16px] border p-4 sm:px-5 sm:py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-colors duration-150 motion-reduce:transition-none ${borderStyle}`}
      >
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={`w-10 h-10 rounded-[12px] border flex items-center justify-center shrink-0 mt-0.5 ${
              isConflict
                ? 'bg-[var(--surface)] border-[color-mix(in_oklab,var(--danger)_35%,var(--line))] text-[var(--danger)]'
                : 'bg-[var(--surface)] border-[color-mix(in_oklab,var(--ok)_35%,var(--line))] text-[var(--ok)]'
            }`}
          >
            {isConflict ? (
              <AlertTriangle className="w-5 h-5" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
            )}
          </div>

          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="t-badge">
                <CalendarSync className="w-3.5 h-3.5 text-[var(--action)] shrink-0" aria-hidden="true" />
                <span>Sincronización automática</span>
              </span>

              <span className={`t-badge ${isConflict ? 't-badge-danger' : 't-badge-ok'}`}>
                {isConflict ? (
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                )}
                <span>
                  {isConflict
                    ? `${report.conflicts.length} cruce${report.conflicts.length === 1 ? '' : 's'} detectado${report.conflicts.length === 1 ? '' : 's'}`
                    : 'Sin cruces en tu horario'}
                </span>
              </span>

              {changeCount > 1 && (
                <span className="t-badge t-num">
                  {changeCount} cambios desde Google
                </span>
              )}
            </div>

            <p className="text-[15px] font-medium text-[var(--ink)] leading-snug">
              Modificaste tu horario en Google Calendar · {leadSummary}
            </p>

            <p className="text-[13px] text-[var(--muted)] leading-relaxed">
              {isConflict && firstConflict ? (
                <>
                  <strong className="text-[var(--ink)]">Dónde perjudica:</strong> el{' '}
                  <span className="font-medium text-[var(--ink)]">{firstConflict.day}</span> de{' '}
                  <span className="t-num font-medium text-[var(--ink)]">
                    {firstConflict.overlapStart}–{firstConflict.overlapEnd}
                  </span>{' '}
                  choca tu bloque{' '}
                  <strong className="text-[var(--ink)]">
                    &ldquo;{firstConflict.localBlock.title}&rdquo;
                  </strong>{' '}
                  con{' '}
                  <strong className="text-[var(--ink)]">
                    &ldquo;{firstConflict.conflictingWithTitle}&rdquo;
                  </strong>
                  {report.conflicts.length > 1
                    ? ` (y ${report.conflicts.length - 1} cruce adicional).`
                    : '.'}
                </>
              ) : (
                'Evaluamos tu horario actual en StudentOS y no hay ningún problema ni cruce de horas.'
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenEvaluator}
            className={`t-btn ${
              isConflict ? 't-btn-primary' : 't-btn-secondary'
            } min-h-[44px] px-4 text-[13px] font-semibold`}
          >
            <SlidersHorizontal className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{isConflict ? 'Ver impacto y solucionar' : 'Evaluar detalle'}</span>
          </button>

          <button
            type="button"
            onClick={onDismiss}
            aria-label="Cerrar aviso de cambio en Google Calendar"
            className="t-btn t-btn-ghost min-h-[44px] px-3 text-[13px]"
          >
            <X className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Entendido</span>
          </button>
        </div>
      </div>
    </section>
  );
};
