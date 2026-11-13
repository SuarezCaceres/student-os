import React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CalendarCheck2,
  CalendarPlus,
  CalendarSync,
  CalendarX2,
  CheckCircle2,
  Clock,
  RefreshCw,
} from 'lucide-react';
import { ModalShell } from '../common/ModalShell';
import type {
  GoogleChangeKind,
  GoogleImpactReport,
  GoogleScheduleChange,
  ScheduleSolutionOption,
} from '../../utils/googleCalendarDiff';

export interface GoogleImpactModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: GoogleImpactReport | null;
  isGoogleConnected: boolean;
  isEvaluating: boolean;
  applyingSolutionId: string | null;
  onReEvaluate: () => void;
  onApplySolution: (solution: ScheduleSolutionOption) => Promise<void> | void;
}

const CHANGE_META: Record<
  GoogleChangeKind,
  { label: string; badgeClass: string; Icon: React.FC<{ className?: string }> }
> = {
  moved: {
    label: 'Movido',
    badgeClass: 't-badge-warn',
    Icon: ArrowRight,
  },
  added: {
    label: 'Agregado',
    badgeClass: 't-badge-accent',
    Icon: CalendarPlus,
  },
  deleted: {
    label: 'Eliminado',
    badgeClass: 't-badge-danger',
    Icon: CalendarX2,
  },
  updated: {
    label: 'Actualizado',
    badgeClass: 't-badge',
    Icon: CalendarSync,
  },
};

