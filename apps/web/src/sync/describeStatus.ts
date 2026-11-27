import type { SyncStatus } from './types';

export interface SyncStatusLabel {
  text: string;
  tone: 'ok' | 'warn' | 'danger' | 'neutral';
  icon: 'cloud' | 'off' | 'spinner' | 'alert';
  /** Explicacion visible para la persona (limites de la cuenta y cambios rechazados). */
  detail?: string;
}

/** El motor deja este texto en `status.error` cuando la API responde 422 (cuota de registros de la cuenta). */
const QUOTA_ERROR = /límite de registros/i;

export const QUOTA_DETAIL =
  'Llegaste al límite de tu cuenta (5000 registros). Libera espacio para seguir sincronizando; lo que ya guardaste está a salvo.';
export const REJECTED_DETAIL =
  'Algunos cambios no se pudieron sincronizar. Un elemento puede ser demasiado grande (máximo 64 KB): redúcelo para que se guarde.';

/** Texto y tono del indicador segun el estado del motor. */
export function describeSyncStatus(
  status: Pick<SyncStatus, 'phase' | 'pending' | 'online' | 'waking'> & Partial<Pick<SyncStatus, 'error' | 'rejected'>>,
): SyncStatusLabel {
  if (!status.online || status.phase === 'offline') {
    return {
      text: status.pending > 0 ? `Sin conexión (${status.pending} pendientes)` : 'Sin conexión',
      tone: 'warn',
      icon: 'off',
    };
  }
  if (status.waking) return { text: 'Despertando el servidor…', tone: 'neutral', icon: 'spinner' };
  if (status.phase === 'starting') return { text: 'Conectando…', tone: 'neutral', icon: 'spinner' };
  if (status.phase === 'error' && status.error && QUOTA_ERROR.test(status.error)) {
    return { text: 'Límite de la cuenta alcanzado', tone: 'danger', icon: 'alert', detail: QUOTA_DETAIL };
  }
  if (status.phase === 'error') {
    return {
      text: status.pending > 0 ? `Pendiente (${status.pending})` : 'No se pudo sincronizar',
      tone: 'danger',
      icon: 'alert',
    };
  }
  if (status.pending > 0) {
    return { text: `Pendiente (${status.pending})`, tone: 'warn', icon: status.phase === 'syncing' ? 'spinner' : 'cloud' };
  }
  if (status.phase === 'syncing') return { text: 'Sincronizando…', tone: 'neutral', icon: 'spinner' };
  if ((status.rejected ?? 0) > 0) {
    return { text: `Sin sincronizar (${status.rejected})`, tone: 'warn', icon: 'alert', detail: REJECTED_DETAIL };
  }
  return { text: 'Sincronizado', tone: 'ok', icon: 'cloud' };
}
