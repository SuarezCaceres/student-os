import { useSyncExternalStore } from 'react';
import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import {
  clearCalendarLinkState,
  createProviderTokenStrippingStorage,
  GOOGLE_LOGIN_CALENDAR_SCOPES,
  hasPendingProviderRefreshToken,
  linkCalendarAfterLogin,
} from './googleLogin';

/**
 * Cliente de Supabase Auth para StudentOS.
 *
 * Reglas:
 * - Solo existe si hay `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`. Sin ellas la app
 *   se comporta como siempre (solo localStorage): nada de red, nada de errores, nada de login obligatorio.
 * - `@supabase/supabase-js` se carga con `import()` dinamico: si no esta configurado, ni se descarga.
 * - Jamas se usa la clave `service_role` en el navegador; solo la clave publica (publishable/anon).
 */

export interface SupabaseConfig {
  url: string;
  publishableKey: string;
}

function readEnv(name: string): string {
  const value = (import.meta.env as Record<string, unknown>)[name];
  return typeof value === 'string' ? value.trim() : '';
}

/** Lee la configuracion en cada llamada (permite stubs de entorno en pruebas). */
export function getSupabaseConfig(): SupabaseConfig | null {
  const url = readEnv('VITE_SUPABASE_URL');
  const publishableKey = readEnv('VITE_SUPABASE_PUBLISHABLE_KEY');
  if (!url || !publishableKey) return null;
  return { url, publishableKey };
}

export function getApiBaseUrl(): string | null {
  const url = readEnv('VITE_API_URL');
  return url ? url.replace(/\/+$/, '') : null;
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseConfig() !== null;
}

export function isApiConfigured(): boolean {
  return getApiBaseUrl() !== null;
}

/** La sincronizacion en la nube necesita las tres variables. */
export function isSyncConfigured(): boolean {
  return isSupabaseConfigured() && isApiConfigured();
}

// --- Cliente (carga diferida) ------------------------------------------------

let clientPromise: Promise<SupabaseClient | null> | null = null;
let clientKey = '';

export function getSupabase(): Promise<SupabaseClient | null> {
  const config = getSupabaseConfig();
  if (!config) return Promise.resolve(null);
  const key = `${config.url}|${config.publishableKey}`;
  if (!clientPromise || clientKey !== key) {
    clientKey = key;
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(config.url, config.publishableKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: 'pkce',
          // supabase-js persiste la sesion completa, incluido el refresh token de Google. Este `storage` lo elimina antes
          // de escribir: el token solo vive en memoria hasta enviarse al servidor (spec 009, C10).
          storage: createProviderTokenStrippingStorage(window.localStorage),
        },
      }),
    );
  }
  return clientPromise;
}

/** Solo para pruebas: olvida el cliente y el estado de sesion en memoria. */
export function __resetSupabaseForTests(): void {
  clientPromise = null;
  clientKey = '';
  sessionStore.reset();
}

// --- Acciones ------------------------------------------------------------------

export async function signInWithGoogle(): Promise<void> {
  const supabase = await getSupabase();
  if (!supabase) throw new Error('El inicio de sesión en la nube no está configurado.');
  clearCalendarLinkState();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
      // Calendar forma parte del login (spec 009): un solo consentimiento con los permisos de calendario y
      // `offline` + `consent` para que Google entregue el refresh token que el servidor guardara cifrado.
      scopes: GOOGLE_LOGIN_CALENDAR_SCOPES,
      queryParams: { access_type: 'offline', prompt: 'consent select_account' },
    },
  });
  if (error) throw new Error(error.message);
}

export async function signOut(): Promise<void> {
  const supabase = await getSupabase();
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
}

