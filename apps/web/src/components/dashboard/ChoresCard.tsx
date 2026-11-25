import React, { useCallback, useEffect, useId, useState } from 'react';
import { CalendarRange, CloudRain, Plus, SlidersHorizontal, Undo2 } from 'lucide-react';
import type { ChoreHardReason } from '../../types';
import type { UseChoresResult } from '../../hooks/useChores';
import { CHORE_HARD_REASON_LABELS } from '../../utils/chores';
import { ChoresChart } from './ChoresChart';
import { ChoresEditor } from './ChoresEditor';

export interface ChoresCardProps {
  /** Estado y acciones de los quehaceres (`useChores`), que `App` pasa por `OverviewBento`. */
  chores: UseChoresResult;
}

/** Tiempo de espera de la primera sincronización antes de dejar de mostrar el esqueleto. */
const SYNC_WAIT_MS = 8_000;

const HARD_REASONS = Object.keys(CHORE_HARD_REASON_LABELS) as ChoreHardReason[];

export const ChoresCard: React.FC<ChoresCardProps> = ({ chores }) => {
  const { ready, summary, stats } = chores;
  const chartId = useId();
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isChartOpen, setIsChartOpen] = useState(false);
  // Estable: ModalShell reengancha su efecto (y roba el foco) si `onClose` cambia en cada render.
  const [waitedTooLong, setWaitedTooLong] = useState(false);
  const closeEditor = useCallback(() => setIsEditorOpen(false), []);

  // Sin red o con la API caída `ready` puede tardar indefinidamente: tras un tiempo se explica en vez de seguir cargando.
  // No se siembra nada en local (se pisaría lo que la cuenta ya tenga en otro dispositivo).
  useEffect(() => {
    if (ready) return;
    const timer = setTimeout(() => setWaitedTooLong(true), SYNC_WAIT_MS);
    return () => clearTimeout(timer);
  }, [ready]);

  if (!ready && waitedTooLong) {
    return (
      <div className="t-card p-6 md:col-span-2 lg:col-span-2" data-testid="chores-offline">
        <h3 className="text-base font-medium text-[var(--ink)]">Quehaceres</h3>
        <p role="status" className="text-[13px] text-[var(--muted)] mt-2">
          Sin conexión: tus quehaceres aparecerán cuando se sincronice tu cuenta
        </p>
      </div>
    );
  }

  if (!ready) {
    return (
      <div
        className="t-card p-6 md:col-span-2 lg:col-span-2"
        role="status"
        aria-busy="true"
        aria-label="Cargando quehaceres"
        data-testid="chores-skeleton"
      >
        <div className="h-5 w-32 rounded-full bg-[var(--surface-2)] motion-safe:animate-pulse" />
        <div className="h-3 w-48 rounded-full bg-[var(--surface-2)] mt-2 motion-safe:animate-pulse" />
        <div className="mt-6 space-y-4">
          {[0, 1, 2, 3].map((n) => (
            <div key={n} className="h-5 rounded-full bg-[var(--surface-2)] motion-safe:animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const { applicableCount, completedCount, hard, goal, status } = summary;
  const total = Math.max(applicableCount, completedCount);
  const showBar = !hard && applicableCount > 0;
  // Con todos los niveles alcanzados (`goal` nulo) la barra queda llena; nunca se divide entre cero.
  const percent = goal === null ? 100 : Math.min(100, Math.round((completedCount / Math.max(1, goal)) * 100));
  const reached = status === 'level' || status === 'all-done';

  return (
    <div className="t-card p-6 md:col-span-2 lg:col-span-2 flex flex-col" data-testid="chores-card">
      <div className="flex items-start justify-between gap-2 pb-3.5 border-b border-[var(--line)]">
        <div className="min-w-0">
          <h3 className="text-base font-medium text-[var(--ink)]">Quehaceres</h3>
          <p className="text-[13px] text-[var(--muted)] mt-0.5">{summary.dayOfWeek} · reinicio diario</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsEditorOpen(true)}
            aria-label="Editar quehaceres y metas"
            className="t-btn t-btn-ghost px-2.5 text-[13px]"
            title="Editar quehaceres y metas"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Editar</span>
          </button>
          <span
            className={`t-badge t-num ${reached ? 't-badge-ok' : 't-badge-accent'}`}
            aria-label={`${completedCount} de ${total} quehaceres completados`}
          >
            {completedCount}/{total}
          </span>
        </div>
      </div>

      <p
        aria-live="polite"
        className={`text-[15px] font-medium mt-3.5 ${hard ? 'text-[var(--ink)]' : reached ? 'text-[var(--ok)]' : 'text-[var(--ink)]'}`}
        data-testid="chores-message"
      >
        {summary.message}
      </p>

      {showBar && (
        <div
          role="progressbar"
          aria-label="Progreso hacia la meta de hoy"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className="w-full h-1.5 rounded-full bg-[var(--surface-2)] overflow-hidden mt-2.5"
        >
          <div
            className="h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none"
            style={{ width: `${percent}%`, backgroundColor: percent >= 100 ? 'var(--ok)' : 'var(--action)' }}
          />
        </div>
      )}

      {hard && (
        <div className="mt-3 rounded-[12px] bg-[var(--surface-2)] p-3.5" data-testid="chores-hard-panel">
          <p className="text-[13px] text-[var(--muted)]" id={`${chartId}-reason`}>
            ¿Quieres contar qué pasó? Es opcional.
          </p>
          <div role="group" aria-labelledby={`${chartId}-reason`} className="flex flex-wrap gap-2 mt-2">
            {HARD_REASONS.map((reason) => (
              <button
                key={reason}
                type="button"
                aria-pressed={summary.reason === reason}
                onClick={() => chores.markHardDay(summary.reason === reason ? undefined : reason)}
                className={`t-btn px-3.5 text-[13px] ${summary.reason === reason ? 't-btn-primary' : 't-btn-secondary'}`}
              >
                {CHORE_HARD_REASON_LABELS[reason]}
              </button>
            ))}
          </div>
        </div>
      )}

      {applicableCount === 0 ? (
        !hard && (
          <div className="mt-4 flex flex-col items-start gap-3" data-testid="chores-empty">
            <button type="button" onClick={() => setIsEditorOpen(true)} className="t-btn t-btn-secondary px-3.5 text-[13px]">
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Añadir un quehacer</span>
            </button>
          </div>
        )
      ) : (
        <ul aria-label="Quehaceres de hoy" className="mt-3 grid grid-cols-1 lg:grid-cols-2 lg:gap-x-8">
          {summary.items.map(({ chore, done }) => (
            <li key={chore.id} className="border-b border-[var(--line)] last:border-b-0 lg:[&:nth-last-child(2):nth-child(odd)]:border-b-0">
              <label className="flex items-center gap-3 min-h-[44px] py-1.5 cursor-pointer">
                <input type="checkbox" className="m-check" checked={done} onChange={() => chores.toggle(chore.id)} />
                <span className={`text-[15px] ${done ? 'text-[var(--muted)] line-through' : 'text-[var(--ink)]'}`}>
                  {chore.name}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {hard ? (
          <button type="button" onClick={chores.undoHardDay} className="t-btn t-btn-secondary px-3.5 text-[13px]">
            <Undo2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Deshacer</span>
          </button>
        ) : (
          <button type="button" onClick={() => chores.markHardDay()} className="t-btn t-btn-secondary px-3.5 text-[13px]">
            <CloudRain className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Hoy no puedo</span>
          </button>
        )}
        <button
          type="button"
          aria-expanded={isChartOpen}
          aria-controls={`${chartId}-chart`}
          onClick={() => setIsChartOpen((open) => !open)}
          className="t-btn t-btn-ghost px-3 text-[13px] ml-auto"
        >
          <CalendarRange className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{isChartOpen ? 'Ocultar tu semana' : 'Ver tu semana'}</span>
        </button>
      </div>

      {isChartOpen && (
        <div id={`${chartId}-chart`} className="mt-4 pt-4 border-t border-[var(--line)]">
          <ChoresChart stats={stats} />
        </div>
      )}

      <ChoresEditor isOpen={isEditorOpen} onClose={closeEditor} chores={chores} />
    </div>
  );
};
