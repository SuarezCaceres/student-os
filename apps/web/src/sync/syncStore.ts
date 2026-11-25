import { useMemo, useSyncExternalStore } from 'react';
import { OFF_STATUS, type SyncStatus } from './types';

/**
 * Store externo (fuera de React) con el estado de la sync. Lo escribe el hook `useSyncedAppState`
 * (que vive en App) y lo leen `SyncStatusBadge` y `useSyncStatus()`.
 * Asi no hace falta un provider para que el indicador funcione.
 */
export interface SyncController {
  syncNow(): Promise<void>;
  /** Registra ya los cambios locales que aun esperan al debounce, para que cuenten como pendientes. */
  observeNow?(): void;
}

/** Tiempo maximo que se espera a subir lo pendiente antes de cerrar sesion (spec 010, C7). */
export const FLUSH_TIMEOUT_MS = 5000;

export interface FlushResult {
  /** `false` si esta pestana no puede sincronizar (sync apagada u otra pestana lider). */
  attempted: boolean;
  /** Se agoto el tiempo antes de terminar (servidor dormido, red lenta). */
  timedOut: boolean;
  /** Cambios locales que siguen sin subir al terminar. */
  pending: number;
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
      state = { enabled: true, status: { ...status, follower: true } };
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
      getChannel()?.postMessage(status);
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
  /**
   * Intenta subir lo pendiente con un tiempo maximo y dice cuanto queda sin subir. Nunca lanza ni se cuelga: es lo que
   * usa «Cerrar sesion» para no perder trabajo (spec 010). No cambia el motor: solo pide una sincronizacion y espera.
   */
  async flushPending(timeoutMs: number = FLUSH_TIMEOUT_MS): Promise<FlushResult> {
    const current = controller;
    if (!current || !state.enabled) return { attempted: false, timedOut: false, pending: state.status.pending };
    current.observeNow?.();
    let timedOut = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const limit = new Promise<void>((resolve) => {
      timer = setTimeout(() => {
        timedOut = true;
        resolve();
      }, timeoutMs);
    });
    try {
      await Promise.race([current.syncNow().catch(() => undefined), limit]);
    } finally {
      if (timer) clearTimeout(timer);
    }
    return { attempted: true, timedOut, pending: state.status.pending };
  },
};

export type SyncStatusView = SyncStatus & {
  /** false si no hay sync (sin variables de entorno o sin sesion). */
  enabled: boolean;
  syncNow: () => void;
};

/** Estado de la sincronizacion para la UI. Con sync apagada devuelve `enabled: false`. */
export function useSyncStatus(): SyncStatusView {
  const snapshot = useSyncExternalStore(syncStore.subscribe, syncStore.getSnapshot, () => DISABLED);
  return useMemo(
    () => ({
      ...snapshot.status,
      enabled: snapshot.enabled,
      syncNow: () => void syncStore.getController()?.syncNow(),
    }),
    [snapshot],
  );
}
