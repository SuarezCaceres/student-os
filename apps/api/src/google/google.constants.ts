/** Tokens de inyeccion y constantes del modulo GOOGLE (sync persistente de Google Calendar). */

export const GOOGLE_REPOSITORY = Symbol('GOOGLE_REPOSITORY');
/** Reloj inyectable (ms desde epoch). Solo las pruebas lo sustituyen. */
export const GOOGLE_CLOCK = Symbol('GOOGLE_CLOCK');
/** `fetch` inyectable. Por defecto el global (se resuelve en cada llamada para que los mocks funcionen). */
export const GOOGLE_FETCH = Symbol('GOOGLE_FETCH');

/**
 * Scopes minimos: los de calendario que la app ya usa (leer disponibilidad/eventos y escribir eventos) mas `openid email`
 * para saber QUE cuenta de Google se conecto. No se pide `profile`: el servidor no necesita nombre ni foto.
 */
export const GOOGLE_SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
] as const;

/** Scope sin el cual el sync no puede escribir eventos (el usuario puede desmarcarlo en el consentimiento granular). */
export const REQUIRED_EVENTS_SCOPE = 'https://www.googleapis.com/auth/calendar.events';

/** Endpoints reales por defecto. Solo las pruebas los sobrescriben (GOOGLE_OAUTH_BASE, GOOGLE_API_BASE, GOOGLE_AUTH_URL). */
export const DEFAULT_GOOGLE_OAUTH_BASE = 'https://oauth2.googleapis.com';
export const DEFAULT_GOOGLE_API_BASE = 'https://www.googleapis.com';
export const DEFAULT_GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';

/** Vida del `state` y del verifier PKCE guardado en servidor. */
export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
/** Se renueva el access token cuando le quedan menos de estos ms de vida. */
export const ACCESS_TOKEN_REFRESH_MARGIN_MS = 60 * 1000;
/** Timeout por llamada a Google. */
export const GOOGLE_HTTP_TIMEOUT_MS = 15_000;

/** Codigos estables que el web traduce a su flujo `auth_missing`. */
export const GOOGLE_ERROR_CODES = {
  reauthRequired: 'google_reauth_required',
  notConnected: 'google_not_connected',
  notConfigured: 'google_not_configured',
  badRequest: 'google_bad_request',
  forbidden: 'google_forbidden',
  notFound: 'google_not_found',
  gone: 'google_gone',
  conflict: 'google_conflict',
  rateLimited: 'google_rate_limited',
  upstream: 'google_upstream_error',
  invalidReturnTo: 'google_invalid_return_to',
  /** El usuario desmarco el permiso de eventos de Calendar en el consentimiento de Google (login). */
  missingScopes: 'google_missing_scopes',
  /** El refresh token entregado pertenece a otra cuenta de Google distinta de la del usuario autenticado. */
  accountMismatch: 'google_account_mismatch',
} as const;

export type GoogleErrorCode = (typeof GOOGLE_ERROR_CODES)[keyof typeof GOOGLE_ERROR_CODES];
