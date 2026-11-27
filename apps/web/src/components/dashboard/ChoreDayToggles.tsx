import React from 'react';
import type { DayOfWeek } from '../../types';
import { ALL_DAYS } from '../../utils/chores';

export interface ChoreDayTogglesProps {
  /** Texto accesible del grupo, p. ej. «Días de Tender la cama». */
  label: string;
  value: ReadonlyArray<DayOfWeek>;
  onChange: (days: DayOfWeek[]) => void;
}

/** Siete botones (aria-pressed) para elegir en qué días de la semana aplica un quehacer. */
export const ChoreDayToggles: React.FC<ChoreDayTogglesProps> = ({ label, value, onChange }) => {
  const toggle = (day: DayOfWeek) => {
    const next = value.includes(day) ? value.filter((d) => d !== day) : [...value, day];
    onChange(ALL_DAYS.filter((d) => next.includes(d)));
  };

  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {ALL_DAYS.map((day) => {
        const active = value.includes(day);
        return (
          <button
            key={day}
            type="button"
            aria-pressed={active}
            aria-label={day}
            title={day}
            onClick={() => toggle(day)}
            className={`t-btn min-w-[44px] px-0 text-[13px] ${active ? 't-btn-primary' : 't-btn-secondary'}`}
          >
            {day.slice(0, 3)}
          </button>
        );
      })}
    </div>
  );
};