/** Token de acceso vigente (la libreria lo renueva sola si esta por vencer). */
export async function getAccessToken(): Promise<string | null> {
  const supabase = await getSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/** Fuerza una renovacion; devuelve el token nuevo o null si ya no hay sesion valida. */
export async function refreshAccessToken(): Promise<string | null> {
  const supabase = await getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.refreshSession();
  if (error) return null;
  return data.session?.access_token ?? null;
}

// --- Sesion observable ---------------------------------------------------------

export type SupabaseSessionStatus = 'disabled' | 'loading' | 'signedOut' | 'signedIn';

export interface SupabaseSessionState {
  status: SupabaseSessionStatus;
  session: Session | null;
  user: User | null;
}

const DISABLED_STATE: SupabaseSessionState = { status: 'disabled', session: null, user: null };
const LOADING_STATE: SupabaseSessionState = { status: 'loading', session: null, user: null };

function stateFromSession(session: Session | null): SupabaseSessionState {
  return session
    ? { status: 'signedIn', session, user: session.user }
    : { status: 'signedOut', session: null, user: null };
}

const sessionStore = (() => {
  let state: SupabaseSessionState = LOADING_STATE;
  let started = false;
  let unsubscribeAuth: (() => void) | null = null;
  const listeners = new Set<() => void>();

  const set = (next: SupabaseSessionState) => {
    // Evita renders inutiles: un TOKEN_REFRESHED con el mismo usuario solo cambia el token.
    state = next;
    listeners.forEach((l) => l());
  };

  // `true` mientras un login con Google espera a que Calendar quede vinculado. Durante ese tiempo NADA debe marcar la
  // sesion como iniciada (p. ej. el `getSession()` inicial, que termina despues del canje PKCE): si el enlace falla,
  // la app no debe haber llegado a entrar.
  let finishingLogin = false;

  const finishGoogleLogin = async (supabase: SupabaseClient, session: Session) => {
    try {
      const result = await linkCalendarAfterLogin(session);
      if (result === 'failed') {
        await supabase.auth.signOut().catch(() => undefined);
        set(stateFromSession(null));
        return;
      }
      set(stateFromSession(session));
    } finally {
      finishingLogin = false;
    }
  };

  const start = () => {
    if (started) return;
    started = true;
    void getSupabase()
      .then(async (supabase) => {
        if (!supabase) {
          set(DISABLED_STATE);
          return;
        }
        const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
          // Login recien hecho con Google: la app NO se considera iniciada hasta que Calendar quede vinculado en el
          // servidor. Si falta el permiso o falla el enlace, se cierra la sesion y se explica por que (C9).
          // supabase-js puede emitir SIGNED_IN mas de una vez para el mismo login: mientras uno se completa se ignora todo,
          // o el segundo enlace usaria un token ya consumido y su error pisaria el motivo real (p. ej. permiso desmarcado).
          if (finishingLogin) return;
          if (event === 'SIGNED_IN' && session && (session.provider_token || session.provider_refresh_token || hasPendingProviderRefreshToken())) {
            finishingLogin = true;
            set(LOADING_STATE);
            void finishGoogleLogin(supabase, session);
            return;
          }
          set(stateFromSession(session));
        });
        unsubscribeAuth = () => sub.subscription.unsubscribe();
        const { data } = await supabase.auth.getSession();
        if (!finishingLogin) set(stateFromSession(data.session));
      })
      .catch((error) => {
        console.warn('No se pudo iniciar Supabase Auth:', error);
        set(stateFromSession(null));
      });
  };

  return {
    getSnapshot: (): SupabaseSessionState => {
      if (!isSupabaseConfigured()) return DISABLED_STATE;
      return state;
    },
    subscribe: (listener: () => void) => {
      if (isSupabaseConfigured()) start();
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    reset: () => {
      unsubscribeAuth?.();
      unsubscribeAuth = null;
      started = false;
      finishingLogin = false;
      state = LOADING_STATE;
      listeners.clear();
    },
  };
})();

/**
 * Estado de la sesion de Supabase. Sin variables de entorno devuelve siempre
 * `{ status: 'disabled' }` y no toca la red.
 */
export function useSupabaseSession(): SupabaseSessionState {
  return useSyncExternalStore(sessionStore.subscribe, sessionStore.getSnapshot, () => DISABLED_STATE);
}
