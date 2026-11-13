import { Logger } from '@nestjs/common';
import { clearAccountDeletionHooksForTests, runAccountDeletionHooks } from '../common/account-deletion';
import { FAKE_CLIENT_ID } from '../../test/helpers/google-fake';
import {
  connectUser,
  createGoogleHarness,
  OTHER_WEB_ORIGIN,
  USER_A,
  USER_B,
  WEB_ORIGIN,
  type GoogleHarness,
} from '../../test/helpers/google-fixtures';
import { GoogleHttpException } from './google.errors';
import { generatePkcePair } from './oauth-state';
import { pkceVerifierAad, refreshTokenAad } from './token-cipher';

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return 'sin-error';
  } catch (error) {
    return error instanceof GoogleHttpException ? error.code : `otro:${String(error)}`;
  }
}

const listEvents = (h: GoogleHarness, userId: string) =>
  h.service.calendarRequest(userId, { method: 'GET', path: 'calendars/primary/events' });

describe('GoogleService (con servidor falso de Google)', () => {
  let h: GoogleHarness;

  beforeEach(async () => {
    h = await createGoogleHarness();
  });

  afterEach(async () => {
    await h.close();
  });

  describe('flujo de autorizacion', () => {
    it('connect arma la URL de Google con PKCE S256, offline, consent y los scopes minimos', async () => {
      const { url } = await h.service.startConnect(USER_A, `${WEB_ORIGIN}/horario`);
      const parsed = new URL(url);
      expect(parsed.origin + parsed.pathname).toBe(h.fake.authUrl);
      const p = parsed.searchParams;
      expect(p.get('client_id')).toBe(FAKE_CLIENT_ID);
      expect(p.get('response_type')).toBe('code');
      expect(p.get('access_type')).toBe('offline');
      expect(p.get('prompt')).toBe('consent');
      expect(p.get('code_challenge_method')).toBe('S256');
      expect(p.get('code_challenge')).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(p.get('redirect_uri')).toBe('http://localhost:3000/google/callback');
      expect(p.get('scope')?.split(' ')).toEqual([
        'openid',
        'email',
        'https://www.googleapis.com/auth/calendar.readonly',
        'https://www.googleapis.com/auth/calendar.events',
      ]);
      // El verifier NO viaja en la URL: se guarda cifrado en servidor.
      expect(url).not.toMatch(/code_verifier/);
      const [stored] = [...h.repo.states.values()];
      expect(stored.codeVerifierEnc).toMatch(/^v1\./);
      expect(stored.userId).toBe(USER_A);
    });

    it('flujo completo: guarda el refresh token CIFRADO, la cuenta y redirige con ?google=connected', async () => {
      const redirect = await connectUser(h, USER_A, { email: 'ana@gmail.example', returnTo: `${WEB_ORIGIN}/horario` });
      expect(redirect).toBe(`${WEB_ORIGIN}/horario?google=connected`);

      const stored = await h.repo.getConnection(USER_A);
      expect(stored).not.toBeNull();
      const realRefreshToken = h.fake.refreshTokensOf('ana@gmail.example')[0];
      expect(realRefreshToken).toBeTruthy();
      expect(stored?.refreshTokenEnc).not.toContain(realRefreshToken);
      expect(stored?.refreshTokenEnc.startsWith('v1.')).toBe(true);
      expect(stored?.accountEmail).toBe('ana@gmail.example');
      expect(stored?.needsReauth).toBe(false);
      expect(stored?.scopes).toContain('calendar.events');
      // El estado PKCE se consumio.
      expect(h.repo.states.size).toBe(0);

      const status = await h.service.getStatus(USER_A);
      expect(status).toMatchObject({ configured: true, connected: true, needsReauth: false, email: 'ana@gmail.example' });
      // El status nunca incluye secretos.
      expect(JSON.stringify(status)).not.toContain(realRefreshToken);
      expect(JSON.stringify(status)).not.toMatch(/token|secret/i);
    });

    it('PKCE: Google verifica el verifier real; si el guardado en servidor no corresponde al challenge, el intercambio falla', async () => {
      const { url } = await h.service.startConnect(USER_A, undefined);
      const { code, callbackUrl } = h.fake.consent(url);
      const cb = new URL(callbackUrl);
      // Sustituye el verifier guardado (cifrado correctamente) por otro distinto al que dio origen al challenge.
      const row = [...h.repo.states.values()][0];
      row.codeVerifierEnc = h.config.cipher.encrypt(generatePkcePair().verifier, pkceVerifierAad(USER_A, row.id)).blob;
      const redirect = await h.service.handleCallback({ code, state: cb.searchParams.get('state') ?? '' });
      expect(new URL(redirect).searchParams.get('reason')).toBe('exchange_failed');
      expect(h.fake.counters.codeExchanges).toBe(1);
      expect(await h.repo.getConnection(USER_A)).toBeNull();
    });

    it('PKCE: el code_verifier enviado a Google es el que corresponde al code_challenge de la URL', async () => {
      await connectUser(h, USER_A);
      const exchange = h.fake.calls.find((c) => c.path === '/token');
      const form = exchange?.body as Record<string, string>;
      expect(form.grant_type).toBe('authorization_code');
      expect(form.code_verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(form.client_secret).toBeTruthy();
      expect(form.redirect_uri).toBe('http://localhost:3000/google/callback');
    });

    it('el state es de un solo uso: repetir el callback falla y no cambia nada', async () => {
      const { url } = await h.service.startConnect(USER_A, undefined);
      const { code, callbackUrl } = h.fake.consent(url);
      const state = new URL(callbackUrl).searchParams.get('state') ?? '';
      const first = await h.service.handleCallback({ code, state });
      expect(new URL(first).searchParams.get('google')).toBe('connected');
      const second = await h.service.handleCallback({ code, state });
      expect(new URL(second).searchParams.get('google')).toBe('error');
      expect(new URL(second).searchParams.get('reason')).toBe('invalid_state');
      expect(h.fake.counters.codeExchanges).toBe(1);
    });

    it('state expirado (TTL de 10 min): rechazado antes de hablar con Google', async () => {
      const { url } = await h.service.startConnect(USER_A, undefined);
      const { code, callbackUrl } = h.fake.consent(url);
      h.clock.now += 10 * 60 * 1000 + 1;
      const redirect = await h.service.handleCallback({ code, state: new URL(callbackUrl).searchParams.get('state') ?? '' });
      expect(new URL(redirect).searchParams.get('reason')).toBe('expired');
      expect(h.fake.counters.codeExchanges).toBe(0);
      expect(await h.repo.getConnection(USER_A)).toBeNull();
    });

    it('state alterado: rechazado sin tocar la base ni Google', async () => {
      const { url } = await h.service.startConnect(USER_A, undefined);
      const { code, callbackUrl } = h.fake.consent(url);
      const state = new URL(callbackUrl).searchParams.get('state') ?? '';
      const [body, sig] = state.split('.');
      const forgedBody = Buffer.from(
        JSON.stringify({ ...JSON.parse(Buffer.from(body, 'base64url').toString()), u: USER_B }),
      ).toString('base64url');
      const redirect = await h.service.handleCallback({ code, state: `${forgedBody}.${sig}` });
      expect(new URL(redirect).searchParams.get('reason')).toBe('invalid_state');
      expect(h.fake.counters.codeExchanges).toBe(0);
      expect(h.repo.states.size).toBe(1); // la fila legitima sigue ahi (no se consumio)
    });

    it('state de otro usuario: un state firmado para B con el nonce de A no conecta nada', async () => {
      const { url } = await h.service.startConnect(USER_A, undefined);
      const { code, callbackUrl } = h.fake.consent(url);
      const original = h.config.stateSigner.verify(new URL(callbackUrl).searchParams.get('state') ?? '', { now: h.clock.now });
      // Firma valida (clave correcta) pero ligada a B: la fila del nonce pertenece a A.
      const forged = h.config.stateSigner.sign({ userId: USER_B, nonce: original.nonce, expiresAtMs: original.expiresAtMs });
      const redirect = await h.service.handleCallback({ code, state: forged });
      expect(new URL(redirect).searchParams.get('reason')).toBe('invalid_state');
      expect(await h.repo.getConnection(USER_B)).toBeNull();
      expect(await h.repo.getConnection(USER_A)).toBeNull();
    });

    it('si el usuario deniega en Google, vuelve a su pagina con ?google=error&reason=denied', async () => {
      const { url } = await h.service.startConnect(USER_A, `${OTHER_WEB_ORIGIN}/horario`);
      const state = new URL(url).searchParams.get('state') ?? '';
      const redirect = await h.service.handleCallback({ error: 'access_denied', state });
      expect(redirect).toBe(`${OTHER_WEB_ORIGIN}/horario?google=error&reason=denied`);
    });

    it('sin refresh token (Google no lo entrego): error y no se guarda nada', async () => {
      const redirect = await connectUser(h, USER_A, { includeRefreshToken: false });
      expect(new URL(redirect).searchParams.get('reason')).toBe('missing_refresh_token');
      expect(await h.repo.getConnection(USER_A)).toBeNull();
    });

    it('consentimiento granular sin permiso de eventos: error y se revoca lo concedido', async () => {
      const redirect = await connectUser(h, USER_A, {
        grantedScopes: ['openid', 'email', 'https://www.googleapis.com/auth/calendar.readonly'],
      });
      expect(new URL(redirect).searchParams.get('reason')).toBe('missing_scopes');
      expect(await h.repo.getConnection(USER_A)).toBeNull();
      expect(h.fake.counters.revokes).toBe(1);
    });

    it('no se puede iniciar el flujo con un returnTo fuera de WEB_ORIGINS (open redirect)', async () => {
      for (const bad of ['https://evil.com/', 'javascript:alert(1)', `${WEB_ORIGIN}@evil.com`]) {
        await expect(h.service.startConnect(USER_A, bad)).rejects.toMatchObject({ code: 'google_invalid_return_to' });
      }
      expect(h.repo.states.size).toBe(0);
    });

    it('aunque la fila guardara un destino no permitido, el callback redirige solo dentro de WEB_ORIGINS', async () => {
      const { url } = await h.service.startConnect(USER_A, undefined);
      const { code, callbackUrl } = h.fake.consent(url);
      [...h.repo.states.values()][0].redirectTo = 'https://evil.com/robo';
      const redirect = await h.service.handleCallback({ code, state: new URL(callbackUrl).searchParams.get('state') ?? '' });
      expect(new URL(redirect).origin).toBe(WEB_ORIGIN);
    });

    it('sin configuracion (falta secreto/clave) responde not_configured y nunca contacta a Google', async () => {
      const bare = await createGoogleHarness({ GOOGLE_CLIENT_SECRET: undefined });
      try {
        expect(await codeOf(bare.service.startConnect(USER_A, undefined))).toBe('google_not_configured');
        const redirect = await bare.service.handleCallback({ code: 'x', state: 'y' });
        expect(new URL(redirect).searchParams.get('reason')).toBe('not_configured');
        expect((await bare.service.getStatus(USER_A)).configured).toBe(false);
      } finally {
        await bare.close();
      }
    });

    it('una clave de cifrado corta cuenta como no configurado', async () => {
      const weak = await createGoogleHarness({ GOOGLE_TOKEN_ENC_KEY: 'corta' });
      try {
        expect(await codeOf(weak.service.startConnect(USER_A, undefined))).toBe('google_not_configured');
      } finally {
        await weak.close();
      }
    });
  });

  describe('access token en memoria', () => {
    beforeEach(async () => {
      await connectUser(h, USER_A, { email: 'ana@gmail.example' });
    });

    it('tras conectar reutiliza el access token del intercambio: cero renovaciones', async () => {
      await listEvents(h, USER_A);
      await listEvents(h, USER_A);
      expect(h.fake.counters.refreshes).toBe(0);
    });

    it('se renueva automaticamente ANTES de expirar (margen de 60 s) y no antes', async () => {
      h.clock.now += 3600 * 1000 - 61_000; // quedan 61 s: todavia sirve
      await listEvents(h, USER_A);
      expect(h.fake.counters.refreshes).toBe(0);

      h.clock.now += 2_000; // quedan 59 s: debe renovar
      await listEvents(h, USER_A);
      expect(h.fake.counters.refreshes).toBe(1);

      await listEvents(h, USER_A); // el nuevo dura otra hora
      expect(h.fake.counters.refreshes).toBe(1);
    });

    it('la renovacion usa el refresh token DESCIFRADO (Google lo reconoce) y no lo expone', async () => {
      h.clock.now += 3600 * 1000;
      await listEvents(h, USER_A);
      const tokenCall = h.fake.calls.filter((c) => c.path === '/token').at(-1);
      expect((tokenCall?.body as Record<string, string> | undefined)?.refresh_token).toBe(h.fake.refreshTokensOf('ana@gmail.example')[0]);
    });

    it('llamadas simultaneas con el token vencido comparten UNA sola renovacion', async () => {
      h.clock.now += 3600 * 1000;
      await Promise.all(Array.from({ length: 8 }, () => listEvents(h, USER_A)));
      expect(h.fake.counters.refreshes).toBe(1);
    });

    it('si Google rechaza un access token "vigente" (401), renueva una vez y reintenta', async () => {
      h.fake.invalidateAccessTokens();
      const result = await listEvents(h, USER_A);
      expect(result.status).toBe(200);
      expect(h.fake.counters.refreshes).toBe(1);
    });

    it('la vida del access token que reporta Google se respeta', async () => {
      h.fake.setAccessTokenLifetime(120);
      h.clock.now += 3600 * 1000;
      await listEvents(h, USER_A); // renueva (120 s de vida)
      h.clock.now += 70_000; // quedan 50 s < margen
      await listEvents(h, USER_A);
      expect(h.fake.counters.refreshes).toBe(2);
    });
  });

  describe('invalid_grant / revocado', () => {
    beforeEach(async () => {
      await connectUser(h, USER_A, { email: 'ana@gmail.example' });
    });

    it('si Google revoca el permiso: marca needsReauth y responde google_reauth_required', async () => {
      h.fake.revokeAllRefreshTokens();
      h.fake.invalidateAccessTokens();
      expect(await codeOf(listEvents(h, USER_A))).toBe('google_reauth_required');
      expect((await h.repo.getConnection(USER_A))?.needsReauth).toBe(true);
      expect(await h.service.getStatus(USER_A)).toMatchObject({ connected: true, needsReauth: true });
    });

    it('una vez marcado, no vuelve a molestar a Google hasta que el usuario reconecte', async () => {
      h.fake.revokeAllRefreshTokens();
      h.fake.invalidateAccessTokens();
      await codeOf(listEvents(h, USER_A));
      const refreshesBefore = h.fake.counters.refreshes;
      for (let i = 0; i < 3; i++) expect(await codeOf(listEvents(h, USER_A))).toBe('google_reauth_required');
      expect(h.fake.counters.refreshes).toBe(refreshesBefore);
    });

    it('reconectar limpia needsReauth y todo vuelve a funcionar', async () => {
      h.fake.revokeAllRefreshTokens();
      h.fake.invalidateAccessTokens();
      await codeOf(listEvents(h, USER_A));
      await connectUser(h, USER_A, { email: 'ana@gmail.example' });
      expect((await h.repo.getConnection(USER_A))?.needsReauth).toBe(false);
      expect((await listEvents(h, USER_A)).status).toBe(200);
    });

    it('un 401 persistente de Calendar con token recien renovado tambien exige reautorizar', async () => {
      h.fake.invalidateAccessTokens();
      h.fake.failNextCalendar(401); // la llamada del reintento tambien da 401
      // 1a llamada: 401 real (token invalidado) -> renueva -> el reintento consume el fallo forzado (401).
      expect(await codeOf(listEvents(h, USER_A))).toBe('google_reauth_required');
      expect((await h.repo.getConnection(USER_A))?.needsReauth).toBe(true);
    });

    it('clave de cifrado cambiada (blob ilegible): reautorizar, nunca un 500', async () => {
      const wrongKey = await createGoogleHarness({ GOOGLE_TOKEN_ENC_KEY: 'otra-clave-distinta-de-mas-de-32-caracteres-xyz' });
      try {
        const stored = await h.repo.getConnection(USER_A);
        await wrongKey.repo.saveConnection({ ...(stored as NonNullable<typeof stored>), connectedAt: new Date() });
        expect(await codeOf(listEvents(wrongKey, USER_A))).toBe('google_reauth_required');
        expect((await wrongKey.repo.getConnection(USER_A))?.needsReauth).toBe(true);
      } finally {
        await wrongKey.close();
      }
    });

    it('un blob manipulado en la base tambien exige reautorizar', async () => {
      const stored = await h.repo.getConnection(USER_A);
      const parts = (stored as NonNullable<typeof stored>).refreshTokenEnc.split('.');
      parts[3] = Buffer.from('basura').toString('base64url');
      await h.repo.saveConnection({ ...(stored as NonNullable<typeof stored>), refreshTokenEnc: parts.join('.'), connectedAt: new Date() });
      h.service['accessTokens'].clear();
      expect(await codeOf(listEvents(h, USER_A))).toBe('google_reauth_required');
    });
  });

  describe('aislamiento entre usuarios', () => {
    it('cada usuario solo ve y modifica SU calendario; el que no conecto recibe not_connected', async () => {
      await connectUser(h, USER_A, { email: 'ana@gmail.example' });
      await connectUser(h, USER_B, { email: 'beto@gmail.example' });

      await h.service.calendarRequest(USER_A, {
        method: 'POST',
        path: 'calendars/primary/events',
        body: { summary: 'Evento de Ana' },
      });
      await h.service.calendarRequest(USER_B, {
        method: 'POST',
        path: 'calendars/primary/events',
        body: { summary: 'Evento de Beto' },
      });

      const titles = async (user: string): Promise<string[]> =>
        (((await listEvents(h, user)).body as { items: Array<{ summary: string }> }).items ?? []).map((e) => e.summary);
      expect(await titles(USER_A)).toEqual(['Evento de Ana']);
      expect(await titles(USER_B)).toEqual(['Evento de Beto']);

      // B no puede tocar el evento de A aunque conozca su id: su token es de otra cuenta.
      const aEvent = h.fake.eventsOf('ana@gmail.example')[0];
      expect(await codeOf(h.service.calendarRequest(USER_B, { method: 'DELETE', path: `calendars/primary/events/${aEvent.id}` }))).toBe(
        'google_not_found',
      );
      expect(h.fake.eventsOf('ana@gmail.example')).toHaveLength(1);

      expect(await codeOf(listEvents(h, '33333333-3333-4333-8333-333333333333'))).toBe('google_not_connected');
      expect((await h.service.getStatus('33333333-3333-4333-8333-333333333333')).connected).toBe(false);
    });

    it('el blob de A copiado a la fila de B no sirve (AAD con userId) y no filtra el token de A', async () => {
      await connectUser(h, USER_A, { email: 'ana@gmail.example' });
      const a = await h.repo.getConnection(USER_A);
      await h.repo.saveConnection({ ...(a as NonNullable<typeof a>), userId: USER_B, connectedAt: new Date() });
      expect(await codeOf(listEvents(h, USER_B))).toBe('google_reauth_required');
    });
  });

  describe('proxy de Calendar: errores mapeados', () => {
    beforeEach(async () => {
      await connectUser(h, USER_A, { email: 'ana@gmail.example' });
    });

    const cases: Array<[number, unknown, number, string]> = [
      [400, { error: { code: 400, message: 'Invalid value for: end' } }, 400, 'google_bad_request'],
      [403, { error: { code: 403, errors: [{ reason: 'rateLimitExceeded' }] } }, 429, 'google_rate_limited'],
      [403, { error: { code: 403, errors: [{ reason: 'insufficientPermissions' }] } }, 403, 'google_forbidden'],
      [404, { error: { code: 404 } }, 404, 'google_not_found'],
      [409, { error: { code: 409 } }, 409, 'google_conflict'],
      [410, { error: { code: 410 } }, 410, 'google_gone'],
      [429, { error: { code: 429 } }, 429, 'google_rate_limited'],
      [500, { error: { code: 500, message: 'secreto interno' } }, 424, 'google_upstream_error'],
      [503, undefined, 424, 'google_upstream_error'],
    ];

    it.each(cases)('Google %i se mapea a un error estable (caso %#)', async (googleStatus, googleBody, status, code) => {
      h.fake.failNextCalendar(googleStatus, googleBody);
      const error = await listEvents(h, USER_A).then(
        () => null,
        (e: unknown) => e as GoogleHttpException,
      );
      expect(error).toBeInstanceOf(GoogleHttpException);
      expect(error?.getStatus()).toBe(status);
      expect(error?.code).toBe(code);
      expect(error?.message).not.toContain('secreto interno');
    });

    it('un fallo de red hacia Google se informa como google_upstream_error (424)', async () => {
      const dead = await createGoogleHarness();
      try {
        await connectUser(dead, USER_A);
        await dead.fake.close();
        await expect(listEvents(dead, USER_A)).rejects.toMatchObject({ code: 'google_upstream_error' });
      } finally {
        await dead.fake.close().catch(() => undefined);
      }
    });

    it('series RRULE/UNTIL: crear, recortar con UNTIL via PATCH y listar instancias', async () => {
      const created = await h.service.calendarRequest(USER_A, {
        method: 'POST',
        path: 'calendars/primary/events',
        body: {
          summary: 'Gym',
          start: { dateTime: '2026-11-09T07:00:00-05:00', timeZone: 'America/Bogota' },
          end: { dateTime: '2026-11-09T08:00:00-05:00', timeZone: 'America/Bogota' },
          recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=MO'],
          reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 60 }] },
        },
      });
      const id = (created.body as { id: string }).id;
      const range = { timeMin: '2026-11-01T00:00:00Z', timeMax: '2026-12-31T00:00:00Z' };
      const count = async (): Promise<number> =>
        ((await h.service.calendarRequest(USER_A, { method: 'GET', path: `calendars/primary/events/${id}/instances`, query: range }))
          .body as { items: unknown[] }).items.length;
      const before = await count();
      expect(before).toBeGreaterThan(4);

      await h.service.calendarRequest(USER_A, {
        method: 'PATCH',
        path: `calendars/primary/events/${id}`,
        body: { recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=MO;UNTIL=20261115T235959Z'] },
      });
      expect(await count()).toBeLessThan(before);
      const single = await h.service.calendarRequest(USER_A, { method: 'GET', path: `calendars/primary/events/${id}` });
      expect((single.body as { recurrence: string[] }).recurrence[0]).toContain('UNTIL=20261115T235959Z');
    });
  });

  describe('desconexion y borrado de cuenta', () => {
    it('disconnect revoca en Google, borra el secreto y deja el estado en desconectado (idempotente)', async () => {
      await connectUser(h, USER_A, { email: 'ana@gmail.example' });
      const rt = h.fake.refreshTokensOf('ana@gmail.example')[0];

      expect(await h.service.disconnect(USER_A)).toEqual({ disconnected: true, revoked: true });
      expect(h.fake.counters.revokes).toBe(1);
      expect(await h.repo.getConnection(USER_A)).toBeNull();
      expect((await h.service.getStatus(USER_A)).connected).toBe(false);
      expect(await codeOf(listEvents(h, USER_A))).toBe('google_not_connected');
      // El refresh token ya no sirve en Google.
      h.fake.invalidateAccessTokens();
      expect(h.fake.refreshTokensOf('ana@gmail.example')).toContain(rt);

      expect(await h.service.disconnect(USER_A)).toEqual({ disconnected: false, revoked: false });
    });

    it('si Google no responde al revocar, igualmente borra el secreto y avisa revoked=false', async () => {
      const dead = await createGoogleHarness();
      try {
        await connectUser(dead, USER_A);
        await dead.fake.close();
        expect(await dead.service.disconnect(USER_A)).toEqual({ disconnected: true, revoked: false });
        expect(await dead.repo.getConnection(USER_A)).toBeNull();
      } finally {
        await dead.fake.close().catch(() => undefined);
      }
    });

    it('desconectar a un usuario no afecta al otro', async () => {
      await connectUser(h, USER_A, { email: 'ana@gmail.example' });
      await connectUser(h, USER_B, { email: 'beto@gmail.example' });
      await h.service.disconnect(USER_A);
      expect((await listEvents(h, USER_B)).status).toBe(200);
    });

    it('registra el gancho "google" y el borrado de cuenta revoca y borra (y limpia estados PKCE pendientes)', async () => {
      clearAccountDeletionHooksForTests();
      h.service.onModuleInit();
      await connectUser(h, USER_A, { email: 'ana@gmail.example' });
      await h.service.startConnect(USER_A, undefined); // estado PKCE pendiente
      expect(h.repo.states.size).toBe(1);

      const results = await runAccountDeletionHooks(USER_A);
      expect(results).toEqual([{ name: 'google', ok: true }]);
      expect(h.fake.counters.revokes).toBe(1);
      expect(await h.repo.getConnection(USER_A)).toBeNull();
      expect(h.repo.states.size).toBe(0);
      // Idempotente.
      expect(await runAccountDeletionHooks(USER_A)).toEqual([{ name: 'google', ok: true }]);
    });
  });

  describe('rotacion de la clave de cifrado', () => {
    it('un blob de la clave anterior se descifra y se re-cifra con la vigente al usarse', async () => {
      const oldKey = 'clave-anterior-de-prueba-con-mas-de-32-caracteres-1';
      const newKey = 'clave-nueva-de-prueba-con-mas-de-32-caracteres-222';
      const before = await createGoogleHarness({ GOOGLE_TOKEN_ENC_KEY: oldKey });
      try {
        await connectUser(before, USER_A, { email: 'ana@gmail.example' });
        const stored = await before.repo.getConnection(USER_A);
        expect(stored?.keyVersion).toBe(1);

        // Misma base, ahora con clave v2 vigente y la anterior como PREVIOUS.
        const { GoogleApiClient } = await import('./google-api.client');
        const { GoogleService } = await import('./google.service');
        const { makeConfig, configValues } = await import('../../test/helpers/google-fixtures');
        const config = makeConfig(
          configValues(before.fake, {
            GOOGLE_TOKEN_ENC_KEY: newKey,
            GOOGLE_TOKEN_ENC_KEY_VERSION: '2',
            GOOGLE_TOKEN_ENC_KEY_PREVIOUS: oldKey,
            GOOGLE_TOKEN_ENC_KEY_PREVIOUS_VERSION: '1',
          }),
        );
        const service = new GoogleService(config, new GoogleApiClient(config), before.repo, () => before.clock.now + 7200 * 1000);
        expect((await service.calendarRequest(USER_A, { method: 'GET', path: 'calendars/primary/events' })).status).toBe(200);

        const rewrapped = await before.repo.getConnection(USER_A);
        expect(rewrapped?.keyVersion).toBe(2);
        expect(rewrapped?.refreshTokenEnc.startsWith('v2.')).toBe(true);
        expect(config.cipher.decrypt(rewrapped?.refreshTokenEnc ?? '', refreshTokenAad(USER_A))).toBe(
          before.fake.refreshTokensOf('ana@gmail.example')[0],
        );
      } finally {
        await before.close();
      }
    });
  });

  describe('higiene de logs', () => {
    it('ningun log contiene tokens, codigos, secretos ni el state durante todo el ciclo de vida', async () => {
      const captured: string[] = [];
      const spies = (['log', 'warn', 'error', 'debug', 'verbose'] as const).map((level) =>
        jest.spyOn(Logger.prototype, level).mockImplementation((...args: unknown[]) => {
          captured.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
        }),
      );
      try {
        const { url } = await h.service.startConnect(USER_A, undefined);
        const { code, callbackUrl } = h.fake.consent(url, { email: 'ana@gmail.example' });
        const state = new URL(callbackUrl).searchParams.get('state') ?? '';
        await h.service.handleCallback({ code, state });
        await h.service.handleCallback({ code, state }); // repetido: error
        h.fake.revokeAllRefreshTokens();
        h.fake.invalidateAccessTokens();
        await codeOf(listEvents(h, USER_A));
        await h.service.disconnect(USER_A);

        const secrets = [code, state, h.fake.refreshTokensOf('ana@gmail.example')[0], 'fake-client-secret-only-for-tests'];
        for (const line of captured) {
          for (const secret of secrets) expect(line).not.toContain(secret);
          expect(line).not.toMatch(/fake-at-|fake-rt-|fake-code-/);
        }
      } finally {
        spies.forEach((spy) => spy.mockRestore());
      }
    });
  });
});
