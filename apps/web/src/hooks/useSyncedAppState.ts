import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { AppState } from '../types';
import { getApiClient } from '../services/api';
import { isSyncConfigured, useSupabaseSession } from '../services/supabase';
import { syncAdapters } from '../sync/adapters';
import { downloadBackup } from '../sync/backup';
import { createSyncEngine, type SyncEngine } from '../sync/engine';
import { stableStringify } from '../sync/hash';
import { hasImportedBefore, markImported } from '../sync/importMarker';
import { runAsLeader } from '../sync/leader';
import { getDefaultSyncStorage } from '../sync/storage';
import { syncStore } from '../sync/syncStore';
import { clearSyncDataOnSignOut } from '../utils/accountDataCleanup';

export const APP_STATE_STORAGE_KEY = 'student_os_state_v1';

export { useSyncStatus } from '../sync/syncStore';
export { SyncProvider } from '../components/sync/SyncProvider';

type SyncedTuple = [AppState, Dispatch<SetStateAction<AppState>>, () => void];

function readLocal(key: string, initial: AppState): AppState {
  try {
    const item = window.localStorage.getItem(key);
    return item ? JSON.parse(item) : initial;
  } catch (error) {
    console.warn(`Error reading localStorage key "${key}":`, error);
    return initial;
  }
}

function writeLocal(key: string, value: AppState): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`Error setting localStorage key "${key}":`, error);
  }
}

/**
 * Sustituto de `useLocalStorage<AppState>('student_os_state_v1', initialData)` con sincronizacion.
 *
 * - Misma firma de retorno: `[state, setState, reset]`.
 * - `localStorage` sigue siendo la cache local y se escribe de forma sincrona en cada cambio.
 * - Sin `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` / `VITE_API_URL`, o sin sesion iniciada,
 *   se comporta igual que `useLocalStorage`: no hay motor, ni red, ni IndexedDB.
 * - Con sesion, arranca el motor de sync (una sola pestana lider por cuenta).
 *
 * Acepta `(initial)` o `(key, initial)`.
 */
export function useSyncedAppState(initial: AppState): SyncedTuple;
export function useSyncedAppState(key: string, initial: AppState): SyncedTuple;
export function useSyncedAppState(a: AppState | string, b?: AppState): SyncedTuple {
  const key = typeof a === 'string' ? a : APP_STATE_STORAGE_KEY;
  const initial = (typeof a === 'string' ? b : a) as AppState;

  const [state, setStored] = useState<AppState>(() => readLocal(key, initial));
  const stateRef = useRef<AppState>(state);
  const initialRef = useRef<AppState>(initial);
  const engineRef = useRef<SyncEngine | null>(null);

  const session = useSupabaseSession();
  const syncEnabled = isSyncConfigured();
  const userId = syncEnabled && session.status === 'signedIn' ? (session.user?.id ?? null) : null;

  const setState = useCallback<Dispatch<SetStateAction<AppState>>>(
    (action) => {
      const next = typeof action === 'function' ? (action as (prev: AppState) => AppState)(stateRef.current) : action;
      if (Object.is(next, stateRef.current)) return;
      stateRef.current = next;
      writeLocal(key, next);
      setStored(next);
      engineRef.current?.notifyLocalChange();
    },
    [key],
  );

  const reset = useCallback(() => {
    try {
      window.localStorage.removeItem(key);
    } catch (error) {
      console.warn(`Error resetting localStorage key "${key}":`, error);
      return;
    }
    // useLocalStorage borra la clave y su efecto la reescribe con el valor inicial si el estado cambio.
    if (!Object.is(stateRef.current, initialRef.current)) writeLocal(key, initialRef.current);
    stateRef.current = initialRef.current;
    setStored(initialRef.current);
    engineRef.current?.notifyLocalChange({ immediate: true });
  }, [key]);

  // Motor de sync: solo con sesion y configuracion completa.
  useEffect(() => {
    if (!userId) return;
    const transport = getApiClient();
    if (!transport) return;

    let unsubscribeEngine: (() => void) | null = null;

    const stopLeading = runAsLeader(`studentos-sync:${userId}`, {
      onFollow: () => syncStore.setFollower(),
      onLead: () => {
        // Al ganar el liderazgo se relee localStorage: otra pestana pudo cambiar el estado mientras esperabamos.
        const fresh = readLocal(key, initialRef.current);
        if (stableStringify(fresh) !== stableStringify(stateRef.current)) {
          stateRef.current = fresh;
          setStored(fresh);
        }
        const created = createSyncEngine({
          userId,
          adapters: syncAdapters,
          storage: getDefaultSyncStorage(),
          transport,
          getState: () => stateRef.current,
          setState: (next) => {
            stateRef.current = next;
            writeLocal(key, next); // localStorage siempre va por delante de la cola persistida
            setStored(next);
          },
          isPristine: (s) => stableStringify(s) === stableStringify(initialRef.current),
          saveBackup: downloadBackup,
          hasImportedBefore: () => hasImportedBefore(userId),
          markImported: () => markImported(userId),
        });
        engineRef.current = created;
        unsubscribeEngine = created.subscribe((status) => syncStore.publish(status));
        syncStore.publish(created.getStatus());
        syncStore.setController({
          syncNow: () => created.syncNow(),
          resolveDecision: (choice) => created.resolveDecision(choice),
          resume: () => created.resume(),
        });
        const detach = created.attachBrowserEvents();
        void created.start();
        return () => {
          detach();
          unsubscribeEngine?.();
          unsubscribeEngine = null;
          void created.stop();
          if (engineRef.current === created) engineRef.current = null;
        };
      },
    });

    return () => {
      stopLeading();
      syncStore.disable();
    };
  }, [userId, key]);

  // Otras pestanas / el lider cambian localStorage: se adopta ese estado (y el lider lo sincroniza).
  useEffect(() => {
    if (!userId) return;
    const onStorage = (event: StorageEvent) => {
      if (event.key !== key || event.newValue === null) return;
      try {
        const parsed = JSON.parse(event.newValue) as AppState;
        if (stableStringify(parsed) === stableStringify(stateRef.current)) return;
        stateRef.current = parsed;
        setStored(parsed);
        engineRef.current?.notifyLocalChange();
      } catch {
        // valor corrupto: se ignora
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [userId, key]);

  // Cierre de sesion real (no desmontaje): limpia cola, cursor y snapshot.
  const previousUserRef = useRef<string | null>(null);
  useEffect(() => {
    if (!syncEnabled) return;
    if (userId) {
      previousUserRef.current = userId;
    } else if (session.status === 'signedOut' && previousUserRef.current) {
      const previous = previousUserRef.current;
      previousUserRef.current = null;
      void clearSyncDataOnSignOut(previous);
    }
  }, [syncEnabled, userId, session.status]);

  return [state, setState, reset];
}
