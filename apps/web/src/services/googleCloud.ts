import { ApiError, getApiClient, isApiError, type ApiClient } from './api';
import { getAccessToken, getSupabase, isSyncConfigured } from './supabase';

/**
 * Modo NUBE de Google Calendar (sync persistente). El refresh token vive cifrado en el servidor (NestJS); el navegador
 * solo habla con `/google/*` de la API usando su sesion de Supabase y NUNCA ve ningun token de Google.
 *
 * Este modulo es el "transporte alterno" de la fachada `googleCalendar.ts`: la fachada conserva toda su logica y sus
 * firmas (que reciben un `accessToken: string`); cuando el modo nube esta activo, el "token" que circula es el
 * marcador `GOOGLE_CLOUD_ACCESS_TOKEN` y las llamadas a Calendar se enrutan por la API en lugar de ir directo a Google.
 *
 * Modo nube = `VITE_API_URL` + `VITE_SUPABASE_URL` (+ clave publica) configuradas Y sesion de Supabase iniciada. Si
 * falta cualquiera, la fachada usa Google Identity Services (GIS) exactamente como antes.
 */

/** Marcador (no es un token real ni un secreto) que representa "la sesion de Google vive en el servidor". */
export const GOOGLE_CLOUD_ACCESS_TOKEN = '__student_os_google_cloud__';

export function isGoogleCloudToken(token: string | null | undefined): boolean {
  return token === GOOGLE_CLOUD_ACCESS_TOKEN;
}

export interface GoogleCloudStatus {
  /** El servidor tiene configuradas las credenciales de Google. */
  configured: boolean;
  connected: boolean;
  /** Google revoco o caduco el permiso: hay que volver a autorizar. */
  needsReauth: boolean;
  email: string | null;
  connectedAt: string | null;
  scopes: string[];
}

export type GoogleRedirectStatus = 'connected' | 'error';

export interface GoogleRedirectResult {
  status: GoogleRedirectStatus;
  /** Motivo del servidor cuando `status === 'error'` (`denied`, `expired`, `missing_scopes`...). */
  reason?: string;
}

/** Codigos estables de la API que significan "hay que (re)conectar Google": la fachada los traduce a `auth_missing`. */
const REAUTH_CODES = new Set(['google_reauth_required', 'google_not_connected']);

const STATUS_TTL_MS = 30_000;

// --- Estado de modulo ---------------------------------------------------------------

let sessionSignedIn: boolean | null = null;
let watcherStarted = false;
let needsReauth = false;
let statusCache: { at: number; value: GoogleCloudStatus } | null = null;
let pendingRedirect: GoogleRedirectResult | null = null;
let statusInflight: Promise<GoogleCloudStatus> | null = null;

function resetCloudState(): void {
  needsReauth = false;
  statusCache = null;
}

function setSession(signedIn: boolean): void {
  if (sessionSignedIn === true && !signedIn) resetCloudState();
  sessionSignedIn = signedIn;
}

/** Observa la sesion de Supabase una sola vez (sin tocar la red si la nube no esta configurada). */
function ensureSessionWatcher(): void {
  if (watcherStarted || !isSyncConfigured()) return;
  watcherStarted = true;
  void getSupabase()
    .then(async (supabase) => {
      if (!supabase) {
        setSession(false);
        return;
      }
      supabase.auth.onAuthStateChange((_event, session) => setSession(Boolean(session)));
      const { data } = await supabase.auth.getSession();
      setSession(Boolean(data.session));
    })
    .catch(() => {
      watcherStarted = false;
      setSession(false);
    });
}

/**
 * Modo nube segun lo que se sabe AHORA (sincrono). Mientras Supabase aun no respondio, devuelve `false`
 * (se usa GIS); las funciones asincronas de la fachada consultan `resolveGoogleCloudMode()` para el valor definitivo.
 */
export function isGoogleCloudMode(): boolean {
  if (!isSyncConfigured()) return false;
  ensureSessionWatcher();
  return sessionSignedIn === true;
}

/** Modo nube definitivo: espera a conocer la sesion de Supabase. */
export async function resolveGoogleCloudMode(): Promise<boolean> {
  if (!isSyncConfigured()) return false;
  ensureSessionWatcher();
  let token: string | null = null;
  try {
    token = await getAccessToken();
  } catch {
    token = null;
  }
  setSession(token !== null);
  return token !== null;
}

