/** Token de inyeccion del repositorio de cuenta (intercambiable en tests). */
export const ACCOUNT_REPOSITORY = Symbol('ACCOUNT_REPOSITORY');

/** Palabra que el usuario debe enviar (y escribir en la UI) para confirmar el borrado de su cuenta. */
export const DELETE_CONFIRMATION = 'BORRAR';

/** Limite de frecuencia estricto de `/account/*` (por usuario): 5 peticiones cada 10 minutos. */
export const ACCOUNT_RATE_LIMIT = { limit: 5, ttl: 600_000 } as const;

/** Registros de sync por pagina al exportar. */
export const EXPORT_PAGE_SIZE = 500;

export interface ExportedRecord {
  collection: string;
  id: string;
  data: unknown;
  /** ISO 8601, fecha de ultima edicion. */
  updatedAt: string;
  rev: number;
}

/** Lo que el repositorio sabe del usuario (sin el correo, que viene del JWT). */
export interface AccountSnapshot {
  profile: { id: string; createdAt: string; updatedAt: string } | null;
  lastSyncAt: string | null;
  /** Solo registros NO borrados (los tombstones no se exportan). */
  records: ExportedRecord[];
}

export interface AccountRepository {
  /** Lectura consistente de perfil + registros vivos del usuario. */
  snapshot(userId: string): Promise<AccountSnapshot>;
  /**
   * Borra el `Profile` y el estado de sync (`user_sync_state`) del usuario en UNA transaccion.
   * Idempotente: si no existen no falla. Devuelve si habia perfil.
   */
  deleteProfileData(userId: string): Promise<{ profileDeleted: boolean }>;
}

/** Documento de exportacion (`GET /account/export`). */
export interface AccountExport {
  schemaVersion: 1;
  exportedAt: string;
  account: {
    id: string;
    /** Correo de la sesion (lo gestiona Supabase Auth). */
    email: string | null;
    createdAt: string | null;
    updatedAt: string | null;
    lastSyncAt: string | null;
  };
  counts: { total: number; byCollection: Record<string, number> };
  records: ExportedRecord[];
  /** Datos de otros modulos (p. ej. estado de la conexion con Google, SIN tokens). Ver account-export.registry.ts. */
  extras: Record<string, unknown>;
}

export interface AccountDeletionReport {
  deleted: true;
  /** Resultado por modulo externo (ganchos de borrado). */
  modules: { name: string; ok: true }[];
  syncRecordsDeleted: number;
  profileDeleted: boolean;
  /**
   * El usuario de Supabase Auth NO se borra desde este servicio (requiere la `service_role`, que no se
   * guarda aqui). El cliente debe cerrar sesion. Ver docs/agent-notes/PUBLIC.md.
   */
  authUser: 'not_deleted';
}
