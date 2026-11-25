import React, { useId, useRef, useState } from 'react';
import { Plus, SlidersHorizontal } from 'lucide-react';
import type { UseChoresResult } from '../../hooks/useChores';
import type { DayOfWeek } from '../../types';
import {
  ALL_DAYS,
  CHORE_EDIT_ERROR_MESSAGES,
  hasDuplicateChoreName,
  MAX_CHORE_NAME_LENGTH,
  MAX_CHORES,
} from '../../utils/chores';
import { ModalShell } from '../common/ModalShell';
import { ChoreDayToggles } from './ChoreDayToggles';
import { ChoreEditorRow } from './ChoreEditorRow';
import { ChoreLevelsForm } from './ChoreLevelsForm';

export interface ChoresEditorProps {
  isOpen: boolean;
  onClose: () => void;
  chores: UseChoresResult;
}

const AddChoreForm: React.FC<{ chores: UseChoresResult; inputRef: React.RefObject<HTMLInputElement | null> }> = ({ chores, inputRef }) => {
  const inputId = useId();
  const [name, setName] = useState('');
  const [days, setDays] = useState<DayOfWeek[]>([...ALL_DAYS]);
  const [error, setError] = useState<string | null>(null);
  const duplicate = name.trim() !== '' && hasDuplicateChoreName(chores.chores, name);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = chores.add(name, days);
    if (result.ok) {
      setName('');
      setDays([...ALL_DAYS]);
      setError(null);
    } else {
      setError(CHORE_EDIT_ERROR_MESSAGES[result.error]);
    }
  };

  return (
    <form onSubmit={submit} aria-label="Añadir quehacer" className="space-y-2.5">
      <label htmlFor={inputId} className="t-label text-[13px]">
        Nuevo quehacer
      </label>
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          value={name}
          maxLength={MAX_CHORE_NAME_LENGTH + 20}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej.: caminar 15 minutos"
          aria-invalid={error ? true : undefined}
          className="t-input"
        />
        <button type="submit" disabled={!chores.canAdd} className="t-btn t-btn-primary px-3.5 text-[13px] shrink-0">
          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Añadir</span>
        </button>
      </div>
      <ChoreDayToggles label="Días del nuevo quehacer" value={days} onChange={setDays} />
      {duplicate && (
        <p role="status" className="text-[13px] text-[var(--warn)]">
          Ya tienes un quehacer con ese nombre. Puedes añadirlo igual si quieres.
        </p>
      )}
      {!chores.canAdd && <p className="text-[13px] text-[var(--muted)]">{CHORE_EDIT_ERROR_MESSAGES.limit}</p>}
      {error && (
        <p role="alert" className="text-[13px] text-[var(--danger)]">
          {error}
        </p>
      )}
    </form>
  );
};

/** Editor de quehaceres (añadir, renombrar, días, eliminar) y de metas con mensajes. Vive en un modal. */
export const ChoresEditor: React.FC<ChoresEditorProps> = ({ isOpen, onClose, chores }) => {
  const addInputRef = useRef<HTMLInputElement>(null);
  // Al eliminar, la fila (y el botón con el foco) desaparece: el foco pasa al campo de añadir.
  const focusAddInput = () => addInputRef.current?.focus();

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="Editar quehaceres"
      subtitle="Tu lista, los días de cada uno y tus metas de ánimo."
      icon={<SlidersHorizontal className="w-5 h-5" aria-hidden="true" />}
      maxWidth="xl"
      footer={
        <button type="button" onClick={onClose} className="t-btn t-btn-primary px-4">
          Listo
        </button>
      }
    >
      <div className="space-y-7">
        <section aria-labelledby="chores-editor-list">
          <div className="flex items-baseline justify-between gap-2 mb-3">
            <h3 id="chores-editor-list" className="text-base font-medium text-[var(--ink)]">
              Tus quehaceres
            </h3>
            <span className="t-num text-[13px] text-[var(--muted)]" aria-label={`${chores.chores.length} de ${MAX_CHORES} quehaceres`}>
              {chores.chores.length}/{MAX_CHORES}
            </span>
          </div>
          <AddChoreForm chores={chores} inputRef={addInputRef} />
          {chores.chores.length === 0 ? (
            <p className="text-[13px] text-[var(--muted)] mt-4">Todavía no tienes quehaceres. Añade el primero arriba.</p>
          ) : (
            <ul aria-label="Lista de quehaceres" className="mt-4 border-t border-[var(--line)]">
              {chores.chores.map((chore) => (
                <ChoreEditorRow key={chore.id} chore={chore} chores={chores} onRemoved={focusAddInput} />
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="chores-editor-levels">
          <h3 id="chores-editor-levels" className="text-base font-medium text-[var(--ink)]">
            Metas y mensajes
          </h3>
          <p className="text-[13px] text-[var(--muted)] mt-0.5 mb-3">
            Al completar esa cantidad en un día verás el mensaje de la meta.
          </p>
          <ChoreLevelsForm chores={chores} />
        </section>
      </div>
    </ModalShell>
  );
};
