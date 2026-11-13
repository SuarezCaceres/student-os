import type {
  GoogleConnectionRecord,
  GoogleRepository,
  OAuthStateRecord,
  SaveConnectionInput,
} from './google.repository';

/** Repositorio en memoria para pruebas unitarias. Imita la semantica del de Prisma (un solo uso del state, etc.). */
export class InMemoryGoogleRepository implements GoogleRepository {
  readonly connections = new Map<string, GoogleConnectionRecord>();
  readonly states = new Map<string, OAuthStateRecord>();

  async saveConnection(input: SaveConnectionInput): Promise<void> {
    this.connections.set(input.userId, { ...input, needsReauth: false });
  }

  async getConnection(userId: string): Promise<GoogleConnectionRecord | null> {
    const row = this.connections.get(userId);
    return row ? { ...row } : null;
  }

  async updateRefreshToken(userId: string, refreshTokenEnc: string, keyVersion: number): Promise<void> {
    const row = this.connections.get(userId);
    if (row) this.connections.set(userId, { ...row, refreshTokenEnc, keyVersion });
  }

  async markNeedsReauth(userId: string): Promise<void> {
    const row = this.connections.get(userId);
    if (row) this.connections.set(userId, { ...row, needsReauth: true });
  }

  async deleteConnection(userId: string): Promise<boolean> {
    return this.connections.delete(userId);
  }

  async createOAuthState(record: OAuthStateRecord, now: Date): Promise<void> {
    for (const [id, state] of this.states) {
      if (state.expiresAt < now) this.states.delete(id);
    }
    this.states.set(record.id, { ...record });
  }

  async consumeOAuthState(id: string): Promise<OAuthStateRecord | null> {
    const row = this.states.get(id);
    if (!row) return null;
    this.states.delete(id);
    return { ...row };
  }

  async peekOAuthState(id: string): Promise<OAuthStateRecord | null> {
    const row = this.states.get(id);
    return row ? { ...row } : null;
  }

  async deleteOAuthStatesForUser(userId: string): Promise<void> {
    for (const [id, state] of this.states) {
      if (state.userId === userId) this.states.delete(id);
    }
  }
}
