import React, { useEffect, useId, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { UseChoresResult } from '../../hooks/useChores';
import type { Chore } from '../../types';
import { CHORE_EDIT_ERROR_MESSAGES, hasDuplicateChoreName, MAX_CHORE_NAME_LENGTH } from '../../utils/chores';
import { ChoreDayToggles } from './ChoreDayToggles';

export interface ChoreEditorRowProps {
  chore: Chore;
  chores: UseChoresResult;
  /** Se llama cuando el quehacer se eliminó, para que el editor reubique el foco (la fila ya no existe). */
  onRemoved?: () => void;
}

/** Una fila del editor: renombrar (al salir del campo o con Enter), días de la semana y eliminar con confirmación. */
export const ChoreEditorRow: React.FC<ChoreEditorRowProps> = ({ chore, chores, onRemoved }) => {
  const inputId = useId();
  const [draft, setDraft] = useState(chore.name);
  const [error, setError] = useState<string | null>(null);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const removeButtonRef = useRef<HTMLButtonElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef(false);

  // El icono de eliminar se desmonta al pedir confirmación: el foco pasa a «Cancelar» y vuelve al icono si se cancela.
  useEffect(() => {
    if (confirmingRemove) {
      cancelButtonRef.current?.focus();
    } else if (restoreFocusRef.current) {
      restoreFocusRef.current = false;
      removeButtonRef.current?.focus();
    }
  }, [confirmingRemove]);

  const duplicate = draft.trim() !== chore.name && hasDuplicateChoreName(chores.chores, draft, chore.id);

  const commitName = () => {
    if (draft.trim() === chore.name) {
      setDraft(chore.name);
      setError(null);
      return;
    }
    const result = chores.rename(chore.id, draft);
    if (result.ok) {
      setDraft(result.value.name);
      setError(null);
    } else {
      setError(CHORE_EDIT_ERROR_MESSAGES[result.error]);
    }
  };

  const changeDays = (days: Chore['days']) => {
    const result = chores.setDays(chore.id, days);
    setError(result.ok ? null : CHORE_EDIT_ERROR_MESSAGES[result.error]);
  };

  const remove = () => {
    const result = chores.remove(chore.id);
    if (result.ok) onRemoved?.();
    else setError(CHORE_EDIT_ERROR_MESSAGES[result.error]);
  };

  const cancelRemove = () => {
    restoreFocusRef.current = true;
    setConfirmingRemove(false);
  };

  return (
    <li className="py-3.5 border-b border-[var(--line)] last:border-b-0 space-y-2.5" data-testid="chore-editor-row">
      <div className="flex items-center gap-2">
        <label htmlFor={inputId} className="sr-only">
          Nombre de {chore.name}
        </label>
        <input
          id={inputId}
          type="text"
          value={draft}
          maxLength={MAX_CHORE_NAME_LENGTH + 20}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitName();
            } else if (e.key === 'Escape' && draft !== chore.name) {
              e.stopPropagation();
              setDraft(chore.name);
              setError(null);
            }
          }}
          aria-invalid={error ? true : undefined}
          className="t-input"
        />
        {!confirmingRemove && (
          <button
            ref={removeButtonRef}
            type="button"
            onClick={() => setConfirmingRemove(true)}
            className="t-btn t-btn-ghost t-btn-icon shrink-0"
            aria-label={`Eliminar ${chore.name}`}
            title="Eliminar"
          >
            <Trash2 className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {confirmingRemove && (
        <div className="flex flex-wrap items-center gap-2 rounded-[12px] bg-[var(--surface-2)] p-3">
          <span className="text-[13px] text-[var(--ink)] mr-auto">
            ¿Eliminar «{chore.name}»? Lo que ya completaste en días pasados se conserva.
          </span>
          <button ref={cancelButtonRef} type="button" onClick={cancelRemove} className="t-btn t-btn-secondary px-3 text-[13px]">
            Cancelar
          </button>
          <button type="button" onClick={remove} className="t-btn t-btn-primary px-3 text-[13px]" aria-label={`Sí, eliminar ${chore.name}`}>
            Sí, eliminar
          </button>
        </div>
      )}

      {duplicate && (
        <p role="status" className="text-[13px] text-[var(--warn)]">
          Ya tienes otro quehacer con ese nombre. Puedes dejarlo así si quieres.
        </p>
      )}
      {error && (
        <p role="alert" className="text-[13px] text-[var(--danger)]">
          {error}
        </p>
      )}

      <ChoreDayToggles label={`Días de ${chore.name}`} value={chore.days} onChange={changeDays} />
    </li>
  );
};
