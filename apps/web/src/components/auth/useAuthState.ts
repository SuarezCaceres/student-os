import { useCallback, useMemo } from 'react';
import {
  isSupabaseConfigured,
  isSyncConfigured,
  signInWithGoogle,
  signOut,
  useSupabaseSession,
  type SupabaseSessionStatus,
} from '../../services/supabase';
import type { UserSession } from './AuthModal';

export interface AuthState {
  /** Hay variables de Supabase: se ofrece "Continuar con Google" en la nube. */
  cloudAvailable: boolean;
  /** Supabase + API configuradas: la sincronizacion puede activarse. */
  syncAvailable: boolean;
  status: SupabaseSessionStatus;
  isSignedIn: boolean;
  userId: string | null;
  /** Sesion en el formato que ya usa `App.tsx` (para entrar a la app tras volver de Google). */
  userSession: UserSession | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

/**
 * Estado de autenticacion en la nube. Sin variables de entorno: `cloudAvailable: false`,
 * `status: 'disabled'` y ninguna llamada de red.
 */
export function useAuthState(): AuthState {
  const session = useSupabaseSession();

  const userSession = useMemo<UserSession | null>(() => {
    const user = session.user;
    if (session.status !== 'signedIn' || !user) return null;
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const fullName = typeof meta.full_name === 'string' ? meta.full_name : typeof meta.name === 'string' ? meta.name : '';
    const avatar = typeof meta.avatar_url === 'string' ? meta.avatar_url : typeof meta.picture === 'string' ? meta.picture : undefined;
    return {
      name: fullName || user.email?.split('@')[0] || 'Estudiante',
      email: user.email ?? '',
      major: 'Ingeniería / Tecnología',
      provider: 'google',
      avatarUrl: avatar,
      isLoggedIn: true,
      loginAt: user.last_sign_in_at ?? user.created_at,
    };
  }, [session]);

  const doSignIn = useCallback(() => signInWithGoogle(), []);
  const doSignOut = useCallback(() => signOut(), []);

  return {
    cloudAvailable: isSupabaseConfigured(),
    syncAvailable: isSyncConfigured(),
    status: session.status,
    isSignedIn: session.status === 'signedIn',
    userId: session.user?.id ?? null,
    userSession,
    signInWithGoogle: doSignIn,
    signOut: doSignOut,
  };
}
