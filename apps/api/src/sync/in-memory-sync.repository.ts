import { recordKey } from './sync-logic';
import type { PullCriteria, RecordKey, StoredRecord, SyncRepository, SyncTransaction } from './sync.types';

interface UserStore {
  records: Map<string, StoredRecord>;
  counter: bigint;
  lastSyncAt: Date | null;
}

/**
 * Implementacion en memoria de `SyncRepository` para tests. Imita las garantias de la version Prisma:
 *  - Las transacciones del MISMO usuario se serializan (equivale al bloqueo de fila de `lockUser`).
 *  - Son atomicas: se trabaja sobre una copia y solo se confirma si `fn` no lanza.
 *  - `seq` unico y creciente por usuario; el contador solo avanza al confirmar.
 * No usar en produccion.
 */
export class InMemorySyncRepository implements SyncRepository {
  private readonly users = new Map<string, UserStore>();
  private readonly locks = new Map<string, Promise<unknown>>();

  async transaction<T>(userId: string, fn: (tx: SyncTransaction) => Promise<T>): Promise<T> {
    const previous = this.locks.get(userId) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.locks.set(
      userId,
      previous.then(() => gate),
    );
    await previous;
    try {
      const committed = this.store(userId);
      const draft: UserStore = {
        records: new Map(committed.records),
        counter: committed.counter,
        lastSyncAt: committed.lastSyncAt,
      };
      const result = await fn(new InMemoryTransaction(draft));
      this.users.set(userId, draft);
      return result;
    } finally {
      release();
    }
  }

  async pull(userId: string, criteria: PullCriteria): Promise<StoredRecord[]> {
    return [...this.store(userId).records.values()]
      .filter((row) => row.seq > criteria.afterSeq && (!criteria.collection || row.collection === criteria.collection))
      .sort((a, b) => (a.seq < b.seq ? -1 : a.seq > b.seq ? 1 : 0))
      .slice(0, criteria.limit)
      .map(clone);
  }

  async touchLastSync(userId: string, at: Date): Promise<void> {
    this.store(userId).lastSyncAt = at;
  }

  async deleteAllForUser(userId: string): Promise<number> {
    const count = this.users.get(userId)?.records.size ?? 0;
    this.users.delete(userId);
    return count;
  }

  // --- Ayudas solo para tests ---------------------------------------------------------------------------------

  getLastSyncAt(userId: string): Date | null {
    return this.users.get(userId)?.lastSyncAt ?? null;
  }

  /** Copia de todas las filas del usuario (incluye tombstones). */
  dump(userId: string): StoredRecord[] {
    return [...(this.users.get(userId)?.records.values() ?? [])].map(clone);
  }

  private store(userId: string): UserStore {
    let store = this.users.get(userId);
    if (!store) {
      store = { records: new Map(), counter: 0n, lastSyncAt: null };
      this.users.set(userId, store);
    }
    return store;
  }
}

class InMemoryTransaction implements SyncTransaction {
  constructor(private readonly draft: UserStore) {}

  async lockUser(): Promise<bigint> {
    this.draft.lastSyncAt = new Date();
    return this.draft.counter;
  }

  async findByKeys(keys: RecordKey[]): Promise<StoredRecord[]> {
    const found: StoredRecord[] = [];
    for (const key of keys) {
      const row = this.draft.records.get(recordKey(key.collection, key.id));
      if (row) found.push(clone(row));
    }
    return found;
  }

  async countRecords(): Promise<number> {
    return this.draft.records.size;
  }

  async write(records: StoredRecord[], newCounter: bigint): Promise<void> {
    const seen = new Set<bigint>([...this.draft.records.values()].map((row) => row.seq));
    for (const row of records) {
      const key = recordKey(row.collection, row.id);
      const previous = this.draft.records.get(key);
      if (previous) seen.delete(previous.seq);
      if (seen.has(row.seq)) throw new Error('seq duplicado (viola la unicidad de (userId, seq))');
      seen.add(row.seq);
      this.draft.records.set(key, clone(row));
    }
    this.draft.counter = newCounter;
  }
}

function clone(row: StoredRecord): StoredRecord {
  return {
    ...row,
    data: row.data === null || row.data === undefined ? null : structuredClone(row.data),
    updatedAt: new Date(row.updatedAt),
    deletedAt: row.deletedAt ? new Date(row.deletedAt) : null,
    serverUpdatedAt: new Date(row.serverUpdatedAt),
  };
}
