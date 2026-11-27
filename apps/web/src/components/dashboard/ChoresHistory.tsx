import React, { useId, useMemo, useState } from 'react';
import type { ChoreDay } from '../../types';
import { CHORE_HARD_REASON_LABELS, formatShortDateEs } from '../../utils/chores';

export interface ChoresHistoryProps {
  /** Historial guardado (`useChores().history`), del día más reciente al más antiguo. */
  history: ReadonlyArray<ChoreDay>;
  /** Fecha local de hoy `AAAA-MM-DD`: hoy y lo posterior no se listan (hoy ya está en la lista de arriba). */
  today: string;
}

/** Cuántos días se muestran de golpe; «Ver más» suma otros tantos. */
export const HISTORY_PAGE_SIZE = 14;

/** Un día solo se lista si pasó algo: algo completado o un día difícil (un registro vacío no aporta nada). */
const hasSomethingToShow = (day: ChoreDay): boolean => day.completed.length > 0 || day.hard;

/**
 * Historial de quehaceres (spec 012, C11): días pasados, solo lectura. Muestra los nombres COPIADOS en cada registro, así
 * que renombrar o borrar un quehacer no cambia lo que se hizo. Un día difícil lleva una etiqueta amable, sin lenguaje de fallo.
 */
export const ChoresHistory: React.FC<ChoresHistoryProps> = ({ history, today }) => {
  const id = useId();
  const [visible, setVisible] = useState(HISTORY_PAGE_SIZE);
  const past = useMemo(() => history.filter((day) => day.date < today && hasSomethingToShow(day)), [history, today]);

  if (past.length === 0) {
    return (
      <div className="rounded-[12px] bg-[var(--surface-2)] p-4" data-testid="chores-history">
        <p className="text-[13px] text-[var(--muted)]">Aún no hay días anteriores. Aquí verás lo que hiciste cada día.</p>
      </div>
    );
  }

  const shown = past.slice(0, visible);
  return (
    <div data-testid="chores-history">
      <h4 id={`${id}-title`} className="text-[15px] font-medium text-[var(--ink)]">
        Tu historial
      </h4>
      <ul aria-labelledby={`${id}-title`} className="mt-2">
        {shown.map((day) => {
          const count = day.completed.length;
          return (
            <li key={day.date} data-date={day.date} className="py-3 border-b border-[var(--line)] last:border-b-0">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <time dateTime={day.date} className="text-[15px] font-medium text-[var(--ink)]">
                  {formatShortDateEs(day.date)}
                </time>
                {count > 0 && (
                  <span className="text-[13px] text-[var(--muted)] t-num">{count === 1 ? '1 quehacer' : `${count} quehaceres`}</span>
                )}
                {day.hard && (
                  <span className="t-badge t-badge-accent">
                    {day.reason ? `Día difícil · ${CHORE_HARD_REASON_LABELS[day.reason].toLowerCase()}` : 'Día difícil'}
                  </span>
                )}
              </div>
              {count > 0 && (
                <ul className="mt-1.5 space-y-0.5">
                  {day.completed.map((entry, index) => (
                    <li key={`${entry.choreId}-${index}`} className="text-[13px] text-[var(--muted)]">
                      {entry.name.trim() || 'Quehacer sin nombre'}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
      {past.length > shown.length && (
        <button
          type="button"
          onClick={() => setVisible((current) => current + HISTORY_PAGE_SIZE)}
          className="t-btn t-btn-secondary px-3.5 text-[13px] min-h-[44px] mt-2"
        >
          Ver más
        </button>
      )}
    </div>
  );
};
