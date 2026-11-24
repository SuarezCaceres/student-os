/**
 * Utilidades compartidas de la suite E2E. Todo apunta al stack local que levanta
 * `apps/api/test/e2e-harness/stack.mjs` (puertos propios, sin servicios externos).
 */
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import type { Browser, BrowserContext, Page, Request, Response } from '@playwright/test';

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(HERE, '..', '..', '..', '..');
export const EVIDENCE_DIR = join(REPO_ROOT, 'docs', 'qa', 'evidence');

export const PORTS = { pg: 54340, supabase: 54341, google: 54342, control: 54343, api: 3100, web: 5293, webNoCloud: 5294 } as const;
export const WEB = `http://localhost:${PORTS.web}`;
export const WEB_NOCLOUD = `http://localhost:${PORTS.webNoCloud}`;
export const API = `http://localhost:${PORTS.api}`;
export const CONTROL = `http://127.0.0.1:${PORTS.control}`;
export const GOOGLE_FAKE = `http://localhost:${PORTS.google}`;
export const DATABASE_URL = `postgresql://postgres:e2e-only-password@127.0.0.1:${PORTS.pg}/e2e?schema=dev_e2e`;

export const VIEWPORTS = {
  desktop: { width: 1440, height: 960 },
  mobile: { width: 390, height: 844 },
} as const;

// ---------------------------------------------------------------------------------------------
// Control del arnes
// ---------------------------------------------------------------------------------------------

