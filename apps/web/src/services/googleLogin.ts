import { VERIFIED_GOOGLE_CALENDAR_SCOPES } from '@student-os/shared';
import { useSyncExternalStore } from 'react';

/**
 * Login con Google + vinculacion automatica de Calendar (spec 009).
 *
 * Al iniciar sesion, Supabase entrega la sesion con `provider_refresh_token` (el refresh token de Google). La app lo envia UNA
 * vez a `POST /google/link-login` y el servidor lo valida, lo cifra y lo guarda. El navegador nunca lo persiste:
 *  - `createProviderTokenStrippingStorage` envuelve el `storage` de supabase-js y elimina `provider_token` y
 *    `provider_refresh_token` ANTES de escribir la sesion (supabase-js persiste la sesion completa por defecto);
 *  - el refresh token solo vive en memoria hasta que `linkCalendarAfterLogin` lo consume.
 * Nada de este modulo registra ni muestra el token.
 */

/**
 * Permisos de Calendar que se piden en el mismo consentimiento del login. Salen de la fuente unica
 * `VERIFIED_GOOGLE_CALENDAR_SCOPES` de `@student-os/shared`, la misma de la que deriva `GOOGLE_SCOPES` en el API (los mas
 * estrechos que acepta Google, spec 008 C9): cambiarlos obliga a reverificar la app (`googleLogin.test.ts`).
 */
export const GOOGLE_LOGIN_CALENDAR_SCOPES = VERIFIED_GOOGLE_CALENDAR_SCOPES.join(' ');

const PROVIDER_FIELDS = ['provider_token', 'provider_refresh_token'] as const;

/** Subconjunto de `Storage` que usa supabase-js. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

// --- Token en memoria -------------------------------------------------------------

let pendingRefreshToken: string | null = null;

/** Devuelve el refresh token capturado (si lo hay) y lo borra de la memoria. */
export function takeProviderRefreshToken(): string | null {
  const token = pendingRefreshToken;
  pendingRefreshToken = null;
  return token;
}

/** `true` si hay un refresh token en memoria esperando a enlazarse (no lo consume). */
export function hasPendingProviderRefreshToken(): boolean {
  return pendingRefreshToken !== null;
}

/** Solo para pruebas. */
export function __resetGoogleLoginForTests(): void {
  pendingRefreshToken = null;
  calendarLinkStore.set({ status: 'idle' });
}

// --- Storage que no persiste los tokens de Google -----------------------------------

function stripProviderTokens(value: string): string {
  // Camino rapido: casi todo lo que supabase-js escribe (verifiers PKCE, claves de usuario) no los contiene.
  if (!value.includes('provider_')) return value;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return value;
    const record = parsed as Record<string, unknown>;
    let changed = false;
    for (const field of PROVIDER_FIELDS) {
      if (field in record) {
        if (field === 'provider_refresh_token' && typeof record[field] === 'string' && record[field]) {
          pendingRefreshToken = record[field] as string;
        }
        delete record[field];
        changed = true;
      }
    }
    return changed ? JSON.stringify(record) : value;
  } catch {
    return value;
  }
}

/** Envuelve un `Storage` para que la sesion de supabase-js se guarde SIN los tokens de Google (C10). */
export function createProviderTokenStrippingStorage(base: StorageLike): StorageLike {
  return {
    getItem: (key) => base.getItem(key),
    removeItem: (key) => base.removeItem(key),
    setItem: (key, value) => base.setItem(key, stripProviderTokens(value)),
  };
}

// --- Estado del enlace (para la interfaz) -------------------------------------------

export type CalendarLinkFailureReason = 'missing_scopes' | 'account_mismatch' | 'missing_refresh_token' | 'other';

export type CalendarLinkState =
  | { status: 'idle' }
  | { status: 'linking' }
  | { status: 'linked' }
  | { status: 'failed'; reason: CalendarLinkFailureReason; message: string };

