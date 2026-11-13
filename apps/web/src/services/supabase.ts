import { useSyncExternalStore } from 'react';
import type { Session, SupabaseClient, User } from '@supabase/supabase-js';

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
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
      queryParams: { prompt: 'select_account' },
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

  const start = () => {
    if (started) return;
    started = true;
    void getSupabase()
      .then(async (supabase) => {
        if (!supabase) {
          set(DISABLED_STATE);
          return;
        }
        const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
          set(stateFromSession(session));
        });
        unsubscribeAuth = () => sub.subscription.unsubscribe();
        const { data } = await supabase.auth.getSession();
        set(stateFromSession(data.session));
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
