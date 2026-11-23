// Supabase FALSO para el E2E (puerto 54341). Solo lo minimo que necesitan la API (JWKS) y @supabase/supabase-js
// (sesion en localStorage + refresh + PKCE + logout). Todas las claves se generan al arrancar: no hay secretos.
//
//   /auth/v1/.well-known/jwks.json          claves publicas ES256 (la API real las descarga con `jose`)
//   /auth/v1/user                           usuario del Bearer (supabase-js lo usa en getUser())
//   /auth/v1/token?grant_type=refresh_token renueva la sesion (refresh_token = "rt.<usuario>.<n>")
//   /auth/v1/token?grant_type=pkce          canje del codigo de signInWithOAuth
//   /auth/v1/authorize                      "pantalla de Google" de Supabase: redirige al instante con ?code=
//   /auth/v1/logout                         204
import { createHash, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { exportJWK, generateKeyPair, jwtVerify, SignJWT } from 'jose';

/** UUID determinista (con forma de v4) a partir de un nombre: el mismo `key` da siempre el mismo usuario. */
export function uuidForUser(key) {
  const hex = createHash('sha1').update(`student-os-e2e:${key}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export async function startFakeSupabase({ port, host = '::' }) {
  const { publicKey, privateKey } = await generateKeyPair('ES256', { extractable: true });
  const kid = 'e2e-key-1';
  const publicJwk = { ...(await exportJWK(publicKey)), kid, alg: 'ES256', use: 'sig' };
  const origin = `http://localhost:${port}`;
  const issuer = `${origin}/auth/v1`;

  const state = {
    refreshCount: 0,
    userCalls: 0,
    /** Con `true`, toda renovacion falla (sesion revocada en el servidor). */
    failRefresh: false,
    /** Usuario con el que "inicia sesion" el boton de Google (pantalla fake de /authorize). */
    loginUserKey: 'login-user',
  };
  const authCodes = new Map();
  const refreshSerial = new Map();

  const userObject = (userKey) => ({
    id: uuidForUser(userKey),
    aud: 'authenticated',
    role: 'authenticated',
    email: `${userKey}@e2e.test`,
    email_confirmed_at: '2026-01-01T00:00:00.000Z',
    phone: '',
    app_metadata: { provider: 'google', providers: ['google'] },
    user_metadata: { full_name: `Usuario ${userKey}`, name: `Usuario ${userKey}`, email: `${userKey}@e2e.test` },
    identities: [],
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    last_sign_in_at: new Date().toISOString(),
  });

  async function buildSession(userKey, { expiresIn = 3600 } = {}) {
    const user = userObject(userKey);
    const now = Math.floor(Date.now() / 1000);
    const accessToken = await new SignJWT({
      email: user.email,
      role: 'authenticated',
      user_metadata: user.user_metadata,
      app_metadata: user.app_metadata,
    })
      .setProtectedHeader({ alg: 'ES256', kid })
      .setSubject(user.id)
      .setAudience('authenticated')
      .setIssuer(issuer)
      .setIssuedAt(now)
      .setExpirationTime(now + expiresIn)
      .sign(privateKey);
    const serial = (refreshSerial.get(userKey) ?? 0) + 1;
    refreshSerial.set(userKey, serial);
    return {
      access_token: accessToken,
      token_type: 'bearer',
      expires_in: expiresIn,
      expires_at: now + expiresIn,
      refresh_token: `rt.${userKey}.${serial}`,
      user,
    };
  }

  const readBody = (req) =>
    new Promise((resolve, reject) => {
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      req.on('error', reject);
    });

  const json = (res, status, body) => {
    res.statusCode = status;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(body));
  };

  const server = createServer(async (req, res) => {
    // CORS abierto: la fake solo escucha en localhost y no guarda nada real.
    res.setHeader('access-control-allow-origin', req.headers.origin ?? '*');
    res.setHeader('access-control-allow-methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('access-control-allow-headers', req.headers['access-control-request-headers'] ?? '*');
    res.setHeader('access-control-expose-headers', '*');
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }
    try {
      const url = new URL(req.url ?? '/', origin);
      const path = url.pathname;

      if (path === '/auth/v1/.well-known/jwks.json') return json(res, 200, { keys: [publicJwk] });

      if (path === '/auth/v1/user') {
        state.userCalls++;
        const token = (req.headers.authorization ?? '').replace(/^Bearer /i, '');
        try {
          const { payload } = await jwtVerify(token, publicKey, { issuer, audience: 'authenticated' });
          const email = String(payload.email ?? '');
          return json(res, 200, userObject(email.replace(/@e2e\.test$/, '')));
        } catch {
          return json(res, 401, { code: 401, error_code: 'bad_jwt', msg: 'invalid JWT' });
        }
      }

      if (path === '/auth/v1/token') {
        const grant = url.searchParams.get('grant_type');
        const body = JSON.parse((await readBody(req)) || '{}');
        if (grant === 'refresh_token') {
          state.refreshCount++;
          const match = /^rt\.(.+)\.(\d+)$/.exec(body.refresh_token ?? '');
          if (!match || state.failRefresh) {
            return json(res, 400, { error: 'invalid_grant', error_description: 'Invalid Refresh Token: Refresh Token Not Found' });
          }
          return json(res, 200, await buildSession(match[1]));
        }
        if (grant === 'pkce') {
          const entry = authCodes.get(body.auth_code);
          authCodes.delete(body.auth_code);
          if (!entry) return json(res, 400, { error: 'invalid_grant', error_description: 'unknown auth code' });
          const challenge = createHash('sha256').update(String(body.code_verifier ?? '')).digest('base64url');
          if (challenge !== entry.challenge) return json(res, 400, { error: 'invalid_grant', error_description: 'code_verifier mismatch' });
          return json(res, 200, await buildSession(entry.userKey));
        }
        return json(res, 400, { error: 'unsupported_grant_type' });
      }

      if (path === '/auth/v1/authorize') {
        const redirectTo = url.searchParams.get('redirect_to');
        const challenge = url.searchParams.get('code_challenge');
        if (!redirectTo || !challenge) return json(res, 400, { error: 'missing redirect_to / code_challenge' });
        const code = randomBytes(12).toString('hex');
        authCodes.set(code, { userKey: state.loginUserKey, challenge });
        const target = new URL(redirectTo);
        target.searchParams.set('code', code);
        res.statusCode = 302;
        res.setHeader('location', target.toString());
        res.end();
        return undefined;
      }

      if (path === '/auth/v1/logout') {
        res.statusCode = 204;
        res.end();
        return undefined;
      }

      return json(res, 404, { error: `ruta no soportada por el Supabase falso: ${path}` });
    } catch (error) {
      return json(res, 500, { error: error instanceof Error ? error.message : 'error' });
    }
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, resolve);
  });

  return {
    origin,
    issuer,
    state,
    buildSession,
    close: () =>
      new Promise((resolve) => {
        server.close(() => resolve());
        server.closeAllConnections();
      }),
  };
}
