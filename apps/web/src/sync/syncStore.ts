import { useMemo, useSyncExternalStore } from 'react';
import { OFF_STATUS, type DecisionChoice, type SyncStatus } from './types';

/**
 * Store externo (fuera de React) con el estado de la sync. Lo escribe el hook `useSyncedAppState`
 * (que vive en App) y lo leen `SyncStatusBadge`, el modal del importador y `useSyncStatus()`.
 * Asi no hace falta un provider para que el indicador funcione.
 */
export interface SyncController {
  syncNow(): Promise<void>;
  resolveDecision(choice: DecisionChoice): Promise<void>;
  resume(): void;
}

interface StoreState {
  enabled: boolean;
  status: SyncStatus;
}

const CHANNEL_NAME = 'studentos-sync-status';
const DISABLED: StoreState = { enabled: false, status: OFF_STATUS };

let state: StoreState = DISABLED;
let controller: SyncController | null = null;
let channel: BroadcastChannel | null = null;
let isFollower = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

function getChannel(): BroadcastChannel | null {
  if (channel || typeof BroadcastChannel === 'undefined') return channel;
  try {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (event: MessageEvent) => {
      if (!isFollower) return;
      const status = event.data as SyncStatus | undefined;
      if (!status || typeof status.phase !== 'string') return;
      state = { enabled: true, status: { ...status, decision: null, follower: true } };
      notify();
    };
  } catch {
    channel = null;
  }
  return channel;
}

export const syncStore = {
  getSnapshot: (): StoreState => state,
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  /** El lider publica su estado; las otras pestanas lo reflejan. */
  publish(status: SyncStatus): void {
    isFollower = false;
    state = { enabled: true, status };
    notify();
    try {
      getChannel()?.postMessage({ ...status, decision: null });
    } catch {
      // ignore
    }
  },
  setFollower(): void {
    isFollower = true;
    getChannel();
    state = { enabled: true, status: { ...OFF_STATUS, phase: 'idle', follower: true } };
    notify();
  },
  setController(next: SyncController | null): void {
    controller = next;
  },
  /** Sesion cerrada o sync no configurada: vuelve al estado "apagado". */
  disable(): void {
    isFollower = false;
    controller = null;
    if (state === DISABLED) return;
    state = DISABLED;
    notify();
  },
  getController: (): SyncController | null => controller,
};

export type SyncStatusView = SyncStatus & {
  /** false si no hay sync (sin variables de entorno o sin sesion). */
  enabled: boolean;
  syncNow: () => void;
  resolveDecision: (choice: DecisionChoice) => void;
  resume: () => void;
};

/** Estado de la sincronizacion para la UI. Con sync apagada devuelve `enabled: false`. */
export function useSyncStatus(): SyncStatusView {
  const snapshot = useSyncExternalStore(syncStore.subscribe, syncStore.getSnapshot, () => DISABLED);
  return useMemo(
    () => ({
      ...snapshot.status,
      enabled: snapshot.enabled,
      syncNow: () => void syncStore.getController()?.syncNow(),
      resolveDecision: (choice: DecisionChoice) => void syncStore.getController()?.resolveDecision(choice),
      resume: () => syncStore.getController()?.resume(),
    }),
    [snapshot],
  );
}
