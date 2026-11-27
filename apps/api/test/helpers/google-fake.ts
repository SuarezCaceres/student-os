import { createHash, randomBytes } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

/**
 * Servidor local que imita a Google (OAuth + userinfo + Calendar API v3) para pruebas. Se configura en la API con
 * GOOGLE_OAUTH_BASE = GOOGLE_API_BASE = <url>, GOOGLE_AUTH_URL = <url>/o/oauth2/v2/auth. No hay red real.
 *
 * Verifica de verdad: client_id/secret, redirect_uri, PKCE S256 (code_verifier contra code_challenge), codigo de un
 * solo uso, refresh tokens revocables, access tokens con vida limitada y Bearer en cada llamada de Calendar.
 */

export const FAKE_CLIENT_ID = 'fake-client-id.apps.googleusercontent.com';
export const FAKE_CLIENT_SECRET = 'fake-client-secret-only-for-tests';

export interface FakeEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
  recurrence?: string[];
  extendedProperties?: { private?: Record<string, string> };
  reminders?: unknown;
  htmlLink?: string;
  [key: string]: unknown;
}

export interface ConsentOptions {
  email?: string;
  /** Scopes que "concede" el usuario (por defecto los pedidos). */
  grantedScopes?: string[];
  /** `false` simula que Google no entrega refresh token. */
  includeRefreshToken?: boolean;
}

export interface FakeCall {
  method: string;
  path: string;
  query: Record<string, string>;
  authorization?: string;
  body?: unknown;
}

interface CodeEntry {
  challenge: string;
  redirectUri: string;
  account: string;
  scope: string;
  includeRefresh: boolean;
  used: boolean;
}

interface AccessEntry {
  account: string;
  expiresAtMs: number;
  refreshToken?: string;
  /** Scopes concedidos, separados por espacios (como los devuelve Google). */
  scope: string;
}

const AUTH = 'https://www.googleapis.com/auth/';
const EVENTS_READ = ['calendar.readonly', 'calendar', 'calendar.events.readonly', 'calendar.events', 'calendar.app.created', 'calendar.events.freebusy', 'calendar.events.owned', 'calendar.events.owned.readonly', 'calendar.events.public.readonly'];
const EVENTS_WRITE = ['calendar', 'calendar.events', 'calendar.app.created', 'calendar.events.owned'];

/**
 * Scopes que acepta cada metodo de Calendar API v3 segun la referencia oficial (seccion Authorization), consultada el
 * 2026-11-25. Fuente y enlaces: `docs/specs/008-verificacion-app-google/scopes.md`. El servidor falso responde 403 como
 * Google si el token no tiene ninguno: asi las pruebas demuestran que `GOOGLE_SCOPES` cubre cada ruta del proxy.
 */
export function acceptedCalendarScopes(method: string, rest: string): string[] | null {
  let names: string[] | null = null;
  // Solo las rutas de eventos que usa el proxy: `calendars.get` y `freebusy.query` se retiraron (ADR 0008, revision
  // 2026-11-26) porque exigen scopes que la app ya no pide.
  if (/^calendars\/primary\/events(\/[^/]+(\/instances)?)?$/.test(rest)) {
    names = method === 'GET' ? EVENTS_READ : EVENTS_WRITE;
  }
  return names ? names.map((name) => AUTH + name) : null;
}

export interface FakeGoogle {
  /** Base unica (OAuth + API). */
  url: string;
  authUrl: string;
  calls: FakeCall[];
  counters: { codeExchanges: number; refreshes: number; revokes: number };
  /** Simula la pantalla de consentimiento: valida la URL que armo la API y devuelve la URL de callback con `code`. */
  consent(authorizationUrl: string, options?: ConsentOptions): { callbackUrl: string; code: string; params: URLSearchParams };
  /** Segundos de vida de los access tokens nuevos (por defecto 3600). */
  setAccessTokenLifetime(seconds: number): void;
  /** Invalida todos los access tokens (Google responde 401) sin tocar los refresh tokens. */
  invalidateAccessTokens(): void;
  /** El usuario "quito el acceso" en su cuenta de Google: los refresh tokens dan invalid_grant. */
  revokeAllRefreshTokens(): void;
  /** Igual, pero solo para los refresh tokens de una cuenta. */
  revokeRefreshTokensOf(email: string): void;
  refreshTokensOf(email: string): string[];
  /**
   * Emite directamente un refresh token para una cuenta, como el que Supabase recibe de Google al iniciar sesion con
   * `scopes` de Calendar (sin pasar por el flujo del API). Por defecto concede los scopes de la app (`GOOGLE_SCOPES`).
   */
  issueRefreshToken(email: string, grantedScopes?: string[]): string;
  /** Hace que las proximas N llamadas de Calendar devuelvan este estado/cuerpo. */
  failNextCalendar(status: number, body?: unknown, times?: number): void;
  eventsOf(email: string): FakeEvent[];
  seedEvent(email: string, event: FakeEvent): void;
  close(): Promise<void>;
}

