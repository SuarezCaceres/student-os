import { createStore, del, get, keys, set, type UseStore } from 'idb-keyval';

/**
 * Almacen clave/valor asincrono para el estado del motor de sync (cola, cursor, snapshot).
 * Produccion: IndexedDB via `idb-keyval`. Si IndexedDB no esta disponible (modo privado de algunos
 * navegadores) se degrada a memoria: la sync sigue funcionando mientras la pestana viva y localStorage
 * conserva los datos; al recargar, el diff inicial recupera los cambios.
 */
export interface SyncStorage {
  get<T = unknown>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  del(key: string): Promise<void>;
  /** Claves existentes (para limpiar por prefijo al cerrar sesion). */
  keys(): Promise<string[]>;
}

export const SYNC_DB_NAME = 'studentos-sync';
export const SYNC_STORE_NAME = 'kv';

export function createMemoryStorage(): SyncStorage {
  const map = new Map<string, unknown>();
  return {
    get: async <T,>(key: string) => (map.has(key) ? (structuredClone(map.get(key)) as T) : undefined),
    set: async (key, value) => {
      map.set(key, structuredClone(value));
    },
    del: async (key) => {
      map.delete(key);
    },
    keys: async () => [...map.keys()],
  };
}

export function createIdbStorage(dbName = SYNC_DB_NAME, storeName = SYNC_STORE_NAME): SyncStorage {
  let store: UseStore | null = null;
  const memory = createMemoryStorage();
  let degraded = false;

  const getStore = () => {
    if (!store) store = createStore(dbName, storeName);
    return store;
  };

  const guard = async <T,>(op: () => Promise<T>, fallback: () => Promise<T>): Promise<T> => {
    if (degraded) return fallback();
    try {
      return await op();
    } catch (error) {
      degraded = true;
      console.warn('IndexedDB no está disponible; la cola de sync vivirá solo en memoria.', error);
      return fallback();
    }
  };

  return {
    get: <T,>(key: string) => guard(() => get<T>(key, getStore()), () => memory.get<T>(key)),
    set: (key, value) => guard(() => set(key, value, getStore()), () => memory.set(key, value)),
    del: (key) => guard(() => del(key, getStore()), () => memory.del(key)),
    keys: () =>
      guard(
        async () => (await keys(getStore())).map(String),
        () => memory.keys(),
      ),
  };
}

let defaultStorage: SyncStorage | null = null;

export function getDefaultSyncStorage(): SyncStorage {
  if (!defaultStorage) defaultStorage = createIdbStorage();
  return defaultStorage;
}

/** Clave del documento de sync de un usuario (cola + cursor + snapshot + versiones). */
export const syncDocKey = (userId: string) => `doc:${userId}`;
export const SYNC_DOC_PREFIX = 'doc:';
