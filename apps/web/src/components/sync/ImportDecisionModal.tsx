import React, { useState } from 'react';
import { CloudUpload, Download, Smartphone, Cloud } from 'lucide-react';
import { ModalShell } from '../common/ModalShell';
import type { DataSummary, DecisionChoice, SyncDecision } from '../../sync/types';

const COLLECTION_LABEL: Record<string, string> = {
  profile: 'perfil',
  kanban: 'tareas del tablero',
  university: 'entregas',
  learning: 'reflexiones semanales',
  gym: 'registros de gym',
  calendar: 'bloques del calendario',
};

function describe(summary: DataSummary): string {
  const parts = Object.entries(summary.byCollection)
    .filter(([, n]) => (n ?? 0) > 0)
    .map(([c, n]) => `${n} ${COLLECTION_LABEL[c] ?? c}`);
  return parts.length > 0 ? parts.join(', ') : 'sin datos';
}

interface ImportDecisionModalProps {
  decision: SyncDecision | null;
  error?: string | null;
  onChoose: (choice: DecisionChoice) => void;
}

/**
 * Primer inicio de sesion con datos locales: nunca se fusiona a ciegas ni se borra sin confirmar.
 * Cerrar el modal (Esc o la X) equivale a "Ahora no": la sync queda en pausa y no se toca nada.
 */
export const ImportDecisionModal: React.FC<ImportDecisionModalProps> = ({ decision, error, onChoose }) => {
  const [confirming, setConfirming] = useState<'cloud' | 'local' | null>(null);
  const [busy, setBusy] = useState(false);

  if (!decision) return null;

  const choose = (choice: DecisionChoice) => {
    setBusy(true);
    onChoose(choice);
    // El modal se desmonta cuando el motor resuelve; si hubo error, se reactiva.
    window.setTimeout(() => setBusy(false), 1500);
  };
  const close = () => {
    setConfirming(null);
    onChoose('skip');
  };

  if (decision.kind === 'upload') {
    return (
      <ModalShell
        isOpen
        onClose={close}
        title="¿Subimos tus datos a la nube?"
        subtitle="Tu cuenta todavía está vacía."
        icon={<CloudUpload className="w-5 h-5" aria-hidden="true" />}
        maxWidth="md"
        footer={
          <>
            <button type="button" className="t-btn t-btn-secondary" onClick={close} disabled={busy}>
              Ahora no
            </button>
            <button type="button" className="t-btn t-btn-primary" onClick={() => choose('upload')} disabled={busy}>
              Subir mis datos
            </button>
          </>
        }
      >
        <p className="text-sm text-[var(--ink)]">
          Encontramos en este dispositivo: <strong>{describe(decision.local)}</strong>. Si los subes, aparecerán en tus
          otros dispositivos.
        </p>
        <p className="mt-3 flex items-start gap-2 text-[13px] text-[var(--muted)]">
          <Download className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
          <span>Antes de subir descargamos un respaldo (archivo JSON) por si lo necesitas.</span>
        </p>
        {error && (
          <p role="alert" className="mt-3 text-[13px] text-[var(--danger)]">
            {error}
          </p>
        )}
      </ModalShell>
    );
  }

  const confirmCopy =
    confirming === 'cloud'
      ? 'Se reemplazará lo de este dispositivo por lo de tu cuenta. Descargamos un respaldo de lo que hay aquí antes de hacerlo.'
      : 'Se reemplazará lo de tu nube por lo de este dispositivo. Descargamos un respaldo de ambos lados antes de hacerlo.';

  return (
    <ModalShell
      isOpen
      onClose={close}
      title="Tienes datos aquí y en la nube"
      subtitle="Elige cuáles conservar. No mezclamos nada sin que lo decidas."
      icon={<Cloud className="w-5 h-5" aria-hidden="true" />}
      maxWidth="lg"
      footer={
        confirming ? (
          <>
            <button type="button" className="t-btn t-btn-secondary" onClick={() => setConfirming(null)} disabled={busy}>
              Volver
            </button>
            <button type="button" className="t-btn t-btn-primary" onClick={() => choose(confirming)} disabled={busy}>
              Sí, reemplazar
            </button>
          </>
        ) : (
          <button type="button" className="t-btn t-btn-ghost" onClick={close}>
            Decidir después
          </button>
        )
      }
    >
      {confirming ? (
        <p className="text-sm text-[var(--ink)]">{confirmCopy}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setConfirming('cloud')}
            className="t-card text-left p-4 min-h-[44px] cursor-pointer hover:border-[var(--action)]"
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
              <Cloud className="h-4 w-4" aria-hidden="true" /> Usar la nube
            </span>
            <span className="mt-1 block text-[13px] text-[var(--muted)]">En tu cuenta: {describe(decision.cloud)}.</span>
          </button>
          <button
            type="button"
            onClick={() => setConfirming('local')}
            className="t-card text-left p-4 min-h-[44px] cursor-pointer hover:border-[var(--action)]"
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
              <Smartphone className="h-4 w-4" aria-hidden="true" /> Conservar lo de este dispositivo
            </span>
            <span className="mt-1 block text-[13px] text-[var(--muted)]">Aquí: {describe(decision.local)}.</span>
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 text-[13px] text-[var(--danger)]">
          {error}
        </p>
      )}
    </ModalShell>
  );
};
