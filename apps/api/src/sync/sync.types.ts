import type { Collection } from '@student-os/shared';

/** Fila de sync tal como la guarda el repositorio. `seq` solo lo asigna el servidor. */
export interface StoredRecord {
  collection: Collection;
  id: string;
  /** `null` en tombstones. */
  data: unknown;
  /** Fecha de edicion del CLIENTE ya saneada. */
  updatedAt: Date;
  deletedAt: Date | null;
  rev: number;
  seq: bigint;
  serverUpdatedAt: Date;
}

export interface RecordKey {
  collection: Collection;
  id: string;
}

export interface PullCriteria {
  /** Solo registros con `seq` estrictamente mayor. */
  afterSeq: bigint;
  collection?: Collection;
  /** Tamano maximo de la pagina (el servicio pide `limit + 1` para detectar `hasMore`). */
  limit: number;
}

/**
 * Operaciones dentro de la transaccion de un push. Orden obligatorio: `lockUser()` primero (serializa los
 * pushes del mismo usuario), despues lecturas/escrituras.
 */
export interface SyncTransaction {
  /** Bloquea la fila de estado del usuario (la crea si falta), marca `lastSyncAt` y devuelve el ultimo `seq`. */
  lockUser(): Promise<bigint>;
  findByKeys(keys: RecordKey[]): Promise<StoredRecord[]>;
  /** Numero de filas del usuario (tombstones incluidos). */
  countRecords(): Promise<number>;
  /** Inserta o reemplaza las filas y fija el nuevo contador. */
  write(records: StoredRecord[], newCounter: bigint): Promise<void>;
}

/**
 * Acceso a datos del motor de sync. Implementaciones: `PrismaSyncRepository` (produccion) e
 * `InMemorySyncRepository` (tests). TODA operacion recibe el `userId` del JWT; nunca se lee de la peticion.
 */
export interface SyncRepository {
  /** Ejecuta `fn` de forma atomica; si lanza, no se escribe nada. */
  transaction<T>(userId: string, fn: (tx: SyncTransaction) => Promise<T>): Promise<T>;
  /** Registros con `seq > afterSeq` ordenados por `seq` ascendente. */
  pull(userId: string, criteria: PullCriteria): Promise<StoredRecord[]>;
  /** Marca `lastSyncAt` (mejor esfuerzo; lo usa el pull). */
  touchLastSync(userId: string, at: Date): Promise<void>;
  /** Borra todos los registros y el estado de sync del usuario. Devuelve cuantos registros borro. */
  deleteAllForUser(userId: string): Promise<number>;
}