const b64u = (buffer: Buffer): string => buffer.toString('base64url');

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function send(res: ServerResponse, status: number, body?: unknown): void {
  if (body === undefined) {
    res.statusCode = status;
    res.end();
    return;
  }
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(body));
}

const WEEKDAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

function parseUntil(rrule: string): number | null {
  const match = /UNTIL=(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/i.exec(rrule);
  return match ? Date.UTC(+match[1], +match[2] - 1, +match[3], +match[4], +match[5], +match[6]) : null;
}

/** Expansion minima de `RRULE:FREQ=WEEKLY;BYDAY=..;UNTIL=..` (suficiente para probar el recorte con UNTIL). */
function expandWeekly(event: FakeEvent, timeMinMs: number, timeMaxMs: number): FakeEvent[] {
  const rrule = (event.recurrence ?? []).find((line) => line.toUpperCase().startsWith('RRULE:'));
  const startIso = event.start?.dateTime;
  const endIso = event.end?.dateTime;
  if (!rrule || !startIso || !endIso) return [];
  const byDay = /BYDAY=([A-Z,]+)/i.exec(rrule)?.[1]?.split(',') ?? [];
  const untilMs = parseUntil(rrule);
  const startMs = Date.parse(startIso);
  const durationMs = Date.parse(endIso) - startMs;
  const out: FakeEvent[] = [];
  for (let day = 0; day < 120; day++) {
    const occurrenceMs = startMs + day * 86_400_000;
    if (occurrenceMs < timeMinMs || occurrenceMs >= timeMaxMs) continue;
    if (untilMs !== null && occurrenceMs > untilMs) continue;
    if (!byDay.includes(WEEKDAY_CODES[new Date(occurrenceMs).getUTCDay()])) continue;
    const instanceStart = new Date(occurrenceMs).toISOString();
    out.push({
      ...event,
      id: `${event.id}_${instanceStart.replace(/[-:]/g, '').replace(/\.\d+/, '')}`,
      recurringEventId: event.id,
      recurrence: undefined,
      start: { dateTime: instanceStart, timeZone: event.start?.timeZone },
      end: { dateTime: new Date(occurrenceMs + durationMs).toISOString(), timeZone: event.end?.timeZone },
    });
  }
  return out;
}

export async function startFakeGoogle(): Promise<FakeGoogle> {
  const calls: FakeCall[] = [];
  const counters = { codeExchanges: 0, refreshes: 0, revokes: 0 };
  const codes = new Map<string, CodeEntry>();
  const accessTokens = new Map<string, AccessEntry>();
  const refreshTokens = new Map<string, { account: string; revoked: boolean; scope: string }>();
  const eventsByAccount = new Map<string, Map<string, FakeEvent>>();
  const deletedIds = new Set<string>();
  const failures: Array<{ status: number; body?: unknown }> = [];
  let lifetimeSeconds = 3600;
  let counter = 0;
  let baseUrl = '';

  const events = (account: string): Map<string, FakeEvent> => {
    let map = eventsByAccount.get(account);
    if (!map) {
      map = new Map();
      eventsByAccount.set(account, map);
    }
    return map;
  };

  const mintAccessToken = (account: string, scope: string, refreshToken?: string): { token: string; expiresIn: number } => {
    const token = `fake-at-${++counter}-${b64u(randomBytes(6))}`;
    accessTokens.set(token, { account, expiresAtMs: Date.now() + lifetimeSeconds * 1000, refreshToken, scope });
    return { token, expiresIn: lifetimeSeconds };
  };

  const accessFor = (req: IncomingMessage): AccessEntry | null => {
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    const entry = accessTokens.get(token);
    if (!entry || entry.expiresAtMs <= Date.now()) return null;
    return entry;
  };
  const accountFor = (req: IncomingMessage): string | null => accessFor(req)?.account ?? null;

  const handler = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const url = new URL(req.url ?? '/', 'http://fake.local');
    const path = url.pathname;
    const query = Object.fromEntries(url.searchParams.entries());
    const raw = await readBody(req);
    const contentType = req.headers['content-type'] ?? '';
    let body: unknown;
    if (raw) {
      body = contentType.includes('application/json')
        ? JSON.parse(raw)
        : Object.fromEntries(new URLSearchParams(raw).entries());
    }
    calls.push({ method: req.method ?? 'GET', path, query, authorization: req.headers.authorization, body });

    // --- OAuth --------------------------------------------------------------------
    if (path === '/token' && req.method === 'POST') {
      const form = (body ?? {}) as Record<string, string>;
      if (form.client_id !== FAKE_CLIENT_ID || form.client_secret !== FAKE_CLIENT_SECRET) {
        return send(res, 401, { error: 'invalid_client' });
      }
      if (form.grant_type === 'authorization_code') {
        counters.codeExchanges++;
        const entry = codes.get(form.code);
        if (!entry || entry.used) return send(res, 400, { error: 'invalid_grant' });
        entry.used = true;
        const verifierChallenge = b64u(createHash('sha256').update(form.code_verifier ?? '', 'ascii').digest());
        if (verifierChallenge !== entry.challenge) return send(res, 400, { error: 'invalid_grant' });
        if (form.redirect_uri !== entry.redirectUri) return send(res, 400, { error: 'redirect_uri_mismatch' });
        const refreshToken = entry.includeRefresh ? `fake-rt-${++counter}-${b64u(randomBytes(8))}` : undefined;
        if (refreshToken) refreshTokens.set(refreshToken, { account: entry.account, revoked: false, scope: entry.scope });
        const access = mintAccessToken(entry.account, entry.scope, refreshToken);
        return send(res, 200, {
          access_token: access.token,
          expires_in: access.expiresIn,
          refresh_token: refreshToken,
          scope: entry.scope,
          token_type: 'Bearer',
        });
      }
      if (form.grant_type === 'refresh_token') {
        counters.refreshes++;
        const entry = refreshTokens.get(form.refresh_token);
        if (!entry || entry.revoked) return send(res, 400, { error: 'invalid_grant', error_description: 'Token has been expired or revoked.' });
        const access = mintAccessToken(entry.account, entry.scope, form.refresh_token);
        return send(res, 200, { access_token: access.token, expires_in: access.expiresIn, scope: entry.scope, token_type: 'Bearer' });
      }
      return send(res, 400, { error: 'unsupported_grant_type' });
    }

    if (path === '/revoke' && req.method === 'POST') {
      counters.revokes++;
      const token = ((body ?? {}) as Record<string, string>).token;
      const entry = refreshTokens.get(token);
      if (!entry) return send(res, 400, { error: 'invalid_token' });
      entry.revoked = true;
      for (const [at, value] of accessTokens) if (value.refreshToken === token) accessTokens.delete(at);
      return send(res, 200, {});
    }

    if (path === '/oauth2/v3/userinfo') {
      const account = accountFor(req);
      if (!account) return send(res, 401, { error: { code: 401, message: 'Invalid Credentials' } });
      return send(res, 200, { email: account, sub: `sub-${account}` });
    }

    // --- Calendar API v3 --------------------------------------------------------------
    if (path.startsWith('/calendar/v3/')) {
      const access = accessFor(req);
      if (!access) return send(res, 401, { error: { code: 401, message: 'Invalid Credentials', errors: [{ reason: 'authError' }] } });
      const account = access.account;
      const forced = failures.shift();
      if (forced) return send(res, forced.status, forced.body ?? { error: { code: forced.status, message: 'fallo simulado' } });

      const rest = path.slice('/calendar/v3/'.length);
      const accepted = acceptedCalendarScopes(req.method ?? 'GET', rest);
      const granted = access.scope.split(' ');
      if (accepted && !accepted.some((scope) => granted.includes(scope))) {
        return send(res, 403, {
          error: { code: 403, message: 'Request had insufficient authentication scopes.', status: 'PERMISSION_DENIED', errors: [{ reason: 'insufficientPermissions' }] },
        });
      }
      const store = events(account);

      if (rest === 'calendars/primary/events' && req.method === 'GET') {
        const timeMin = query.timeMin ? Date.parse(query.timeMin) : 0;
        const timeMax = query.timeMax ? Date.parse(query.timeMax) : Number.MAX_SAFE_INTEGER;
        const items: FakeEvent[] = [];
        for (const event of store.values()) {
          if (query.singleEvents === 'true' && event.recurrence?.length) {
            items.push(...expandWeekly(event, timeMin, timeMax));
          } else if (!event.start?.dateTime || (Date.parse(event.start.dateTime) < timeMax && Date.parse(event.end?.dateTime ?? event.start.dateTime) > timeMin)) {
            items.push(event);
          }
        }
        return send(res, 200, { kind: 'calendar#events', defaultReminders: [{ method: 'popup', minutes: 10 }], items });
      }
      if (rest === 'calendars/primary/events' && req.method === 'POST') {
        const id = `ev${++counter}x${b64u(randomBytes(3)).toLowerCase().replace(/[^a-v0-9]/g, 'a')}`;
        const event: FakeEvent = { ...(body as FakeEvent), id, htmlLink: `https://calendar.example/${id}` };
        store.set(id, event);
        return send(res, 200, event);
      }
      const instances = /^calendars\/primary\/events\/([^/]+)\/instances$/.exec(rest);
      if (instances && req.method === 'GET') {
        const event = store.get(decodeURIComponent(instances[1]));
        if (!event) return send(res, 404, { error: { code: 404, message: 'Not Found' } });
        const timeMin = query.timeMin ? Date.parse(query.timeMin) : Date.now() - 86_400_000;
        const timeMax = query.timeMax ? Date.parse(query.timeMax) : Date.now() + 60 * 86_400_000;
        return send(res, 200, { items: expandWeekly(event, timeMin, timeMax) });
      }
      const single = /^calendars\/primary\/events\/([^/]+)$/.exec(rest);
      if (single) {
        const id = decodeURIComponent(single[1]);
        if (req.method === 'GET') {
          const event = store.get(id);
          if (event) return send(res, 200, event);
          return send(res, deletedIds.has(id) ? 410 : 404, { error: { code: 404, message: 'Not Found' } });
        }
        if (req.method === 'PATCH') {
          const event = store.get(id);
          if (!event) return send(res, deletedIds.has(id) ? 410 : 404, { error: { code: 404, message: 'Not Found' } });
          const patched = { ...event, ...(body as FakeEvent), id };
          store.set(id, patched);
          return send(res, 200, patched);
        }
        if (req.method === 'DELETE') {
          if (!store.delete(id)) return send(res, deletedIds.has(id) ? 410 : 404, { error: { code: 404, message: 'Not Found' } });
          deletedIds.add(id);
          return send(res, 204);
        }
      }
    }
    return send(res, 404, { error: { code: 404, message: 'Ruta desconocida en el servidor falso' } });
  };

  const server: Server = createServer((req, res) => {
    handler(req, res).catch((error: unknown) => {
      send(res, 500, { error: { code: 500, message: error instanceof Error ? error.message : 'error' } });
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  return {
    url: baseUrl,
    authUrl: `${baseUrl}/o/oauth2/v2/auth`,
    calls,
    counters,
    consent(authorizationUrl, options = {}) {
      const authUrl = new URL(authorizationUrl);
      const params = authUrl.searchParams;
      const expect = (name: string, value: string): void => {
        if (params.get(name) !== value) throw new Error(`Parametro OAuth inesperado: ${name}`);
      };
      if (authUrl.origin + authUrl.pathname !== `${baseUrl}/o/oauth2/v2/auth`) throw new Error('La URL no apunta al servidor falso');
      expect('client_id', FAKE_CLIENT_ID);
      expect('response_type', 'code');
      expect('access_type', 'offline');
      expect('prompt', 'consent');
      expect('code_challenge_method', 'S256');
      const challenge = params.get('code_challenge');
      const state = params.get('state');
      const redirectUri = params.get('redirect_uri');
      if (!challenge || !state || !redirectUri) throw new Error('Faltan parametros OAuth');
      const code = `fake-code-${++counter}-${b64u(randomBytes(6))}`;
      codes.set(code, {
        challenge,
        redirectUri,
        account: options.email ?? 'ana@gmail.example',
        scope: (options.grantedScopes ?? (params.get('scope') ?? '').split(' ')).join(' '),
        includeRefresh: options.includeRefreshToken ?? true,
        used: false,
      });
      const callback = new URL(redirectUri);
      callback.searchParams.set('code', code);
      callback.searchParams.set('state', state);
      return { callbackUrl: callback.toString(), code, params };
    },
    setAccessTokenLifetime(seconds) {
      lifetimeSeconds = seconds;
    },
    invalidateAccessTokens() {
      accessTokens.clear();
    },
    revokeAllRefreshTokens() {
      for (const entry of refreshTokens.values()) entry.revoked = true;
    },
    revokeRefreshTokensOf(email) {
      for (const entry of refreshTokens.values()) if (entry.account === email) entry.revoked = true;
    },
    refreshTokensOf(email) {
      return [...refreshTokens.entries()].filter(([, entry]) => entry.account === email).map(([token]) => token);
    },
    issueRefreshToken(email, grantedScopes) {
      const scope = (
        grantedScopes ?? [
          'openid',
          'email',
          'https://www.googleapis.com/auth/calendar.events.owned',
        ]
      ).join(' ');
      const token = `fake-rt-${++counter}-${b64u(randomBytes(8))}`;
      refreshTokens.set(token, { account: email, revoked: false, scope });
      return token;
    },
    failNextCalendar(status, failureBody, times = 1) {
      for (let i = 0; i < times; i++) failures.push({ status, body: failureBody });
    },
    eventsOf(email) {
      return [...events(email).values()];
    },
    seedEvent(email, event) {
      events(email).set(event.id, event);
    },
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeAllConnections();
      }),
  };
}