export const CALENDAR_LINK_MESSAGES: Record<CalendarLinkFailureReason, string> = {
  missing_scopes: 'StudentOS necesita acceso a tu Google Calendar para funcionar. Vuelve a intentarlo y deja marcado el permiso de Calendar.',
  account_mismatch: 'La cuenta de Google que autorizaste no coincide con la de tu sesión. Vuelve a intentarlo con la misma cuenta.',
  missing_refresh_token: 'Google no completó el acceso a tu Calendar. Vuelve a iniciar sesión y acepta todos los permisos.',
  other: 'No pudimos vincular tu Google Calendar. Revisa tu conexión y vuelve a iniciar sesión.',
};

const calendarLinkStore = (() => {
  let state: CalendarLinkState = { status: 'idle' };
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set(next: CalendarLinkState) {
      state = next;
      listeners.forEach((listener) => listener());
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
})();

export function getCalendarLinkState(): CalendarLinkState {
  return calendarLinkStore.get();
}

/** Estado del enlace de Calendar tras el login (para mostrar el aviso si falta el permiso). */
export function useCalendarLinkState(): CalendarLinkState {
  return useSyncExternalStore(calendarLinkStore.subscribe, calendarLinkStore.get, () => ({ status: 'idle' }) as CalendarLinkState);
}

/** Olvida un fallo anterior (al empezar un nuevo intento de login o al cerrar el aviso). */
export function clearCalendarLinkState(): void {
  if (calendarLinkStore.get().status !== 'idle') calendarLinkStore.set({ status: 'idle' });
}

// --- Enlace --------------------------------------------------------------------------

function failure(reason: CalendarLinkFailureReason): 'failed' {
  calendarLinkStore.set({ status: 'failed', reason, message: CALENDAR_LINK_MESSAGES[reason] });
  return 'failed';
}

/** Detecta el `code` estable del API en un `ApiError` sin importar `api.ts` (evita un ciclo de imports con supabase.ts). */
function reasonFromError(error: unknown): CalendarLinkFailureReason {
  const body = error && typeof error === 'object' ? (error as { body?: unknown }).body : undefined;
  if (body && typeof body === 'object') {
    const code = (body as { code?: unknown }).code;
    if (code === 'google_missing_scopes') return 'missing_scopes';
    if (code === 'google_account_mismatch') return 'account_mismatch';
  }
  return 'other';
}

/** Lo minimo que se usa de la sesion de Supabase (la sesion real lo cumple). */
export interface ProviderSessionLike {
  provider_token?: string | null;
  provider_refresh_token?: string | null;
}

/**
 * Entrega al servidor el refresh token de Google del login y deja Calendar vinculado.
 *  - `skipped`: no habia token (es una sesion que ya existia, no un login recien hecho).
 *  - `linked`: el servidor lo valido y lo guardo cifrado.
 *  - `failed`: no se pudo (permiso desmarcado, otra cuenta, sin red...); el motivo queda en el estado.
 */
export async function linkCalendarAfterLogin(session: ProviderSessionLike): Promise<'skipped' | 'linked' | 'failed'> {
  const token = takeProviderRefreshToken() ?? (session.provider_refresh_token || null);
  if (!token) {
    // Hubo login con Google pero Google no entrego refresh token: sin el no hay vinculo duradero.
    return session.provider_token ? failure('missing_refresh_token') : 'skipped';
  }
  calendarLinkStore.set({ status: 'linking' });
  try {
    // Carga bajo demanda: `api.ts` importa `supabase.ts`, que importa este modulo. Un import estatico crearia un ciclo.
    const { getApiClient } = await import('./api');
    const client = getApiClient();
    if (!client) return failure('other');
    await client.request('/google/link-login', { method: 'POST', body: { refreshToken: token } });
    calendarLinkStore.set({ status: 'linked' });
    return 'linked';
  } catch (error) {
    return failure(reasonFromError(error));
  }
}

/** Solo para pruebas: fija el estado del enlace sin pasar por el API. */
export function __setCalendarLinkStateForTests(state: CalendarLinkState): void {
  calendarLinkStore.set(state);
}
