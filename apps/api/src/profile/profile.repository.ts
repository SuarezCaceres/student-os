export const PROFILE_REPOSITORY = Symbol('PROFILE_REPOSITORY');

export interface ProfileRow {
  id: string;
  createdAt: Date;
}

/** Acceso a datos del perfil. Implementaciones: Prisma (produccion) e InMemory (tests). */
export interface ProfileRepository {
  /** Crea el `Profile` si no existe (idempotente y seguro ante carreras) y lo devuelve. */
  ensure(userId: string): Promise<ProfileRow>;
  /** Ultima vez que el usuario sincronizo (`null` si nunca). */
  getLastSyncAt(userId: string): Promise<Date | null>;
}
