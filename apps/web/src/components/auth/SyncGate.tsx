import React from 'react';
import { ImportDecisionModal } from '../sync/ImportDecisionModal';
import { useSyncStatus } from '../../sync/syncStore';

/**
 * Monta los dialogos de sincronizacion (importador de primer inicio de sesion) y, cuando el usuario
 * lo dejo en pausa, un aviso discreto para reanudar. No pinta nada si la sync no esta activa.
 */
export const SyncGate: React.FC = () => {
  const status = useSyncStatus();
  if (!status.enabled) return null;
  return (
    <>
      <ImportDecisionModal decision={status.decision} error={status.error} onChoose={status.resolveDecision} />
      {status.phase === 'paused' && (
        <div
          role="status"
          className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-sm z-40 rounded-[14px] border border-[var(--line-strong)] bg-[var(--surface)] p-4 text-sm text-[var(--ink)] shadow-lg"
        >
          <p>La sincronización está en pausa. Tus datos siguen guardados en este dispositivo.</p>
          <button type="button" className="t-btn t-btn-secondary mt-3" onClick={status.resume}>
            Elegir qué hacer con mis datos
          </button>
        </div>
      )}
    </>
  );
};