/** `true` si la API ya indico que hay que volver a autorizar (se limpia al reconectar o al refrescar el estado). */
export function isGoogleCloudReauthRequired(): boolean {
  return needsReauth;
}

export function markGoogleCloudReauthRequired(): void {
  needsReauth = true;
  statusCache = null;
}

// --- Llamadas a /google/* ------------------------------------------------------------

function requireClient(): ApiClient {
  const client = getApiClient();
  if (!client) throw new Error('La nube de StudentOS no está configurada en esta instalación.');
  return client;
}

function parseStatus(raw: unknown): GoogleCloudStatus {
  const body = (raw ?? {}) as Record<string, unknown>;
  return {
    configured: body.configured !== false,
    connected: body.connected === true,
    needsReauth: body.needsReauth === true,
    email: typeof body.email === 'string' && body.email ? body.email : null,
    connectedAt: typeof body.connectedAt === 'string' && body.connectedAt ? body.connectedAt : null,
    scopes: Array.isArray(body.scopes) ? body.scopes.filter((s): s is string => typeof s === 'string') : [],
  };
}

/** Estado de la conexion de Google en el servidor (con una cache corta para no repetir la llamada). */
export async function getGoogleCloudStatus(options: { force?: boolean } = {}): Promise<GoogleCloudStatus> {
  if (!options.force && statusCache && Date.now() - statusCache.at < STATUS_TTL_MS) return statusCache.value;
  // Peticiones simultaneas comparten una sola llamada (App consulta el estado antes de cada operacion).
  if (!statusInflight) {
    statusInflight = requireClient()
      .request<unknown>('/google/status')
      .then((raw) => {
        const status = parseStatus(raw);
        statusCache = { at: Date.now(), value: status };
        needsReauth = status.connected && status.needsReauth;
        return status;
      })
      .finally(() => {
        statusInflight = null;
      });
  }
  return statusInflight;
}

/** Navegacion del navegador, aislada para poder sustituirla en pruebas (jsdom no permite espiar `location.assign`). */
export const navigation = {
  go(url: string): void {
    window.location.assign(url);
  },
};

/** Pide la URL de consentimiento y navega a ella. El servidor vuelve a esta misma pagina con `?google=connected|error`. */
export async function startGoogleCloudConnect(): Promise<void> {
  const returnTo = `${window.location.origin}${window.location.pathname}`;
  const raw = await requireClient().request<{ url?: unknown }>('/google/connect', {
    method: 'POST',
    body: { returnTo },
  });
  const target = typeof raw?.url === 'string' ? raw.url : '';
  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    throw new Error('El servidor no devolvió una dirección válida de Google.');
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('El servidor no devolvió una dirección válida de Google.');
  }
  navigation.go(parsed.toString());
}

/** Revoca el acceso en Google (desde el servidor) y borra el secreto. `revoked: false` = Google no confirmó la revocación. */
export async function disconnectGoogleCloud(): Promise<{ disconnected: boolean; revoked: boolean }> {
  const raw = await requireClient().request<{ disconnected?: unknown; revoked?: unknown }>('/google/disconnect', {
    method: 'POST',
    body: {},
  });
  resetCloudState();
  return { disconnected: raw?.disconnected === true, revoked: raw?.revoked === true };
}

/** Olvida el estado en memoria (cierre de sesion local). NO toca el servidor: la conexion persiste entre sesiones. */
export function forgetGoogleCloudState(): void {
  resetCloudState();
}

// --- Redireccion de vuelta de Google ---------------------------------------------------

/**
 * Lee `?google=connected|error[&reason=..]` de la URL (lo agrega la API al volver del consentimiento), lo quita de la
 * barra de direcciones y guarda el resultado para `consumeGoogleRedirectResult()`. Solo actua con la nube configurada.
 */
export function captureGoogleRedirectResult(): GoogleRedirectResult | null {
  if (typeof window === 'undefined' || !isSyncConfigured()) return null;
  try {
    const url = new URL(window.location.href);
    const status = url.searchParams.get('google');
    if (status !== 'connected' && status !== 'error') return null;
    const reason = url.searchParams.get('reason') ?? undefined;
    url.searchParams.delete('google');
    url.searchParams.delete('reason');
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    pendingRedirect = { status, ...(reason ? { reason } : {}) };
    statusCache = null;
    needsReauth = false;
    return pendingRedirect;
  } catch {
    return null;
  }
}

