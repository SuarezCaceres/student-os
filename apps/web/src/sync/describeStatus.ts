import type { SyncStatus } from './types';

export interface SyncStatusLabel {
  text: string;
  tone: 'ok' | 'warn' | 'danger' | 'neutral';
  icon: 'cloud' | 'off' | 'spinner' | 'alert';
}

/** Texto y tono del indicador segun el estado del motor. */
export function describeSyncStatus(
  status: Pick<SyncStatus, 'phase' | 'pending' | 'online' | 'waking'>,
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
  return { text: 'Sincronizado', tone: 'ok', icon: 'cloud' };
}