function formatDetectedTime(iso: string | undefined): string {
  if (!iso) return 'Reciente';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return 'Reciente';
  return parsed.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function renderChangeSchedule(change: GoogleScheduleChange): React.ReactNode {
  if (change.isAllDay) {
    return (
      <span className="t-num text-[13px] text-[var(--muted)]">
        {change.day} · Todo el día
      </span>
    );
  }

  if (change.kind === 'moved' && change.previousDay && change.previousStartTime && change.previousEndTime) {
    return (
      <div className="flex flex-wrap items-center gap-1.5 text-[13px] text-[var(--muted)]">
        <span className="t-num line-through">
          {change.previousDay} {change.previousStartTime}–{change.previousEndTime}
        </span>
        <ArrowRight className="w-3.5 h-3.5 text-[var(--warn)] shrink-0" aria-hidden="true" />
        <span className="t-num font-semibold text-[var(--ink)]">
          {change.day} {change.startTime}–{change.endTime}
        </span>
      </div>
    );
  }

  return (
    <span className="t-num text-[13px] text-[var(--muted)]">
      {change.day} · {change.startTime}–{change.endTime}
    </span>
  );
}

export const GoogleImpactModal: React.FC<GoogleImpactModalProps> = ({
  isOpen,
  onClose,
  report,
  isGoogleConnected,
  isEvaluating,
  applyingSolutionId,
  onReEvaluate,
  onApplySolution,
}) => {
  const conflicts = report?.conflicts ?? [];
  const changes = report?.changes ?? [];
  const isConflict = conflicts.length > 0;

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="2xl"
      badge="Evaluador inteligente"
      title="Impacto de cambios en Google Calendar"
      subtitle="Comparamos tus movimientos recientes de Google Calendar frente a tus bloques de StudentOS."
      icon={<CalendarSync className="w-5 h-5" aria-hidden="true" />}
      footer={
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
          <p className="text-[13px] text-[var(--muted)] flex items-center gap-1.5">
            <Clock className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>
              Última evaluación:{' '}
              <span className="t-num text-[var(--ink)]">
                {formatDetectedTime(report?.detectedAt)}
              </span>
            </span>
          </p>
          <button
            type="button"
            onClick={onClose}
            className="t-btn t-btn-secondary min-h-[44px] text-[13px] font-semibold"
          >
            Cerrar
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Resumen de evaluación en vivo */}
        <div
          role={isConflict ? 'alert' : 'status'}
          aria-atomic="true"
          className={`rounded-[14px] border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
            isConflict
              ? 'border-[var(--danger)] bg-[color-mix(in_oklab,var(--danger)_10%,var(--surface))]'
              : 'border-[var(--ok)] bg-[color-mix(in_oklab,var(--ok)_10%,var(--surface))]'
          }`}
        >
          <div className="flex items-start gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-[12px] border flex items-center justify-center shrink-0 mt-0.5 bg-[var(--surface)] ${
                isConflict
                  ? 'border-[color-mix(in_oklab,var(--danger)_35%,var(--line))] text-[var(--danger)]'
                  : 'border-[color-mix(in_oklab,var(--ok)_35%,var(--line))] text-[var(--ok)]'
              }`}
            >
              {isConflict ? (
                <AlertTriangle className="w-5 h-5" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
              )}
            </div>

            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`t-badge ${isConflict ? 't-badge-danger' : 't-badge-ok'}`}>
                  {isConflict ? (
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  )}
                  <span className="t-num">
                    {isConflict
                      ? `${conflicts.length} cruce${conflicts.length === 1 ? '' : 's'} detectado${conflicts.length === 1 ? '' : 's'}`
                      : '0 cruces detectados'}
                  </span>
                </span>

                {report && (report.mirroredMovesCount > 0 || report.mirroredDeletesCount > 0) && (
                  <span className="t-badge">
                    <CalendarSync className="w-3.5 h-3.5 text-[var(--action)] shrink-0" aria-hidden="true" />
                    <span className="t-num">
                      Espejo aplicado: {report.mirroredMovesCount} movido
                      {report.mirroredMovesCount === 1 ? '' : 's'}, {report.mirroredDeletesCount} eliminado
                      {report.mirroredDeletesCount === 1 ? '' : 's'}
                    </span>
                  </span>
                )}
              </div>

              <h3 className="text-[15px] font-semibold text-[var(--ink)]">
                {isConflict
                  ? 'El cambio en Google Calendar perjudica tu horario actual'
                  : 'No hay ningún problema con tu horario actual'}
              </h3>
              <p className="text-[13px] text-[var(--muted)] leading-relaxed">
                {isConflict
                  ? 'Revisa abajo dónde choca exactamente y aplica una solución en un clic para reubicar tu bloque sin cruces.'
                  : 'Todos tus bloques locales y sesiones de gimnasio encajan con tu agenda actual de Google Calendar.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onReEvaluate}
            disabled={isEvaluating || applyingSolutionId !== null}
            aria-busy={isEvaluating}
            className="t-btn t-btn-secondary min-h-[44px] px-4 text-[13px] font-semibold shrink-0"
          >
            <RefreshCw
              className={`w-4 h-4 shrink-0 ${isEvaluating ? 'animate-spin motion-reduce:animate-none' : ''}`}
              aria-hidden="true"
            />
            <span>{isEvaluating ? 'Evaluando...' : 'Re-evaluar ahora'}</span>
          </button>
        </div>

        {/* Cambios detectados desde Google Calendar */}
        <section aria-labelledby="google-changes-heading" className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3
              id="google-changes-heading"
              className="text-[14px] font-semibold text-[var(--ink)]"
            >
              Cambios detectados desde Google Calendar
            </h3>
            <span className="t-badge t-num">
              {changes.length} cambio{changes.length === 1 ? '' : 's'}
            </span>
          </div>

          {changes.length === 0 ? (
            <div className="rounded-[14px] border border-[var(--line)] bg-[var(--surface-2)] p-4 text-[13px] text-[var(--muted)]">
              No se detectaron ediciones remotas recientes en esta lectura. Puedes volver a evaluar tu horario actual en cualquier momento.
            </div>
          ) : (
            <ul className="rounded-[14px] border border-[var(--line)] bg-[var(--surface-2)] divide-y divide-[var(--line)]">
              {changes.map((change) => {
                const meta = CHANGE_META[change.kind];
                const ChangeIcon = meta.Icon;
                return (
                  <li
                    key={change.id}
                    className="p-3.5 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`t-badge ${meta.badgeClass}`}>
                          <ChangeIcon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                          <span>{meta.label}</span>
                        </span>
                        {change.isStudentOsBlock && (
                          <span className="t-badge t-badge-ok">
                            <span>Bloque StudentOS sincronizado</span>
                          </span>
                        )}
                      </div>
                      <p className="text-[14px] font-medium text-[var(--ink)] break-words">
                        {change.title}
                      </p>
                    </div>

                    <div className="shrink-0">{renderChangeSchedule(change)}</div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Detalle de cruces y soluciones 1-clic */}
        <section aria-labelledby="conflict-evaluation-heading" className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3
              id="conflict-evaluation-heading"
              className="text-[14px] font-semibold text-[var(--ink)]"
            >
              Evaluación sobre tu horario actual
            </h3>
            <span className={`t-badge t-num ${isConflict ? 't-badge-danger' : 't-badge-ok'}`}>
              {conflicts.length} conflicto{conflicts.length === 1 ? '' : 's'}
            </span>
          </div>

          {!isConflict ? (
            <div className="rounded-[14px] border border-[var(--line)] bg-[var(--surface-2)] p-4 flex items-center gap-3 text-[13px] text-[var(--ink)]">
              <CheckCircle2 className="w-5 h-5 text-[var(--ok)] shrink-0" aria-hidden="true" />
              <span>
                Tu agenda semanal en StudentOS está limpia y no presenta traslapes horarios.
              </span>
            </div>
          ) : (
            <div className="space-y-3">
              {conflicts.map((conflict) => (
                <article
                  key={conflict.id}
                  className="rounded-[14px] border border-[color-mix(in_oklab,var(--danger)_40%,var(--line))] bg-[var(--surface)] p-4 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="t-badge t-badge-danger">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>
                        Choque en {conflict.day} ·{' '}
                        <span className="t-num">
                          {conflict.overlapStart}–{conflict.overlapEnd}
                        </span>
                      </span>
                    </span>

                    <span className="t-badge">
                      <span>
                        Origen:{' '}
                        {conflict.conflictingWithSource === 'google'
                          ? 'Google Calendar'
                          : 'Otro bloque local'}
                      </span>
                    </span>
                  </div>

                  <div className="space-y-1 text-[13px] leading-relaxed">
                    <p className="text-[var(--ink)]">
                      Tu bloque{' '}
                      <strong>&ldquo;{conflict.localBlock.title}&rdquo;</strong> (
                      <span className="t-num">
                        {conflict.localBlock.day} {conflict.localBlock.startTime}–
                        {conflict.localBlock.endTime}
                      </span>
                      ) se cruza con{' '}
                      <strong>&ldquo;{conflict.conflictingWithTitle}&rdquo;</strong> (
                      <span className="t-num">
                        {conflict.conflictingStart}–{conflict.conflictingEnd}
                      </span>
                      ).
                    </p>
                  </div>

                  {conflict.solutions.length > 0 ? (
                    <div className="pt-2 border-t border-[var(--line)] space-y-2.5">
                      <p className="text-[13px] font-medium text-[var(--muted)]">
                        Soluciones libres en 1 clic (
                        {conflict.localBlock.googleEventId || isGoogleConnected
                          ? 'actualiza StudentOS y Google Calendar'
                          : 'actualiza StudentOS'}
                        ):
                      </p>

                      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2">
                        {conflict.solutions.map((solution) => {
                          const isApplying = applyingSolutionId === solution.id;
                          return (
                            <button
                              key={solution.id}
                              type="button"
                              disabled={applyingSolutionId !== null || isEvaluating}
                              aria-busy={isApplying}
                              onClick={() => void onApplySolution(solution)}
                              className="t-btn t-btn-primary !whitespace-normal text-left h-auto min-h-[44px] py-2.5 px-3.5 text-[13px] font-semibold w-full sm:w-auto justify-start"
                            >
                              <CalendarCheck2
                                className="w-4 h-4 shrink-0"
                                aria-hidden="true"
                              />
                              <span>
                                {isApplying ? (
                                  'Moviendo horario...'
                                ) : (
                                  <>
                                    Mover &ldquo;{solution.blockTitle}&rdquo; a{' '}
                                    <span className="t-num">
                                      {solution.targetDay} {solution.startTime}–{solution.endTime}
                                    </span>{' '}
                                    ({solution.periodLabel})
                                  </>
                                )}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="pt-2 border-t border-[var(--line)] text-[13px] text-[var(--muted)]">
                      No encontramos un hueco automático libre entre{' '}
                      <span className="t-num">07:00</span> y <span className="t-num">22:00</span> esta
                      semana para moverlo con su misma duración. Reubícalo manualmente en la pestaña{' '}
                      <strong className="text-[var(--ink)]">Horario</strong>.
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </ModalShell>
  );
};