/** Devuelve (una sola vez) el resultado de la ultima vuelta de Google, para mostrar un aviso. */
export function consumeGoogleRedirectResult(): GoogleRedirectResult | null {
  const result = pendingRedirect;
  pendingRedirect = null;
  return result;
}

// --- Transporte de Calendar por la API ----------------------------------------------------

interface ProxyTarget {
  path: string;
  query: Record<string, string>;
}

/** Traduce una ruta de Calendar API v3 (`calendars/primary/events/..`, `freeBusy`) a la ruta del proxy `/google/calendar/*`. */
export function toProxyTarget(relativePath: string): ProxyTarget {
  const url = new URL(relativePath, 'https://calendar.invalid/');
  const path = url.pathname.replace(/^\/+/, '');
  const query = Object.fromEntries(url.searchParams.entries());
  if (path === 'freeBusy') return { path: '/google/calendar/freebusy', query };
  if (path === 'calendars/primary') return { path: '/google/calendar/primary', query };
  const match = /^calendars\/primary\/events(\/.*)?$/.exec(path);
  if (match) return { path: `/google/calendar/events${match[1] ?? ''}`, query };
  throw new Error(`Ruta de Google Calendar no soportada por la nube: ${path}`);
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function errorMessageOf(body: unknown): string {
  const message = (body as { message?: unknown } | null | undefined)?.message;
  if (typeof message === 'string') return message;
  if (Array.isArray(message)) return message.filter((m): m is string => typeof m === 'string').join(' ');
  return '';
}

/**
 * Equivalente a `fetch(<Calendar API>)` pero por la API de StudentOS. Devuelve un `Response` con la MISMA semantica que
 * daria Google (200/204 en exito; 404/410 para "ya no existe"; 401 cuando hay que reconectar), de modo que la logica de
 * la fachada no cambia. Los errores de red/servidor se lanzan, igual que lo haria `fetch`.
 */
export async function googleCloudFetch(
  relativePath: string,
  init: { method?: string; body?: string } = {},
): Promise<Response> {
  const target = toProxyTarget(relativePath);
  const method = (init.method ?? 'GET').toUpperCase() as 'GET' | 'POST' | 'PATCH' | 'DELETE';
  let body: unknown;
  if (init.body !== undefined) {
    try {
      body = JSON.parse(init.body);
    } catch {
      throw new Error('Cuerpo de solicitud inválido para Google Calendar.');
    }
  }

  try {
    const payload = await requireClient().request<unknown>(target.path, { method, query: target.query, body });
    if (payload === null || payload === undefined) return new Response(null, { status: 204 });
    return jsonResponse(200, payload);
  } catch (error) {
    if (!isApiError(error)) throw error;
    const apiError: ApiError = error;
    const code = (apiError.body as { code?: unknown } | undefined)?.code;

    if (typeof code === 'string' && REAUTH_CODES.has(code)) {
      markGoogleCloudReauthRequired();
      return jsonResponse(401, { error: { message: 'Google Calendar necesita que vuelvas a autorizar el acceso.' } });
    }
    if (apiError.kind === 'auth') {
      // Sin sesion de StudentOS no hay forma de hablar con el servidor: se trata como "hay que reconectar".
      return jsonResponse(401, { error: { message: apiError.message } });
    }
    if ((apiError.kind === 'client' || apiError.kind === 'rate_limit') && apiError.status) {
      return jsonResponse(apiError.status, {
        error: { message: errorMessageOf(apiError.body) || apiError.message },
      });
    }
    // Red caida, timeout, servidor dormido, respuesta ilegible...: igual que un fetch que falla.
    throw new Error(apiError.message);
  }
}

/** Solo para pruebas. */
export function __resetGoogleCloudForTests(): void {
  sessionSignedIn = null;
  watcherStarted = false;
  needsReauth = false;
  statusCache = null;
  statusInflight = null;
  pendingRedirect = null;
}

/** Solo para pruebas: fija el estado de sesion sin pasar por Supabase. */
export function __setGoogleCloudSessionForTests(signedIn: boolean | null): void {
  sessionSignedIn = signedIn;
  watcherStarted = signedIn !== null;
}