export async function control<T = unknown>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${CONTROL}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`control ${path} -> HTTP ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

export interface TestSession {
  userKey: string;
  userId: string;
  email: string;
  storageKey: string;
  accessToken: string;
  /** Sesion completa tal como la guarda supabase-js en localStorage. */
  session: Record<string, unknown>;
}

/** Sesion firmada por el JWKS falso para el usuario `userKey` (mismo nombre = mismo usuario, siempre). */
export async function sessionFor(userKey: string, expiresIn = 3600): Promise<TestSession> {
  const r = await control<{ userId: string; email: string; storageKey: string; session: { access_token: string } & Record<string, unknown> }>(
    `/session?user=${encodeURIComponent(userKey)}&expires_in=${expiresIn}`,
  );
  return { userKey, userId: r.userId, email: r.email, storageKey: r.storageKey, accessToken: r.session.access_token, session: r.session };
}

/** Un nombre unico por ejecucion para no chocar con datos de ejecuciones anteriores si se reutiliza el stack. */
export const RUN_ID = Date.now().toString(36);
export const userKey = (name: string): string => `${name}-${RUN_ID}`;

// ---------------------------------------------------------------------------------------------
// Navegador
// ---------------------------------------------------------------------------------------------

export interface ContextOptions {
  viewport?: { width: number; height: number };
  isMobile?: boolean;
  colorScheme?: 'light' | 'dark';
  /** Sesion de nube a inyectar en localStorage (formato real de supabase-js). */
  session?: TestSession;
  /** Valores extra de localStorage a sembrar UNA sola vez (antes del primer script de la app). */
  localStorage?: Record<string, string>;
  acceptDownloads?: boolean;
}

/**
 * Crea un contexto de navegador. Las claves se siembran solo la primera vez (marca `__e2e_seeded`), de modo que
 * supabase-js pueda renovar o borrar su propia sesion despues sin que el script la vuelva a pisar.
 */
export async function newContext(browser: Browser, options: ContextOptions = {}): Promise<BrowserContext> {
  const context = await browser.newContext({
    viewport: options.viewport ?? VIEWPORTS.desktop,
    isMobile: options.isMobile,
    hasTouch: options.isMobile,
    deviceScaleFactor: options.isMobile ? 2 : 1,
    colorScheme: options.colorScheme ?? 'dark',
    locale: 'es-ES',
    acceptDownloads: options.acceptDownloads ?? true,
  });
  const seed: Record<string, string> = { ...(options.localStorage ?? {}) };
  if (options.session) seed[options.session.storageKey] = JSON.stringify(options.session.session);
  if (Object.keys(seed).length > 0) {
    await context.addInitScript((entries: Record<string, string>) => {
      try {
        if (localStorage.getItem('__e2e_seeded')) return;
        for (const [k, v] of Object.entries(entries)) localStorage.setItem(k, v);
        localStorage.setItem('__e2e_seeded', '1');
      } catch {
        // sin localStorage
      }
    }, seed);
  }
  return context;
}

// ---------------------------------------------------------------------------------------------
// Observacion de red
// ---------------------------------------------------------------------------------------------

export interface ApiCall {
  method: string;
  path: string;
  status: number | null;
  at: number;
}

/** Registra todas las peticiones del navegador hacia la API real (con su estado) y los errores de consola. */
export class PageTap {
  readonly calls: ApiCall[] = [];
  readonly consoleErrors: string[] = [];
  readonly pageErrors: string[] = [];
  readonly failedRequests: string[] = [];
  private readonly pending = new Map<Request, ApiCall>();

  constructor(readonly page: Page) {
    page.on('request', (req: Request) => {
      if (!req.url().startsWith(API)) return;
      const call: ApiCall = { method: req.method(), path: req.url().slice(API.length), status: null, at: Date.now() };
      this.pending.set(req, call);
      this.calls.push(call);
    });
    page.on('response', (res: Response) => {
      const call = this.pending.get(res.request());
      if (call) call.status = res.status();
    });
    page.on('requestfailed', (req: Request) => {
      if (req.url().startsWith(API)) this.failedRequests.push(`${req.method()} ${req.url().slice(API.length)} ${req.failure()?.errorText ?? ''}`);
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') this.consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => this.pageErrors.push(err.message));
  }

  count(method: string, pathPrefix: string): number {
    return this.calls.filter((c) => c.method === method && c.path.startsWith(pathPrefix)).length;
  }

  pushes(): ApiCall[] {
    return this.calls.filter((c) => c.method === 'POST' && c.path.startsWith('/sync/push'));
  }

  pulls(): ApiCall[] {
    return this.calls.filter((c) => c.method === 'GET' && c.path.startsWith('/sync/pull'));
  }

  statuses(): number[] {
    return this.calls.map((c) => c.status).filter((s): s is number => s !== null);
  }
}

/** Errores de consola que SI son un problema (descarta ruido conocido de Vite / React DevTools / red simulada). */
export function relevantConsoleErrors(tap: PageTap, ignore: RegExp[] = []): string[] {
  return tap.consoleErrors.filter((text) => !ignore.some((re) => re.test(text)));
}

// ---------------------------------------------------------------------------------------------
// Evidencia y utilidades de UI
// ---------------------------------------------------------------------------------------------

/** Captura ligera (JPEG) en docs/qa/evidence/<nombre>.jpg. */
export async function evidence(page: Page, name: string): Promise<string> {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  const path = join(EVIDENCE_DIR, `${name}.jpg`);
  await page.screenshot({ path, type: 'jpeg', quality: 55, animations: 'disabled' });
  return path;
}

export async function syncBadgeText(page: Page): Promise<string> {
  const badge = page.getByRole('status').filter({ hasText: /Sincroniz|Pendiente|Sin conexión|Conectando|Despertando|Falta elegir|No se pudo|en pausa/ }).first();
  return ((await badge.textContent({ timeout: 2_000 }).catch(() => null)) ?? '').trim();
}

/** Espera a que el indicador diga "Sincronizado" (sin pendientes) y se estabilice. */
export async function waitSynced(page: Page, timeout = 30_000): Promise<void> {
  await page.getByRole('status').filter({ hasText: /^\s*Sincronizado\s*$/ }).first().waitFor({ state: 'visible', timeout });
}

/** Llama al `focus` de la ventana (lo que hace el navegador al volver a la pestana) hasta que `check` se cumpla. */
export async function pullByFocusUntil(page: Page, check: () => Promise<boolean>, timeoutMs = 60_000, everyMs = 2_500): Promise<number> {
  const started = Date.now();
  let attempts = 0;
  while (Date.now() - started < timeoutMs) {
    if (await check()) return attempts;
    attempts++;
    await page.evaluate(() => {
      window.dispatchEvent(new Event('focus'));
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForTimeout(everyMs);
  }
  if (await check()) return attempts;
  throw new Error(`La condicion no se cumplio tras ${timeoutMs} ms de focos`);
}

export async function gotoApp(page: Page, url = WEB): Promise<void> {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
}

export interface Device {
  context: BrowserContext;
  page: Page;
  tap: PageTap;
}

/**
 * Abre un "dispositivo" (contexto nuevo con la sesion inyectada) y lo deja sincronizado y listo para usar.
 * `upload` ya no hace nada (se mantiene por compatibilidad): sin importador, el primer dispositivo sube su estado solo.
 */
export async function bootDevice(
  browser: Browser,
  session: TestSession,
  options: { kind: 'desktop' | 'mobile'; upload?: boolean; colorScheme?: 'light' | 'dark' },
): Promise<Device> {
  const mobile = options.kind === 'mobile';
  const context = await newContext(browser, {
    session,
    viewport: mobile ? VIEWPORTS.mobile : VIEWPORTS.desktop,
    isMobile: mobile,
    colorScheme: options.colorScheme,
  });
  const page = await context.newPage();
  const tap = new PageTap(page);
  await gotoApp(page);
  await page.getByRole('navigation', { name: mobile ? 'Navegación móvil' : 'Navegación principal' }).waitFor({ state: 'visible', timeout: 30_000 });
  await waitSynced(page, 40_000);
  return { context, page, tap };
}

/** Espera (con poll) a que el servidor tenga un registro vivo cuyo JSON contenga `needle`. */
export async function serverHas(userId: string, collection: string, needle: string): Promise<boolean> {
  return (await syncRecordsOf(userId, collection)).some((r) => r.deletedAt === null && JSON.stringify(r.data ?? '').includes(needle));
}

export type TabName = 'Resumen' | 'Kanban' | 'Universidad' | 'Gym' | 'Horario' | 'Aprendizaje';

/** Va a una pestana de la app (navbar de escritorio o menu movil). */
export async function openTab(page: Page, name: TabName): Promise<void> {
  const width = page.viewportSize()?.width ?? 1440;
  if (width >= 768) {
    await page.getByRole('navigation', { name: 'Navegación principal' }).getByText(name, { exact: true }).first().click();
  } else {
    // En movil algunas etiquetas van abreviadas ("Uni", "Aprender").
    const short: Record<TabName, string> = { Resumen: 'Resumen', Kanban: 'Kanban', Universidad: 'Uni', Gym: 'Gym', Horario: 'Horario', Aprendizaje: 'Aprend' };
    await page.getByRole('navigation', { name: 'Navegación móvil' }).getByRole('button', { name: new RegExp(`^${short[name]}`) }).first().click();
  }
}

// ---------------------------------------------------------------------------------------------
// Base de datos (solo lectura / verificacion)
// ---------------------------------------------------------------------------------------------

let prisma: PrismaClient | null = null;
export function db(): PrismaClient {
  prisma ??= new PrismaClient({ datasourceUrl: DATABASE_URL, log: [] });
  return prisma;
}

export async function disconnectDb(): Promise<void> {
  if (prisma) await prisma.$disconnect();
  prisma = null;
}

export interface UserRows {
  syncRecords: number;
  syncActiveRecords: number;
  syncState: number;
  profiles: number;
  googleConnections: number;
  googleStates: number;
}

export async function rowsOf(userId: string): Promise<UserRows> {
  const q = async (table: string, column = 'userId', extra = ''): Promise<number> => {
    const rows = await db().$queryRawUnsafe<Array<{ n: number }>>(`select count(*)::int as n from dev_e2e."${table}" where "${column}" = $1::uuid ${extra}`, userId);
    return rows[0]?.n ?? 0;
  };
  return {
    syncRecords: await q('sync_records'),
    syncActiveRecords: await q('sync_records', 'userId', 'and "deletedAt" is null'),
    syncState: await q('user_sync_state'),
    profiles: await q('profiles', 'id'),
    googleConnections: await q('google_connections'),
    googleStates: await q('google_oauth_states'),
  };
}

export async function syncRecordsOf(userId: string, collection?: string): Promise<Array<{ collection: string; id: string; data: unknown; deletedAt: Date | null }>> {
  return db().$queryRawUnsafe(
    `select collection, id, data, "deletedAt" from dev_e2e.sync_records where "userId" = $1::uuid ${collection ? `and collection = '${collection.replace(/'/g, '')}'` : ''} order by seq`,
    userId,
  );
}

// ---------------------------------------------------------------------------------------------
// Llamadas directas a la API (con el token de un usuario)
// ---------------------------------------------------------------------------------------------

export async function apiFetch(path: string, token: string | null, init: RequestInit & { origin?: string } = {}): Promise<Response2> {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string> | undefined) };
  if (token) headers.authorization = `Bearer ${token}`;
  if (init.origin) headers.origin = init.origin;
  if (init.body && !headers['content-type']) headers['content-type'] = 'application/json';
  const res = await fetch(`${API}${path}`, { ...init, headers });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, headers: res.headers, text, json };
}

export interface Response2 {
  status: number;
  headers: Headers;
  text: string;
  json: unknown;
}
