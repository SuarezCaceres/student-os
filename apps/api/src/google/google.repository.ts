/** Capa de datos del modulo GOOGLE. Interfaz intercambiable: Prisma en produccion, memoria en pruebas unitarias. */

export interface GoogleConnectionRecord {
  userId: string;
  refreshTokenEnc: string;
  keyVersion: number;
  scopes: string;
  accountEmail: string | null;
  connectedAt: Date;
  needsReauth: boolean;
}

export interface SaveConnectionInput {
  userId: string;
  refreshTokenEnc: string;
  keyVersion: number;
  scopes: string;
  accountEmail: string | null;
  connectedAt: Date;
}

export interface OAuthStateRecord {
  id: string;
  userId: string;
  codeVerifierEnc: string;
  redirectTo: string;
  expiresAt: Date;
}

export interface GoogleRepository {
  /** Crea o reemplaza la conexion del usuario (y limpia `needsReauth`). */
  saveConnection(input: SaveConnectionInput): Promise<void>;
  getConnection(userId: string): Promise<GoogleConnectionRecord | null>;
  /** Cambia el blob cifrado (rotacion de clave / nuevo refresh token) sin tocar el resto. */
  updateRefreshToken(userId: string, refreshTokenEnc: string, keyVersion: number): Promise<void>;
  markNeedsReauth(userId: string): Promise<void>;
  /** Borra la conexion. Idempotente. Devuelve `true` si existia. */
  deleteConnection(userId: string): Promise<boolean>;

  createOAuthState(record: OAuthStateRecord, now: Date): Promise<void>;
  /** Un solo uso: devuelve la fila y la borra atomicamente; `null` si no existe (o ya se uso). */
  consumeOAuthState(id: string): Promise<OAuthStateRecord | null>;
  /** Lectura sin consumir (para decidir a donde redirigir cuando Google devuelve un error). */
  peekOAuthState(id: string): Promise<OAuthStateRecord | null>;
  deleteOAuthStatesForUser(userId: string): Promise<void>;
}
