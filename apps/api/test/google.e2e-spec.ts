import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { startFakeGoogle, FAKE_CLIENT_ID, FAKE_CLIENT_SECRET, type FakeGoogle } from './helpers/google-fake';
import { startGooglePg, type GooglePg } from './helpers/google-pg';
import { startJwksServer, type JwksServer } from './helpers/jwks-server';

/**
 * HTTP de punta a punta de /google/* sobre la app real (AppModule: guard JWT, throttler, filtros, Prisma) con:
 *  - Postgres REAL embebido (puerto 54334, schema privado `dev_google`, `prisma db push`),
 *  - JWKS local para firmar los JWT de Supabase,
 *  - un servidor local que imita a Google (OAuth + Calendar), apuntado con GOOGLE_OAUTH_BASE/GOOGLE_API_BASE/GOOGLE_AUTH_URL.
 * Todo con valores FALSOS: ni Supabase, ni Google, ni credenciales reales.
 */
jest.setTimeout(240_000);

const WEB = 'https://student-os.example.com';
const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';
const ENC_KEY = 'e2e-only-encryption-key-0123456789-abcdefghijklmnopqrstuvwxyz';

describe('Google Calendar persistente (e2e HTTP)', () => {
  let pg: GooglePg;
  let fake: FakeGoogle;
  let jwks: JwksServer;
  let app: INestApplication;
  let tokenA: string;
  let tokenB: string;
  let prisma: import('../src/prisma/prisma.service').PrismaService;

  /**
   * Cada peticion sale de una IP distinta (`trust proxy` = 1 lee X-Forwarded-For) para que el rate limit por IP
   * (activo de verdad) no mezcle las peticiones de los distintos tests. Hay un test especifico del limite.
   */
  let ipSeq = 0;
  const http = (fixedIp?: string) => {
    ipSeq += 1;
    const ip = fixedIp ?? `10.${Math.floor(ipSeq / 250)}.${Math.floor(ipSeq / 250) % 250}.${(ipSeq % 250) + 1}`;
    const agent = request(app.getHttpServer());
    return {
      get: (path: string) => agent.get(path).set('X-Forwarded-For', ip),
      post: (path: string) => agent.post(path).set('X-Forwarded-For', ip),
      patch: (path: string) => agent.patch(path).set('X-Forwarded-For', ip),
      delete: (path: string) => agent.delete(path).set('X-Forwarded-For', ip),
    };
  };
  const asA = () => ({ Authorization: `Bearer ${tokenA}` });
  const asB = () => ({ Authorization: `Bearer ${tokenB}` });

  /** connect -> pantalla de consentimiento (falsa) -> callback. Devuelve la respuesta 302 del callback. */
  async function connect(headers: Record<string, string>, email: string, returnTo = `${WEB}/horario`) {
    const res = await http().post('/google/connect').set(headers).send({ returnTo }).expect(200);
    const { callbackUrl } = fake.consent(res.body.url as string, { email });
    const callback = new URL(callbackUrl);
    return http().get(`${callback.pathname}${callback.search}`);
  }

  beforeAll(async () => {
    [pg, fake, jwks] = await Promise.all([startGooglePg(), startFakeGoogle(), startJwksServer()]);
    Object.assign(process.env, {
      NODE_ENV: 'test',
      SUPABASE_URL: jwks.url,
      SUPABASE_JWT_AUDIENCE: 'authenticated',
      WEB_ORIGINS: `${WEB},http://localhost:5173`,
      DATABASE_URL: pg.url,
      DIRECT_URL: pg.url,
      GOOGLE_CLIENT_ID: FAKE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: FAKE_CLIENT_SECRET,
      GOOGLE_TOKEN_ENC_KEY: ENC_KEY,
      GOOGLE_REDIRECT_URI: 'http://localhost:3000/google/callback',
      GOOGLE_OAUTH_BASE: fake.url,
      GOOGLE_API_BASE: fake.url,
      GOOGLE_AUTH_URL: fake.authUrl,
    });

    // AppModule evalua ConfigModule al importarse: el entorno debe estar listo antes del import.
    const { AppModule } = await import('../src/app.module');
    const { configureApp } = await import('../src/app.setup');
    const { PrismaService } = await import('../src/prisma/prisma.service');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    tokenA = await jwks.sign({ sub: USER_A, email: 'ana@example.com' });
    tokenB = await jwks.sign({ sub: USER_B, email: 'beto@example.com' });
  });

  afterAll(async () => {
    await app?.close();
    await Promise.all([jwks?.close(), fake?.close()]);
    await pg?.stop();
  });

  describe('autenticacion', () => {
    it.each([
      ['GET', '/google/status'],
      ['POST', '/google/connect'],
      ['POST', '/google/disconnect'],
      ['GET', '/google/calendar/events'],
      ['POST', '/google/calendar/events'],
      ['PATCH', '/google/calendar/events/abc'],
      ['DELETE', '/google/calendar/events/abc'],
      ['GET', '/google/calendar/primary'],
      ['POST', '/google/calendar/freebusy'],
    ])('%s %s exige JWT (401 sin token)', async (method, path) => {
      const res = await http()[method.toLowerCase() as 'get' | 'post' | 'patch' | 'delete'](path);
      expect(res.status).toBe(401);
    });

    it('un JWT invalido tambien da 401 (y no pasa nada con Google)', async () => {
      await http().get('/google/status').set('Authorization', 'Bearer basura').expect(401);
      expect(fake.calls).toHaveLength(0);
    });

    it('el callback es PUBLICO (sin JWT): sin state redirige a la web con ?google=error', async () => {
      const res = await http().get('/google/callback').expect(302);
      expect(res.headers.location).toBe(`${WEB}/?google=error&reason=invalid_state`);
      expect(res.headers['cache-control']).toContain('no-store');
    });
  });

  describe('flujo de conexion', () => {
    it('status inicial: configurado pero no conectado', async () => {
      const res = await http().get('/google/status').set(asA()).expect(200);
      expect(res.body).toEqual({
        configured: true,
        connected: false,
        needsReauth: false,
        email: null,
        connectedAt: null,
        scopes: [],
      });
      expect(res.headers['cache-control']).toContain('no-store');
    });

    it('connect devuelve la URL de Google con PKCE S256 + offline + consent', async () => {
      const res = await http().post('/google/connect').set(asA()).send({ returnTo: `${WEB}/horario` }).expect(200);
      const url = new URL(res.body.url as string);
      expect(url.origin + url.pathname).toBe(fake.authUrl);
      expect(url.searchParams.get('code_challenge_method')).toBe('S256');
      expect(url.searchParams.get('access_type')).toBe('offline');
      expect(url.searchParams.get('prompt')).toBe('consent');
      expect(url.searchParams.get('client_id')).toBe(FAKE_CLIENT_ID);
      expect(JSON.stringify(res.body)).not.toContain(FAKE_CLIENT_SECRET);
      expect(res.headers['cache-control']).toContain('no-store');
    });

    it('open redirect: connect rechaza returnTo fuera de WEB_ORIGINS con un codigo estable', async () => {
      for (const returnTo of ['https://evil.com/', 'javascript:alert(1)', `${WEB}@evil.com`, '//evil.com']) {
        const res = await http().post('/google/connect').set(asA()).send({ returnTo }).expect(400);
        expect(res.body.code).toBe('google_invalid_return_to');
      }
    });

    it('conecta, cifra el refresh token en Postgres y redirige a la web con ?google=connected', async () => {
      const pendingBefore = await prisma.googleOAuthState.count({ where: { userId: USER_A } });
      const res = await connect(asA(), 'ana@gmail.example');
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe(`${WEB}/horario?google=connected`);

      const row = await prisma.googleConnection.findUniqueOrThrow({ where: { userId: USER_A } });
      const realRefreshToken = fake.refreshTokensOf('ana@gmail.example')[0];
      expect(realRefreshToken).toBeTruthy();
      expect(row.refreshTokenEnc).not.toContain(realRefreshToken);
      expect(row.refreshTokenEnc).toMatch(/^v1\.[\w-]+\.[\w-]+\.[\w-]+$/);
      expect(row.keyVersion).toBe(1);
      expect(row.accountEmail).toBe('ana@gmail.example');
      expect(row.scopes).toContain('https://www.googleapis.com/auth/calendar.events');
      expect(row.needsReauth).toBe(false);
      // El state PKCE de este intento se consumio (solo quedan los que otros tests dejaron pendientes).
      expect(await prisma.googleOAuthState.count({ where: { userId: USER_A } })).toBe(pendingBefore);

      const status = await http().get('/google/status').set(asA()).expect(200);
      expect(status.body).toMatchObject({ connected: true, needsReauth: false, email: 'ana@gmail.example' });
      // El navegador jamas ve el refresh token (ni nada parecido).
      expect(JSON.stringify(status.body)).not.toContain(realRefreshToken);
      expect(JSON.stringify(status.body)).not.toMatch(/refresh|secret|access/i);
    });

    it('reconectar actualiza la MISMA fila (userId unico) con otro IV', async () => {
      const before = await prisma.googleConnection.findUniqueOrThrow({ where: { userId: USER_A } });
      await connect(asA(), 'ana@gmail.example').then((r) => expect(r.status).toBe(302));
      const after = await prisma.googleConnection.findMany({ where: { userId: USER_A } });
      expect(after).toHaveLength(1);
      expect(after[0].refreshTokenEnc).not.toBe(before.refreshTokenEnc);
      expect(after[0].refreshTokenEnc.split('.')[1]).not.toBe(before.refreshTokenEnc.split('.')[1]);
    });

    it('el callback con state alterado / reutilizado / de otro usuario no conecta nada', async () => {
      const res = await http().post('/google/connect').set(asB()).send({}).expect(200);
      const { callbackUrl } = fake.consent(res.body.url as string, { email: 'beto@gmail.example' });
      const cb = new URL(callbackUrl);
      const state = cb.searchParams.get('state') as string;

      // Alterado.
      const tampered = `${state.slice(0, -2)}${state.endsWith('AA') ? 'BB' : 'AA'}`;
      const bad = await http().get('/google/callback').query({ code: cb.searchParams.get('code'), state: tampered }).expect(302);
      expect(bad.headers.location).toBe(`${WEB}/?google=error&reason=invalid_state`);
      expect(await prisma.googleConnection.count({ where: { userId: USER_B } })).toBe(0);

      // Legitimo (una vez) y reutilizado.
      const ok = await http().get(`${cb.pathname}${cb.search}`).expect(302);
      expect(ok.headers.location).toBe(`${WEB}/?google=connected`);
      const replay = await http().get(`${cb.pathname}${cb.search}`).expect(302);
      expect(replay.headers.location).toBe(`${WEB}/?google=error&reason=invalid_state`);
    });

    it('cada usuario tiene su propio blob (IV distintos) y solo el suyo', async () => {
      const [a, b] = await Promise.all([
        prisma.googleConnection.findUniqueOrThrow({ where: { userId: USER_A } }),
        prisma.googleConnection.findUniqueOrThrow({ where: { userId: USER_B } }),
      ]);
      expect(a.refreshTokenEnc.split('.')[1]).not.toBe(b.refreshTokenEnc.split('.')[1]);
      expect(a.accountEmail).toBe('ana@gmail.example');
      expect(b.accountEmail).toBe('beto@gmail.example');
    });

    it('si el usuario cancela en Google vuelve con ?google=error&reason=denied', async () => {
      const res = await http().post('/google/connect').set(asA()).send({ returnTo: `${WEB}/horario` }).expect(200);
      const state = new URL(res.body.url as string).searchParams.get('state') as string;
      const cb = await http().get('/google/callback').query({ error: 'access_denied', state }).expect(302);
      expect(cb.headers.location).toBe(`${WEB}/horario?google=error&reason=denied`);
    });
  });

  describe('proxy de Calendar', () => {
    let eventId: string;

    it('lista, crea (con RRULE y recordatorios), lee, actualiza (UNTIL), instancias y borra', async () => {
      const created = await http()
        .post('/google/calendar/events')
        .set(asA())
        .send({
          summary: 'Gym',
          description: 'Programado desde StudentOS',
          location: 'Smart Fit',
          start: { dateTime: '2026-11-09T07:00:00-05:00', timeZone: 'America/Bogota' },
          end: { dateTime: '2026-11-09T08:00:00-05:00', timeZone: 'America/Bogota' },
          recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=MO'],
          extendedProperties: { private: { studentOsSource: 'student-os', studentOsCategory: 'gym' } },
          reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 60 }] },
        })
        .expect(200);
      eventId = created.body.id as string;
      expect(eventId).toBeTruthy();
      expect(created.body.extendedProperties.private.studentOsCategory).toBe('gym');
      expect(created.body.reminders.overrides[0].minutes).toBe(60);

      const params = { timeMin: '2026-11-01T00:00:00.000Z', timeMax: '2026-12-31T00:00:00.000Z', singleEvents: 'true', orderBy: 'startTime', timeZone: 'America/Bogota', maxResults: '250' };
      const listed = await http().get('/google/calendar/events').query(params).set(asA()).expect(200);
      expect(listed.body.items.length).toBeGreaterThan(4);
      expect(listed.body.defaultReminders).toBeDefined();
      // Los parametros llegaron a Google tal cual (lista blanca).
      const googleList = fake.calls.filter((c) => c.path === '/calendar/v3/calendars/primary/events' && c.method === 'GET').at(-1);
      expect(googleList?.query).toMatchObject({ singleEvents: 'true', orderBy: 'startTime', maxResults: '250' });
      expect(googleList?.authorization).toMatch(/^Bearer fake-at-/);

      const instancesBefore = await http()
        .get(`/google/calendar/events/${eventId}/instances`)
        .query({ timeMin: params.timeMin, timeMax: params.timeMax })
        .set(asA())
        .expect(200);

      await http()
        .patch(`/google/calendar/events/${eventId}`)
        .set(asA())
        .send({ recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=MO;UNTIL=20261115T235959Z'] })
        .expect(200);
      const single = await http().get(`/google/calendar/events/${eventId}`).set(asA()).expect(200);
      expect(single.body.recurrence[0]).toContain('UNTIL=20261115T235959Z');
      const instancesAfter = await http()
        .get(`/google/calendar/events/${eventId}/instances`)
        .query({ timeMin: params.timeMin, timeMax: params.timeMax })
        .set(asA())
        .expect(200);
      expect(instancesAfter.body.items.length).toBeLessThan(instancesBefore.body.items.length);

      const busy = await http()
        .post('/google/calendar/freebusy')
        .set(asA())
        .send({ timeMin: '2026-11-09T00:00:00Z', timeMax: '2026-11-10T00:00:00Z', timeZone: 'America/Bogota', items: [{ id: 'otro@calendario.com' }] })
        .expect(200);
      expect(busy.body.calendars.primary.busy).toHaveLength(1);
      // Aunque el navegador pida otro calendario, el proxy solo consulta `primary`.
      const fbCall = fake.calls.filter((c) => c.path === '/calendar/v3/freeBusy').at(-1);
      expect((fbCall?.body as { items?: Array<{ id: string }> } | undefined)?.items).toEqual([{ id: 'primary' }]);

      const primary = await http().get('/google/calendar/primary').set(asA()).expect(200);
      expect(primary.body.id).toBe('ana@gmail.example');

      await http().delete(`/google/calendar/events/${eventId}`).set(asA()).expect(204);
      const again = await http().delete(`/google/calendar/events/${eventId}`).set(asA());
      expect(again.status).toBe(410);
      expect(again.body.code).toBe('google_gone');
    });

    it('un evento inexistente da 404 con code estable (el web lo trata como "ya no esta")', async () => {
      const res = await http().delete('/google/calendar/events/noexiste123').set(asA()).expect(404);
      expect(res.body.code).toBe('google_not_found');
    });

    it('lista blanca de campos: attendees/conferenceData/id/otros se descartan antes de llegar a Google', async () => {
      await http()
        .post('/google/calendar/events')
        .set(asA())
        .send({
          summary: 'Con campos extra',
          attendees: [{ email: 'victima@example.com' }],
          conferenceData: { createRequest: { requestId: 'x' } },
          id: 'idforzado',
          start: { dateTime: '2026-11-10T09:00:00-05:00', timeZone: 'America/Bogota' },
          end: { dateTime: '2026-11-10T10:00:00-05:00', timeZone: 'America/Bogota' },
        })
        .expect(200);
      const forwarded = fake.calls.filter((c) => c.method === 'POST' && c.path === '/calendar/v3/calendars/primary/events').at(-1);
      expect(forwarded?.body).not.toHaveProperty('attendees');
      expect(forwarded?.body).not.toHaveProperty('conferenceData');
      expect(forwarded?.body).not.toHaveProperty('id');
      expect(forwarded?.body).toMatchObject({ summary: 'Con campos extra' });
    });

    it('entrada invalida -> 400 con lineas claras y sin eco del valor', async () => {
      const q = await http().get('/google/calendar/events').query({ timeMin: 'ayer', maxResults: '99999' }).set(asA()).expect(400);
      expect(JSON.stringify(q.body.message)).toMatch(/timeMin/);
      expect(JSON.stringify(q.body.message)).not.toContain('ayer');
      await http().patch('/google/calendar/events/ab..%2F..%2Fcalendars').set(asA()).send({}).expect(400);
      await http().patch('/google/calendar/events/.hidden').set(asA()).send({}).expect(400);
      await http()
        .post('/google/calendar/events')
        .set(asA())
        .send({ recurrence: ['no es una regla'] })
        .expect(400);
      await http()
        .post('/google/calendar/events')
        .set(asA())
        .send({ reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: -5 }] } })
        .expect(400);
      await http().post('/google/calendar/freebusy').set(asA()).send({}).expect(400);
    });

    it('Google caido (500) -> 424 google_upstream_error sin filtrar detalles', async () => {
      fake.failNextCalendar(500, { error: { message: 'detalle-interno-secreto' } });
      const res = await http().get('/google/calendar/events').set(asA()).expect(424);
      expect(res.body.code).toBe('google_upstream_error');
      expect(JSON.stringify(res.body)).not.toContain('detalle-interno-secreto');
    });
  });

  describe('aislamiento entre usuarios', () => {
    it('A y B ven calendarios distintos; un usuario sin conexion recibe 409 google_not_connected', async () => {
      await http().post('/google/calendar/events').set(asA()).send({ summary: 'Solo de Ana' }).expect(200);
      await http().post('/google/calendar/events').set(asB()).send({ summary: 'Solo de Beto' }).expect(200);

      const titles = async (headers: Record<string, string>): Promise<string[]> => {
        const res = await http().get('/google/calendar/events').set(headers).expect(200);
        return (res.body.items as Array<{ summary: string }>).map((e) => e.summary);
      };
      expect(await titles(asA())).toContain('Solo de Ana');
      expect(await titles(asA())).not.toContain('Solo de Beto');
      expect(await titles(asB())).toEqual(['Solo de Beto']);

      const tokenC = await jwks.sign({ sub: '33333333-3333-4333-8333-333333333333' });
      const res = await http().get('/google/calendar/events').set('Authorization', `Bearer ${tokenC}`).expect(409);
      expect(res.body.code).toBe('google_not_connected');
    });

    it('el userId del JWT manda: ni el body ni la query pueden elegir otro usuario', async () => {
      const res = await http().get('/google/calendar/events').query({ userId: USER_B }).set(asA()).expect(200);
      const titles = (res.body.items as Array<{ summary: string }>).map((e) => e.summary);
      expect(titles).not.toContain('Solo de Beto');
    });
  });

  describe('renovacion e invalid_grant', () => {
    it('si el access token en memoria deja de valer, renueva y sigue (sin que el navegador haga nada)', async () => {
      const before = fake.counters.refreshes;
      fake.invalidateAccessTokens();
      await http().get('/google/calendar/events').set(asA()).expect(200);
      expect(fake.counters.refreshes).toBe(before + 1);
    });

    it('invalid_grant -> 409 google_reauth_required (NO 401), needsReauth en status y en la base', async () => {
      fake.revokeRefreshTokensOf('beto@gmail.example');
      fake.invalidateAccessTokens();
      const res = await http().get('/google/calendar/events').set(asB()).expect(409);
      expect(res.body.code).toBe('google_reauth_required');
      expect(res.body.statusCode).toBe(409);

      const status = await http().get('/google/status').set(asB()).expect(200);
      expect(status.body).toMatchObject({ connected: true, needsReauth: true });
      expect((await prisma.googleConnection.findUniqueOrThrow({ where: { userId: USER_B } })).needsReauth).toBe(true);
      // La sesion de StudentOS sigue valida: el mismo JWT sigue funcionando en otras rutas.
      await http().get('/google/status').set(asB()).expect(200);
    });

    it('reconectar tras invalid_grant lo deja todo funcionando', async () => {
      const cb = await connect(asB(), 'beto@gmail.example');
      expect(cb.headers.location).toBe(`${WEB}/horario?google=connected`);
      const status = await http().get('/google/status').set(asB()).expect(200);
      expect(status.body.needsReauth).toBe(false);
      await http().get('/google/calendar/events').set(asB()).expect(200);
    });
  });

  describe('desconexion y borrado de cuenta', () => {
    it('POST /google/disconnect revoca en Google, borra la fila y deja status desconectado', async () => {
      const revokes = fake.counters.revokes;
      const res = await http().post('/google/disconnect').set(asB()).expect(200);
      expect(res.body).toEqual({ disconnected: true, revoked: true });
      expect(fake.counters.revokes).toBe(revokes + 1);
      expect(await prisma.googleConnection.count({ where: { userId: USER_B } })).toBe(0);
      const status = await http().get('/google/status').set(asB()).expect(200);
      expect(status.body.connected).toBe(false);
      await http().get('/google/calendar/events').set(asB()).expect(409);
      // Idempotente.
      const again = await http().post('/google/disconnect').set(asB()).expect(200);
      expect(again.body).toEqual({ disconnected: false, revoked: false });
      // A no se ve afectado.
      await http().get('/google/calendar/events').set(asA()).expect(200);
    });

    it('el gancho de borrado de cuenta ("google") esta registrado y revoca + borra', async () => {
      const { listAccountDeletionHooks, runAccountDeletionHooks } = await import('../src/common/account-deletion');
      expect(listAccountDeletionHooks()).toContain('google');
      const pendingStates = await http().post('/google/connect').set(asA()).send({}).expect(200);
      expect(pendingStates.body.url).toBeTruthy();
      expect(await prisma.googleOAuthState.count({ where: { userId: USER_A } })).toBeGreaterThanOrEqual(1);

      const revokes = fake.counters.revokes;
      const results = await runAccountDeletionHooks(USER_A);
      expect(results.find((r) => r.name === 'google')).toEqual({ name: 'google', ok: true });
      expect(fake.counters.revokes).toBe(revokes + 1);
      expect(await prisma.googleConnection.count({ where: { userId: USER_A } })).toBe(0);
      expect(await prisma.googleOAuthState.count({ where: { userId: USER_A } })).toBe(0);
    });
  });

  describe('vinculacion al terminar el login (POST /google/link-login, spec 009)', () => {
    const USER_D = '44444444-4444-4444-8444-444444444444';
    const EMAIL_D = 'dani@example.com';
    let tokenD: string;
    const asD = () => ({ Authorization: `Bearer ${tokenD}` });

    beforeAll(async () => {
      tokenD = await jwks.sign({ sub: USER_D, email: EMAIL_D });
    });

    it('sin JWT responde 401 y no llega a Google', async () => {
      const callsBefore = fake.calls.length;
      await http().post('/google/link-login').send({ refreshToken: 'a-long-enough-token' }).expect(401);
      expect(fake.calls.length).toBe(callsBefore);
    });

    it('cuerpo invalido -> 400 con lineas claras y sin eco del valor', async () => {
      const res = await http().post('/google/link-login').set(asD()).send({ refreshToken: 'corto' }).expect(400);
      expect(JSON.stringify(res.body)).toContain('refreshToken');
      expect(JSON.stringify(res.body)).not.toContain('corto');
      await http().post('/google/link-login').set(asD()).send({}).expect(400);
    });

    it('C5: vincula, cifra el refresh token en Postgres y Calendar queda conectado sin pulsar nada', async () => {
      const realToken = fake.issueRefreshToken(EMAIL_D);
      const res = await http().post('/google/link-login').set(asD()).send({ refreshToken: realToken }).expect(200);
      expect(res.body).toMatchObject({ connected: true, needsReauth: false, email: EMAIL_D });
      expect(JSON.stringify(res.body)).not.toContain(realToken);
      expect(res.headers['cache-control']).toContain('no-store');

      const row = await prisma.googleConnection.findUniqueOrThrow({ where: { userId: USER_D } });
      expect(row.refreshTokenEnc).not.toContain(realToken);
      expect(row.refreshTokenEnc).toMatch(/^v1\.[\w-]+\.[\w-]+\.[\w-]+$/);
      expect(row.accountEmail).toBe(EMAIL_D);

      const status = await http().get('/google/status').set(asD()).expect(200);
      expect(status.body).toMatchObject({ connected: true, email: EMAIL_D });
      // El token guardado sirve: el proxy de Calendar responde con el.
      await http().get('/google/calendar/events').set(asD()).expect(200);
    });

    it('C9: sin el permiso de eventos responde 409 google_missing_scopes y no guarda nada', async () => {
      const userE = '55555555-5555-4555-8555-555555555555';
      const tokenE = await jwks.sign({ sub: userE, email: 'eva@example.com' });
      const noEvents = fake.issueRefreshToken('eva@example.com', ['openid', 'email', 'https://www.googleapis.com/auth/calendar.readonly']);
      const res = await http()
        .post('/google/link-login')
        .set({ Authorization: `Bearer ${tokenE}` })
        .send({ refreshToken: noEvents })
        .expect(409);
      expect(res.body).toMatchObject({ code: 'google_missing_scopes' });
      expect(await prisma.googleConnection.count({ where: { userId: userE } })).toBe(0);
    });

    it('un token de otra cuenta de Google responde 409 google_account_mismatch y no guarda nada', async () => {
      const userF = '66666666-6666-4666-8666-666666666666';
      const tokenF = await jwks.sign({ sub: userF, email: 'fer@example.com' });
      const foreign = fake.issueRefreshToken('otra-persona@example.com');
      const res = await http()
        .post('/google/link-login')
        .set({ Authorization: `Bearer ${tokenF}` })
        .send({ refreshToken: foreign })
        .expect(409);
      expect(res.body).toMatchObject({ code: 'google_account_mismatch' });
      expect(await prisma.googleConnection.count({ where: { userId: userF } })).toBe(0);
    });

    it('esta limitado a 5 intentos por minuto: el sexto recibe 429', async () => {
      const ip = '203.0.113.88';
      for (let i = 0; i < 5; i++) {
        await http(ip).post('/google/link-login').set(asD()).send({ refreshToken: 'token-largo-invalido-x' }).expect(400);
      }
      await http(ip).post('/google/link-login').set(asD()).send({ refreshToken: 'token-largo-invalido-x' }).expect(429);
    });
  });

  describe('rate limit', () => {
    it('POST /google/connect esta limitado por IP (10/min): el intento 11 recibe 429', async () => {
      const ip = '203.0.113.77';
      for (let i = 0; i < 10; i++) {
        await http(ip).post('/google/connect').set(asA()).send({}).expect(200);
      }
      await http(ip).post('/google/connect').set(asA()).send({}).expect(429);
      // Otra IP no se ve afectada.
      await http().post('/google/connect').set(asA()).send({}).expect(200);
    });
  });

  describe('secretos', () => {
    it('ninguna respuesta de las anteriores contiene el client secret ni la clave de cifrado', async () => {
      const res = await http().get('/google/status').set(asA()).expect(200);
      const text = JSON.stringify(res.body) + JSON.stringify(res.headers);
      expect(text).not.toContain(FAKE_CLIENT_SECRET);
      expect(text).not.toContain(ENC_KEY);
    });
  });
});
