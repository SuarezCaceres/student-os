// Google FALSO para el E2E (puerto base 54342): OAuth (con pagina de consentimiento que redirige sola), token, revoke,
// userinfo y Calendar API v3. Mismo patron que apps/api/test/helpers/google-fake.ts, pero en puerto fijo y con
// `GET /o/oauth2/v2/auth` real para que el NAVEGADOR complete el flujo redirect -> callback.
// Verifica de verdad: client_id/secret, redirect_uri, PKCE S256, codigo de un solo uso, refresh tokens revocables.
import { createHash, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';

export const FAKE_CLIENT_ID = 'fake-client-id.apps.googleusercontent.com';
export const FAKE_CLIENT_SECRET = 'fake-client-secret-only-for-e2e';

const b64u = (buffer) => buffer.toString('base64url');
const WEEKDAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

function parseUntil(rrule) {
  const m = /UNTIL=(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/i.exec(rrule);
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : null;
}

function expandWeekly(event, timeMinMs, timeMaxMs) {
  const rrule = (event.recurrence ?? []).find((line) => line.toUpperCase().startsWith('RRULE:'));
  const startIso = event.start?.dateTime;
  const endIso = event.end?.dateTime;
  if (!rrule || !startIso || !endIso) return [];
  const byDay = /BYDAY=([A-Z,]+)/i.exec(rrule)?.[1]?.split(',') ?? [];
  const untilMs = parseUntil(rrule);
  const startMs = Date.parse(startIso);
  const durationMs = Date.parse(endIso) - startMs;
  const out = [];
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

export async function startFakeGoogle({ port, host = '::' }) {
  const baseUrl = `http://localhost:${port}`;
  const calls = [];
  const counters = { codeExchanges: 0, refreshes: 0, revokes: 0, consents: 0 };
  const codes = new Map();
  const accessTokens = new Map();
  const refreshTokens = new Map();
  const eventsByAccount = new Map();
  const deletedIds = new Set();
  const failures = [];
  const opts = { consentEmail: 'ana@gmail.example' };
  let counter = 0;

  const events = (account) => {
    let map = eventsByAccount.get(account);
    if (!map) {
      map = new Map();
      eventsByAccount.set(account, map);
    }
    return map;
  };

  const mintAccessToken = (account, refreshToken) => {
    const token = `fake-at-${++counter}-${b64u(randomBytes(6))}`;
    accessTokens.set(token, { account, expiresAtMs: Date.now() + 3600_000, refreshToken });
    return { token, expiresIn: 3600 };
  };

  const accountFor = (req) => {
    const header = req.headers.authorization ?? '';
    const entry = accessTokens.get(header.startsWith('Bearer ') ? header.slice(7) : '');
    return !entry || entry.expiresAtMs <= Date.now() ? null : entry.account;
  };

  const readBody = (req) =>
    new Promise((resolve, reject) => {
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      req.on('error', reject);
    });

  const send = (res, status, body) => {
    res.statusCode = status;
    if (body === undefined) return res.end();
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify(body));
  };

  const handler = async (req, res) => {
    const url = new URL(req.url ?? '/', baseUrl);
    const path = url.pathname;
    const query = Object.fromEntries(url.searchParams.entries());
    const raw = await readBody(req);
    const contentType = req.headers['content-type'] ?? '';
    let body;
    if (raw) body = contentType.includes('application/json') ? JSON.parse(raw) : Object.fromEntries(new URLSearchParams(raw).entries());
    if (!path.startsWith('/__e2e')) calls.push({ method: req.method, path, query, authorization: req.headers.authorization, body });

    // --- Pantalla de consentimiento (la abre el navegador): valida y redirige al callback de la API ---
    if (path === '/o/oauth2/v2/auth' && req.method === 'GET') {
      const expect = (name, value) => {
        if (url.searchParams.get(name) !== value) throw new Error(`Parametro OAuth inesperado: ${name}`);
      };
      expect('client_id', FAKE_CLIENT_ID);
      expect('response_type', 'code');
      expect('access_type', 'offline');
      expect('prompt', 'consent');
      expect('code_challenge_method', 'S256');
      const challenge = url.searchParams.get('code_challenge');
      const state = url.searchParams.get('state');
      const redirectUri = url.searchParams.get('redirect_uri');
      if (!challenge || !state || !redirectUri) throw new Error('Faltan parametros OAuth');
      counters.consents++;
      const code = `fake-code-${++counter}-${b64u(randomBytes(6))}`;
      codes.set(code, {
        challenge,
        redirectUri,
        account: opts.consentEmail,
        scope: url.searchParams.get('scope') ?? '',
        used: false,
      });
      const callback = new URL(redirectUri);
      callback.searchParams.set('code', code);
      callback.searchParams.set('state', state);
      res.statusCode = 302;
      res.setHeader('location', callback.toString());
      return res.end();
    }

    // --- OAuth -------------------------------------------------------------------------------------
    if (path === '/token' && req.method === 'POST') {
      const form = body ?? {};
      if (form.client_id !== FAKE_CLIENT_ID || form.client_secret !== FAKE_CLIENT_SECRET) return send(res, 401, { error: 'invalid_client' });
      if (form.grant_type === 'authorization_code') {
        counters.codeExchanges++;
        const entry = codes.get(form.code);
        if (!entry || entry.used) return send(res, 400, { error: 'invalid_grant' });
        entry.used = true;
        const challenge = b64u(createHash('sha256').update(form.code_verifier ?? '', 'ascii').digest());
        if (challenge !== entry.challenge) return send(res, 400, { error: 'invalid_grant' });
        if (form.redirect_uri !== entry.redirectUri) return send(res, 400, { error: 'redirect_uri_mismatch' });
        const refreshToken = `fake-rt-${++counter}-${b64u(randomBytes(8))}`;
        refreshTokens.set(refreshToken, { account: entry.account, revoked: false });
        const access = mintAccessToken(entry.account, refreshToken);
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
        const access = mintAccessToken(entry.account, form.refresh_token);
        return send(res, 200, { access_token: access.token, expires_in: access.expiresIn, token_type: 'Bearer' });
      }
      return send(res, 400, { error: 'unsupported_grant_type' });
    }
    if (path === '/revoke' && req.method === 'POST') {
      counters.revokes++;
      const entry = refreshTokens.get((body ?? {}).token);
      if (!entry) return send(res, 400, { error: 'invalid_token' });
      entry.revoked = true;
      for (const [at, value] of accessTokens) if (value.refreshToken === (body ?? {}).token) accessTokens.delete(at);
      return send(res, 200, {});
    }
    if (path === '/oauth2/v3/userinfo') {
      const account = accountFor(req);
      if (!account) return send(res, 401, { error: { code: 401, message: 'Invalid Credentials' } });
      return send(res, 200, { email: account, sub: `sub-${account}` });
    }

    // --- Calendar API v3 -----------------------------------------------------------------------------
    if (path.startsWith('/calendar/v3/')) {
      const account = accountFor(req);
      if (!account) return send(res, 401, { error: { code: 401, message: 'Invalid Credentials', errors: [{ reason: 'authError' }] } });
      const forced = failures.shift();
      if (forced) return send(res, forced.status, forced.body ?? { error: { code: forced.status, message: 'fallo simulado' } });
      const rest = path.slice('/calendar/v3/'.length);
      const store = events(account);
      if (rest === 'calendars/primary' && req.method === 'GET') return send(res, 200, { id: account, summary: account });
      if (rest === 'freeBusy' && req.method === 'POST') return send(res, 200, { calendars: { primary: { busy: [] } } });
      if (rest === 'calendars/primary/events' && req.method === 'GET') {
        const timeMin = query.timeMin ? Date.parse(query.timeMin) : 0;
        const timeMax = query.timeMax ? Date.parse(query.timeMax) : Number.MAX_SAFE_INTEGER;
        const items = [];
        for (const event of store.values()) {
          if (query.singleEvents === 'true' && event.recurrence?.length) items.push(...expandWeekly(event, timeMin, timeMax));
          else if (!event.start?.dateTime || (Date.parse(event.start.dateTime) < timeMax && Date.parse(event.end?.dateTime ?? event.start.dateTime) > timeMin)) items.push(event);
        }
        return send(res, 200, { kind: 'calendar#events', defaultReminders: [{ method: 'popup', minutes: 10 }], items });
      }
      if (rest === 'calendars/primary/events' && req.method === 'POST') {
        const id = `ev${++counter}x${b64u(randomBytes(3)).toLowerCase().replace(/[^a-v0-9]/g, 'a')}`;
        const event = { ...body, id, htmlLink: `https://calendar.example/${id}` };
        store.set(id, event);
        return send(res, 200, event);
      }
      const instances = /^calendars\/primary\/events\/([^/]+)\/instances$/.exec(rest);
      if (instances && req.method === 'GET') {
        const event = store.get(decodeURIComponent(instances[1]));
        if (!event) return send(res, 404, { error: { code: 404, message: 'Not Found' } });
        return send(res, 200, { items: expandWeekly(event, Date.now() - 86_400_000, Date.now() + 60 * 86_400_000) });
      }
      const single = /^calendars\/primary\/events\/([^/]+)$/.exec(rest);
      if (single) {
        const id = decodeURIComponent(single[1]);
        const event = store.get(id);
        if (req.method === 'GET') return event ? send(res, 200, event) : send(res, deletedIds.has(id) ? 410 : 404, { error: { code: 404, message: 'Not Found' } });
        if (req.method === 'PATCH') {
          if (!event) return send(res, deletedIds.has(id) ? 410 : 404, { error: { code: 404, message: 'Not Found' } });
          const patched = { ...event, ...body, id };
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
    return send(res, 404, { error: { code: 404, message: 'Ruta desconocida en el Google falso' } });
  };

  const server = createServer((req, res) => {
    handler(req, res).catch((error) => {
      send(res, 500, { error: { code: 500, message: error instanceof Error ? error.message : 'error' } });
    });
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, resolve);
  });

  return {
    url: baseUrl,
    authUrl: `${baseUrl}/o/oauth2/v2/auth`,
    calls,
    counters,
    opts,
    revokeAllRefreshTokens() {
      for (const entry of refreshTokens.values()) entry.revoked = true;
    },
    refreshTokensOf: (email) => [...refreshTokens.entries()].filter(([, e]) => e.account === email).map(([t]) => t),
    revokedStateOf: (email) => [...refreshTokens.values()].filter((e) => e.account === email).map((e) => e.revoked),
    failNextCalendar(status, body, times = 1) {
      for (let i = 0; i < times; i++) failures.push({ status, body });
    },
    eventsOf: (email) => [...events(email).values()],
    seedEvent: (email, event) => events(email).set(event.id, event),
    close: () =>
      new Promise((resolve) => {
        server.close(() => resolve());
        server.closeAllConnections();
      }),
  };
}
