import { useSyncExternalStore } from 'react';
import { syncStore } from '../sync/syncStore';

const getHasSynced = (): boolean => syncStore.getSnapshot().status.lastSyncAt !== null;
const getServerSnapshot = (): boolean => false;

/**
 * `true` cuando la sincronización ya terminó al menos una vez. Devuelve un booleano primitivo: el componente solo se
 * re-renderiza cuando cambia de `false` a `true`, no con cada fase que publica el store de sync (a diferencia de
 * `useSyncStatus`, que entrega un objeto nuevo en cada publicación).
 */
export function useHasSynced(): boolean {
  return useSyncExternalStore(syncStore.subscribe, getHasSynced, getServerSnapshot);
}
