import type { InMemorySyncRepository } from '../sync/in-memory-sync.repository';
import type { AccountRepository, AccountSnapshot } from './account.types';

/**
 * Implementacion en memoria de `AccountRepository` para tests unitarios. Comparte el almacen de sync con
 * `InMemorySyncRepository`; los perfiles viven aqui (`addProfile`), porque el repositorio de perfil en
 * memoria es de otro agente y no permite borrar. No usar en produccion.
 */
export class InMemoryAccountRepository implements AccountRepository {
  private readonly profiles = new Map<string, Date>();
  /** Numero de veces que se llamo a `deleteProfileData` (para comprobar el orden de borrado). */
  deleteCalls = 0;

  constructor(private readonly sync: InMemorySyncRepository) {}

  addProfile(userId: string, createdAt = new Date()): void {
    this.profiles.set(userId, createdAt);
  }

  hasProfile(userId: string): boolean {
    return this.profiles.has(userId);
  }

  async snapshot(userId: string): Promise<AccountSnapshot> {
    const createdAt = this.profiles.get(userId);
    return {
      profile: createdAt
        ? { id: userId, createdAt: createdAt.toISOString(), updatedAt: createdAt.toISOString() }
        : null,
      lastSyncAt: this.sync.getLastSyncAt(userId)?.toISOString() ?? null,
      records: this.sync
        .dump(userId)
        .filter((row) => row.deletedAt === null)
        .sort((a, b) => (a.seq < b.seq ? -1 : 1))
        .map((row) => ({
          collection: row.collection,
          id: row.id,
          data: row.data,
          updatedAt: row.updatedAt.toISOString(),
          rev: row.rev,
        })),
    };
  }

  async deleteProfileData(userId: string): Promise<{ profileDeleted: boolean }> {
    this.deleteCalls += 1;
    return { profileDeleted: this.profiles.delete(userId) };
  }
}
