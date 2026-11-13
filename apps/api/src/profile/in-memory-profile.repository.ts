import type { ProfileRepository, ProfileRow } from './profile.repository';

/** Implementacion en memoria de `ProfileRepository` para tests. No usar en produccion. */
export class InMemoryProfileRepository implements ProfileRepository {
  private readonly profiles = new Map<string, ProfileRow>();
  /** Numero de creaciones reales (para comprobar idempotencia). */
  creations = 0;

  /** `lastSyncSource`: de donde sale `lastSyncAt` (p. ej. `(id) => syncRepo.getLastSyncAt(id)`). */
  constructor(private readonly lastSyncSource: (userId: string) => Date | null = () => null) {}

  async ensure(userId: string): Promise<ProfileRow> {
    let profile = this.profiles.get(userId);
    if (!profile) {
      profile = { id: userId, createdAt: new Date() };
      this.profiles.set(userId, profile);
      this.creations += 1;
    }
    return { ...profile };
  }

  async getLastSyncAt(userId: string): Promise<Date | null> {
    return this.lastSyncSource(userId);
  }

  has(userId: string): boolean {
    return this.profiles.has(userId);
  }
}
