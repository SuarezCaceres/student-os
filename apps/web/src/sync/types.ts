import type { Collection, SyncRecord } from '@student-os/shared';
import type { AppState } from '../types';
import type { ApiStatus } from '../services/api';

/** Clave de un registro dentro del motor: `<coleccion>/<id>`. */
export type RecordKey = string;

export const keyOf = (collection: Collection, id: string): RecordKey => `${collection}/${id}`;

export function splitKey(key: RecordKey): { collection: Collection; id: string } {
  const slash = key.indexOf('/');
  return { collection: key.slice(0, slash) as Collection, id: key.slice(slash + 1) };
}

/** Cambio local pendiente de subir (un registro por clave: ediciones sucesivas se agrupan). */
export interface QueueEntry {
  collection: Collection;
  id: string;
  /** `null` en borrados (tombstone). */
  data: unknown;
  deleted: boolean;
  /** Marca de tiempo de la edicion (ms). Decide "ultima edicion gana". */
  updatedAt: number;
  /** Ultima revision del servidor conocida para este registro. */
  rev: number;
  /** Se incrementa en cada modificacion; permite saber si cambio mientras estaba en vuelo. */
  seq: number;
  attempts: number;
}

export interface VersionInfo {
  /** `updatedAt` (ms) de la ultima version del servidor que conocemos/subimos. */
  u: number;
  rev: number;
  /** true si esa version era un borrado. */
  d: boolean;
  /** Version subida por este cliente y aun no confirmada por un pull (el servidor puede haber recortado su fecha). */
  o?: boolean;
}

export interface RejectedEntry {
  collection: Collection;
  id: string;
  reason: string;
  at: number;
}

/** Documento persistido en IndexedDB por usuario. Una sola escritura = consistente. */
export interface SyncDoc {
  v: 1;
  /** El importador de primer inicio de sesion ya se resolvio. */
  bootstrapped: boolean;
  cursor: string | null;
  /** Hash del ultimo estado observado por registro (base del diff). */
  snapshot: Record<RecordKey, string>;
  versions: Record<RecordKey, VersionInfo>;
  queue: Record<RecordKey, QueueEntry>;
  rejected: Record<RecordKey, RejectedEntry>;
  seq: number;
}

export function emptyDoc(): SyncDoc {
  return { v: 1, bootstrapped: false, cursor: null, snapshot: {}, versions: {}, queue: {}, rejected: {}, seq: 0 };
}

export type SyncPhase =
  | 'off'
  | 'starting'
  | 'awaiting-decision'
  | 'paused'
  | 'idle'
  | 'syncing'
  | 'offline'
  | 'error';

export interface DataSummary {
  total: number;
  byCollection: Partial<Record<Collection, number>>;
}

export interface SyncDecision {
  /** `upload`: hay datos locales y la nube esta vacia. `choose`: hay datos en ambos lados. */
  kind: 'upload' | 'choose';
  local: DataSummary;
  cloud: DataSummary;
}

export type DecisionChoice = 'upload' | 'cloud' | 'local' | 'skip';

export interface SyncStatus {
  phase: SyncPhase;
  /** Cambios locales aun sin subir. */
  pending: number;
  /** Cambios que el servidor o el contrato rechazaron (no se reintentan). */
  rejected: number;
  online: boolean;
  /** El servidor esta despertando (cold start de Render). */
  waking: boolean;
  apiStatus: ApiStatus;
  lastSyncAt: number | null;
  error: string | null;
  decision: SyncDecision | null;
  /** Esta pestana no sincroniza: lo hace otra pestana abierta de la misma cuenta. */
  follower: boolean;
}

export const OFF_STATUS: SyncStatus = {
  phase: 'off',
  pending: 0,
  rejected: 0,
  online: true,
  waking: false,
  apiStatus: 'idle',
  lastSyncAt: null,
  error: null,
  decision: null,
  follower: false,
};

/** Respaldo JSON descargado antes de cualquier operacion que sobrescriba datos. */
export interface SyncBackup {
  app: 'StudentOS';
  version: 1;
  kind: 'local' | 'cloud';
  reason: string;
  createdAt: string;
  userId: string;
  state?: AppState;
  records?: SyncRecord[];
}

export interface RemoteSnapshot {
  records: Map<RecordKey, SyncRecord>;
  cursor: string | null;
  invalid: number;
}
