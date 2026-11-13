import { Inject, Injectable } from '@nestjs/common';
import { PROFILE_REPOSITORY, type ProfileRepository } from './profile.repository';

/** Respuesta de `GET /profile`. */
export interface ProfileView {
  id: string;
  /** Viene del JWT (Supabase es su dueno); `null` si el token no lo trae. */
  email: string | null;
  createdAt: string;
  lastSyncAt: string | null;
}

@Injectable()
export class ProfileService {
  constructor(@Inject(PROFILE_REPOSITORY) private readonly repository: ProfileRepository) {}

  /**
   * Garantiza que existe el `Profile` del usuario (upsert). Se llama en la primera peticion autenticada de
   * sync/perfil; es idempotente y seguro ante peticiones simultaneas. `userId` SIEMPRE sale del JWT.
   */
  ensure(userId: string) {
    return this.repository.ensure(userId);
  }

  async get(userId: string, email: string | undefined): Promise<ProfileView> {
    const profile = await this.ensure(userId);
    const lastSyncAt = await this.repository.getLastSyncAt(userId);
    return {
      id: profile.id,
      email: email ?? null,
      createdAt: profile.createdAt.toISOString(),
      lastSyncAt: lastSyncAt ? lastSyncAt.toISOString() : null,
    };
  }
}
