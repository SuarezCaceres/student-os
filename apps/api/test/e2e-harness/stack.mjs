// Arnes E2E de StudentOS: levanta el stack REAL en esta maquina, sin servicios externos ni secretos reales.
//
//   Postgres embebido  54340  (schema privado dev_e2e, `prisma db push`; nunca migraciones ni Supabase)
//   Supabase FALSO     54341  (JWKS + sesion + refresh + PKCE + logout)
//   Google FALSO       54342  (OAuth con consentimiento automatico + Calendar v3)
//   Control del arnes  54343  (HTTP: /ready, /shutdown, /session, ... solo para las pruebas)
//   API Nest REAL       3100  (apps/api/dist/main.js)
//   Web Vite REAL       5293  (con VITE_SUPABASE_* y VITE_API_URL)  +  5294 (SIN variables: modo sin nube)
//
// Uso:  node apps/api/test/e2e-harness/stack.mjs [--skip-build] [--clean]
//   --clean       mata lo que escuche en SUS puertos (nunca otros: 5173/5174 no se tocan) y sale.
//   --skip-build  no recompila shared/api (usa dist existente).
// Se apaga con Ctrl+C, con SIGTERM o con `POST http://127.0.0.1:54343/shutdown`.
import { execFileSync, spawn } from 'node:child_process';
import { createWriteStream, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { startFakeGoogle, FAKE_CLIENT_ID, FAKE_CLIENT_SECRET } from './fake-google.mjs';
import { startFakeSupabase, uuidForUser } from './fake-supabase.mjs';
import { API_ROOT, DATABASE_URL, PG_DATABASE, PG_PASSWORD, PORTS, REPO_ROOT, RUN_DIR, WEB_ROOT } from './config.mjs';

const args = new Set(process.argv.slice(2));
const log = (...parts) => process.stdout.write(`[stack] ${parts.join(' ')}\n`);
const require = createRequire(join(API_ROOT, 'package.json'));
const requireWeb = createRequire(join(WEB_ROOT, 'package.json'));

function killTree(pid) {
  if (!pid) return;
  try {
    if (process.platform === 'win32') execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
    else process.kill(pid, 'SIGKILL');
  } catch {
    // ya no existe
  }
}

/** PIDs que escuchan en un puerto (solo para --clean y para comprobar que los puertos estan libres). */
function pidsListeningOn(port) {
  try {
    if (process.platform === 'win32') {
      const out = execFileSync('netstat', ['-ano', '-p', 'TCP'], { encoding: 'utf8' });
      const pids = new Set();
      for (const line of out.split(/\r?\n/)) {
        if (!/LISTENING/.test(line)) continue;
        const cols = line.trim().split(/\s+/);
        if (cols[1]?.endsWith(`:${port}`)) pids.add(Number(cols[4]));
      }
      return [...pids];
    }
    const out = execFileSync('lsof', ['-ti', `tcp:${port}`, '-sTCP:LISTEN'], { encoding: 'utf8' });
    return out.split('\n').filter(Boolean).map(Number);
  } catch {
    return [];
  }
}

const OWN_PORTS = Object.values(PORTS);

if (args.has('--clean')) {
  for (const port of OWN_PORTS) {
    for (const pid of pidsListeningOn(port)) {
      log(`matando PID ${pid} que escucha en el puerto propio ${port}`);
      killTree(pid);
    }
  }
  process.exit(0);
}

for (const port of OWN_PORTS) {
  const pids = pidsListeningOn(port);
  if (pids.length > 0) {
    process.stderr.write(`[stack] El puerto ${port} ya esta ocupado (PID ${pids.join(',')}). Ejecuta con --clean si es un resto de una ejecucion anterior.\n`);
    process.exit(2);
  }
}

mkdirSync(RUN_DIR, { recursive: true });
const children = new Map(); // nombre -> ChildProcess
const closers = [];
let shuttingDown = false;
let pg;
let pgDir;

function spawnLogged(name, command, argv, { cwd, env }) {
  const out = createWriteStream(join(RUN_DIR, `${name}.log`), { flags: 'w' });
  const child = spawn(command, argv, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  child.stdout.pipe(out, { end: false });
  child.stderr.pipe(out, { end: false });
  child.once('exit', (code, signal) => {
    out.write(`\n[exit code=${code} signal=${signal}]\n`);
    out.end();
    children.delete(name);
    if (!shuttingDown && name !== 'api') log(`ATENCION: ${name} termino inesperadamente (code=${code})`);
  });
  children.set(name, child);
  return child;
}

async function waitForHttp(url, { timeoutMs = 120_000, name = url } = {}) {
  const started = Date.now();
  let lastError = '';
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (res.status < 500) return;
      lastError = `HTTP ${res.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`${name} no respondio en ${timeoutMs} ms (${lastError})`);
}

async function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  log('apagando...');
  for (const [name, child] of Array.from(children)) {
    log(`deteniendo ${name} (PID ${child.pid})`);
    killTree(child.pid);
  }
  for (const close of closers.reverse()) {
    try {
      await close();
    } catch {
      // mejor esfuerzo
    }
  }
  if (pg) {
    try {
      await pg.stop();
    } catch {
      // ya detenido
    }
  }
  if (pgDir) rmSync(pgDir, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 });
  log('apagado completo');
  process.exit(code);
}
process.on('SIGINT', () => void shutdown(0));
process.on('SIGTERM', () => void shutdown(0));
process.on('uncaughtException', (error) => {
  process.stderr.write(`[stack] error no controlado: ${error?.stack ?? error}\n`);
  void shutdown(1);
});

try {
  const t0 = Date.now();

  // 0. Compilar shared + api (la API real corre desde dist/).
  if (!args.has('--skip-build')) {
    log('compilando @student-os/shared y @student-os/api...');
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    for (const workspace of ['@student-os/shared', '@student-os/api']) {
      execFileSync(npm, ['run', 'build', '-w', workspace], { cwd: REPO_ROOT, stdio: 'pipe', shell: process.platform === 'win32' });
    }
  }

  // 1. Postgres embebido
  pgDir = mkdtempSync(join(tmpdir(), 'student-os-e2e-pg-'));
  pg = new EmbeddedPostgres({
    databaseDir: pgDir,
    user: 'postgres',
    password: PG_PASSWORD,
    port: PORTS.pg,
    persistent: false,
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
    onLog: () => {},
    onError: () => {},
  });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase(PG_DATABASE);
  log(`Postgres embebido listo en :${PORTS.pg} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);

  // 2. Esquema (prisma db push en un schema privado; nunca migraciones)
  execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'db', 'push', '--skip-generate', '--accept-data-loss'], {
    cwd: API_ROOT,
    env: { ...process.env, DATABASE_URL, DIRECT_URL: DATABASE_URL },
    stdio: 'pipe',
  });
  log('prisma db push OK (schema dev_e2e)');

  // 3. Supabase y Google falsos
  const supabase = await startFakeSupabase({ port: PORTS.supabase });
  closers.push(() => supabase.close());
  const google = await startFakeGoogle({ port: PORTS.google });
  closers.push(() => google.close());
  log(`Supabase falso :${PORTS.supabase}, Google falso :${PORTS.google}`);

  // 4. API real
  const apiEnv = {
    ...process.env,
    NODE_ENV: 'development',
    PORT: String(PORTS.api),
    DATABASE_URL,
    DIRECT_URL: DATABASE_URL,
    SUPABASE_URL: `http://localhost:${PORTS.supabase}`,
    WEB_ORIGINS: `http://localhost:${PORTS.web}`,
    GOOGLE_CLIENT_ID: FAKE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: FAKE_CLIENT_SECRET,
    GOOGLE_TOKEN_ENC_KEY: 'e2e-only-google-token-enc-key-0123456789abcdef',
    GOOGLE_REDIRECT_URI: `http://localhost:${PORTS.api}/google/callback`,
    GOOGLE_OAUTH_BASE: google.url,
    GOOGLE_API_BASE: google.url,
    GOOGLE_AUTH_URL: google.authUrl,
  };
  const startApi = async () => {
    spawnLogged('api', process.execPath, [join(API_ROOT, 'dist', 'main.js')], { cwd: API_ROOT, env: apiEnv });
    await waitForHttp(`http://localhost:${PORTS.api}/health`, { name: 'API', timeoutMs: 60_000 });
  };
  await startApi();
  log(`API real lista en :${PORTS.api}`);

  // 5. Web real (Vite). Dos servidores: con nube (5293) y SIN variables (5294).
  const viteBin = join(dirname(requireWeb.resolve('vite/package.json')), 'bin', 'vite.js');
  const webEnvBase = { ...process.env, BROWSER: 'none' };
  spawnLogged('web', process.execPath, [viteBin, '--port', String(PORTS.web), '--strictPort', '--host', 'localhost'], {
    cwd: WEB_ROOT,
    env: {
      ...webEnvBase,
      VITE_SUPABASE_URL: `http://localhost:${PORTS.supabase}`,
      VITE_SUPABASE_PUBLISHABLE_KEY: 'fake',
      VITE_API_URL: `http://localhost:${PORTS.api}`,
    },
  });
  spawnLogged('web-nocloud', process.execPath, [viteBin, '--port', String(PORTS.webNoCloud), '--strictPort', '--host', 'localhost'], {
    cwd: WEB_ROOT,
    // Vacias a proposito: process.env gana sobre cualquier .env* de la raiz del repo.
    env: { ...webEnvBase, VITE_SUPABASE_URL: '', VITE_SUPABASE_PUBLISHABLE_KEY: '', VITE_API_URL: '', VITE_GOOGLE_CLIENT_ID: '' },
  });
  await Promise.all([
    waitForHttp(`http://localhost:${PORTS.web}/`, { name: 'web (nube)' }),
    waitForHttp(`http://localhost:${PORTS.webNoCloud}/`, { name: 'web (sin nube)' }),
  ]);
  log(`Web real lista en :${PORTS.web} (nube) y :${PORTS.webNoCloud} (sin nube)`);

  // 6. Servidor de control para las pruebas
  const readJson = (req) =>
    new Promise((res, rej) => {
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        try {
          res(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {});
        } catch (e) {
          rej(e);
        }
      });
      req.on('error', rej);
    });
  const reply = (res, status, body) => {
    res.statusCode = status;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(body ?? {}));
  };

  const control = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1');
      const route = `${req.method} ${url.pathname}`;
      switch (route) {
        case 'GET /ready':
          return reply(res, 200, { ready: true, ports: PORTS, databaseUrl: DATABASE_URL, bootSeconds: (Date.now() - t0) / 1000 });
        case 'POST /shutdown':
          reply(res, 200, { ok: true });
          setTimeout(() => void shutdown(0), 50);
          return undefined;
        case 'GET /session': {
          const key = url.searchParams.get('user') ?? 'a';
          const session = await supabase.buildSession(key, { expiresIn: Number(url.searchParams.get('expires_in') ?? 3600) });
          return reply(res, 200, { userId: uuidForUser(key), email: `${key}@e2e.test`, storageKey: 'sb-localhost-auth-token', session });
        }
        case 'POST /supabase/config': {
          const body = await readJson(req);
          if (typeof body.failRefresh === 'boolean') supabase.state.failRefresh = body.failRefresh;
          if (typeof body.loginUserKey === 'string') supabase.state.loginUserKey = body.loginUserKey;
          return reply(res, 200, supabase.state);
        }
        case 'GET /supabase/state':
          return reply(res, 200, supabase.state);
        case 'POST /google/config': {
          const body = await readJson(req);
          if (typeof body.consentEmail === 'string') google.opts.consentEmail = body.consentEmail;
          return reply(res, 200, google.opts);
        }
        case 'POST /google/revoke-all':
          google.revokeAllRefreshTokens();
          return reply(res, 200, { ok: true });
        case 'GET /google/state': {
          const email = url.searchParams.get('email') ?? google.opts.consentEmail;
          return reply(res, 200, {
            counters: google.counters,
            refreshTokens: google.refreshTokensOf(email).length,
            revoked: google.revokedStateOf(email),
            callCount: google.calls.length,
            paths: google.calls.map((c) => `${c.method} ${c.path}`),
          });
        }
        case 'GET /google/events':
          return reply(res, 200, google.eventsOf(url.searchParams.get('email') ?? google.opts.consentEmail));
        case 'POST /google/seed': {
          const body = await readJson(req);
          google.seedEvent(body.email ?? google.opts.consentEmail, body.event);
          return reply(res, 200, { ok: true });
        }
        case 'POST /google/fail-next': {
          const body = await readJson(req);
          google.failNextCalendar(body.status ?? 500, body.body, body.times ?? 1);
          return reply(res, 200, { ok: true });
        }
        case 'POST /api/stop': {
          const api = children.get('api');
          if (api) {
            killTree(api.pid);
            await new Promise((r) => api.once('exit', r));
          }
          return reply(res, 200, { stopped: true });
        }
        case 'POST /api/start':
          if (!children.has('api')) await startApi();
          return reply(res, 200, { started: true });
        default:
          return reply(res, 404, { error: `ruta de control desconocida: ${route}` });
      }
    } catch (error) {
      return reply(res, 500, { error: error instanceof Error ? error.message : String(error) });
    }
  });
  await new Promise((r, j) => {
    control.once('error', j);
    control.listen(PORTS.control, '127.0.0.1', r);
  });
  closers.push(
    () =>
      new Promise((r) => {
        control.close(() => r());
        control.closeAllConnections();
      }),
  );

  log(`STACK_READY en ${((Date.now() - t0) / 1000).toFixed(1)} s`);
} catch (error) {
  process.stderr.write(`[stack] fallo al arrancar: ${error instanceof Error ? (error.stack ?? error.message) : error}\n`);
  await shutdown(1);
}
