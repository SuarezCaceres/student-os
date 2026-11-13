import React from 'react';
import { AlertTriangle, Cloud, CloudOff, Loader2, RefreshCw } from 'lucide-react';
import { describeSyncStatus, type SyncStatusLabel } from '../../sync/describeStatus';
import { useSyncStatus } from '../../sync/syncStore';

const TONE_CLASS: Record<SyncStatusLabel['tone'], string> = {
  ok: 't-badge-ok',
  warn: 't-badge-warn',
  danger: 't-badge-danger',
  neutral: '',
};

interface SyncStatusBadgeProps {
  className?: string;
  /** Muestra el boton "Sincronizar ahora" cuando hay algo pendiente o fallo. Mide 44 px de alto. */
  interactive?: boolean;
}

/**
 * Indicador de estado de la sincronizacion. No pinta nada si la sync no esta activa
 * (sin variables de entorno o sin sesion), asi que es seguro montarlo siempre.
 */
export const SyncStatusBadge: React.FC<SyncStatusBadgeProps> = ({ className = '', interactive = false }) => {
  const status = useSyncStatus();
  if (!status.enabled) return null;

  const label = describeSyncStatus(status);
  const Icon = label.icon === 'cloud' ? Cloud : label.icon === 'off' ? CloudOff : label.icon === 'alert' ? AlertTriangle : Loader2;
  const canRetry = interactive && !status.follower && (status.pending > 0 || status.phase === 'error' || status.phase === 'offline');

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <span
        role="status"
        aria-live="polite"
        title={status.error ?? (status.follower ? 'Otra pestaña de StudentOS está sincronizando.' : undefined)}
        className={`t-badge ${TONE_CLASS[label.tone]}`}
      >
        <Icon className={`h-3.5 w-3.5 shrink-0 ${label.icon === 'spinner' ? 'animate-spin' : ''}`} aria-hidden="true" />
        <span>{label.text}</span>
      </span>
      {canRetry && (
        <button type="button" onClick={status.syncNow} className="t-btn t-btn-ghost min-h-[44px] min-w-[44px]">
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          <span>Sincronizar ahora</span>
        </button>
      )}
    </div>
  );
};
