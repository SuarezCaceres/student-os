import React, { useId, useState } from 'react';
import { Check, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { MAX_CHORE_LEVEL_MESSAGE_LENGTH, MAX_CHORE_LEVELS } from '@student-os/shared';
import type { UseChoresResult } from '../../hooks/useChores';
import { CHORE_EDIT_ERROR_MESSAGES, DEFAULT_CHORE_LEVELS } from '../../utils/chores';

interface LevelDraft {
  key: number;
  min: string;
  message: string;
}

let nextKey = 0;
const toDrafts = (levels: ReadonlyArray<{ min: number; message: string }>): LevelDraft[] =>
  levels.map((level) => ({ key: nextKey++, min: String(level.min), message: level.message }));

export interface ChoreLevelsFormProps {
  chores: UseChoresResult;
}

/** Umbrales y mensajes de motivación (C6). Se guardan con «Guardar metas»; `setLevels` los valida y ordena. */
export const ChoreLevelsForm: React.FC<ChoreLevelsFormProps> = ({ chores }) => {
  const formId = useId();
  const [drafts, setDrafts] = useState<LevelDraft[]>(() => toDrafts(chores.levels));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const edit = (key: number, changes: Partial<LevelDraft>) => {
    setDrafts((list) => list.map((draft) => (draft.key === key ? { ...draft, ...changes } : draft)));
    setSaved(false);
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const result = chores.setLevels(
      drafts.map((draft) => ({ min: draft.min.trim() === '' ? Number.NaN : Number(draft.min), message: draft.message })),
    );
    if (result.ok) {
      setError(null);
      setSaved(true);
      setDrafts(toDrafts(result.value));
    } else {
      setSaved(false);
      setError(CHORE_EDIT_ERROR_MESSAGES[result.error]);
    }
  };

  return (
    <form onSubmit={save} aria-label="Metas y mensajes de ánimo" className="space-y-3">
      <ul className="space-y-3">
        {drafts.map((draft, index) => (
          <li key={draft.key} className="grid grid-cols-[88px_1fr_auto] items-end gap-2">
            <div>
              <label htmlFor={`${formId}-min-${draft.key}`} className="t-label text-[13px]">
                Cantidad
              </label>
              <input
                id={`${formId}-min-${draft.key}`}
                type="number"
                inputMode="numeric"
                min={1}
                max={99}
                value={draft.min}
                onChange={(e) => edit(draft.key, { min: e.target.value })}
                className="t-input t-num"
                aria-label={`Cantidad de la meta ${index + 1}`}
              />
            </div>
            <div className="min-w-0">
              <label htmlFor={`${formId}-msg-${draft.key}`} className="t-label text-[13px]">
                Mensaje
              </label>
              <input
                id={`${formId}-msg-${draft.key}`}
                type="text"
                maxLength={MAX_CHORE_LEVEL_MESSAGE_LENGTH + 20}
                value={draft.message}
                onChange={(e) => edit(draft.key, { message: e.target.value })}
                className="t-input"
                aria-label={`Mensaje de la meta ${index + 1}`}
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setDrafts((list) => list.filter((item) => item.key !== draft.key));
                setSaved(false);
              }}
              className="t-btn t-btn-ghost t-btn-icon"
              aria-label={`Quitar la meta ${index + 1}`}
              title="Quitar meta"
            >
              <Trash2 className="w-4 h-4" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>

      {drafts.length === 0 && (
        <p className="text-[13px] text-[var(--muted)]">Sin metas: solo verás cuántos quehaceres llevas hoy.</p>
      )}
      {error && (
        <p role="alert" className="text-[13px] text-[var(--danger)]">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="text-[13px] text-[var(--ok)]">
          Metas guardadas.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={drafts.length >= MAX_CHORE_LEVELS}
          onClick={() => {
            const highest = drafts.reduce((max, draft) => Math.max(max, Number(draft.min) || 0), 0);
            setDrafts((list) => [...list, { key: nextKey++, min: String(Math.min(99, highest + 5)), message: '' }]);
            setSaved(false);
          }}
          className="t-btn t-btn-secondary px-3 text-[13px]"
        >
          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Añadir meta</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setDrafts(toDrafts(DEFAULT_CHORE_LEVELS));
            setSaved(false);
          }}
          className="t-btn t-btn-ghost px-3 text-[13px]"
        >
          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Valores por defecto</span>
        </button>
        <button type="submit" className="t-btn t-btn-primary px-3.5 text-[13px] ml-auto">
          <Check className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Guardar metas</span>
        </button>
      </div>
    </form>
  );
};
