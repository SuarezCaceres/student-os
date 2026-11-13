import type { Request } from 'express';

/** Usuario autenticado a partir del JWT de Supabase. */
export interface AuthUser {
  /** `sub` del JWT = `auth.users.id` de Supabase = `Profile.id`. */
  id: string;
  email?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}
