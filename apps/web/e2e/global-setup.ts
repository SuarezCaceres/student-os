/**
 * Levanta el stack real (Postgres embebido + Supabase/Google falsos + API Nest + Vite) antes de la suite y lo apaga
 * por completo al terminar. Con `E2E_REUSE_STACK=1` reutiliza un stack ya levantado a mano
 * (`npm run e2e:stack -w @student-os/web`) y NO lo apaga.
 */
import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync, createWriteStream } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { CONTROL, PORTS, REPO_ROOT, WEB, WEB_NOCLOUD, control, sessionFor } from './support/harness';

const STACK = join(REPO_ROOT, 'apps', 'api', 'test', 'e2e-harness', 'stack.mjs');
const RUN_DIR = join(REPO_ROOT, 'apps', 'web', 'e2e', '.run');

async function isUp(): Promise<boolean> {
  try {
    const res = await fetch(`${CONTROL}/ready`, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}

function killTree(pid: number | undefined): void {
  if (!pid) return;
  try {
    if (process.platform === 'win32') execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
    else process.kill(pid, 'SIGKILL');
  } catch {
    // ya terminado
  }
}

async function warmUp(): Promise<void> {
  // Vite optimiza dependencias en la primera visita y puede recargar la pagina: se hace ahora, no durante un test.
  const browser = await chromium.launch({ channel: (process.env.E2E_CHANNEL as 'chrome' | 'msedge' | undefined) ?? 'chrome' });
  try {
    const session = await sessionFor('warmup');
    for (const [url, withSession] of [
      [WEB_NOCLOUD, false],
      [WEB, true],
    ] as const) {
      const context = await browser.newContext();
      if (withSession) {
        await context.addInitScript(([k, v]) => localStorage.setItem(k, v), [session.storageKey, JSON.stringify(session.session)] as const);
      }
      const page = await context.newPage();
      await page.goto(url, { waitUntil: 'networkidle', timeout: 90_000 });
      await page.waitForTimeout(3_000);
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

export default async function globalSetup(): Promise<() => Promise<void>> {
  const startedAt = Date.now();
  if (process.env.E2E_REUSE_STACK === '1' && (await isUp())) {
    console.log('[e2e] reutilizando el stack ya levantado (no se apagara)');
    await warmUp();
    return async () => {};
  }
  if (await isUp()) {
    throw new Error(
      `Ya hay un stack E2E en el puerto ${PORTS.control}. Apagalo (POST /shutdown), usa E2E_REUSE_STACK=1 o desplaza los puertos con E2E_PORT_OFFSET.`,
    );
  }

  mkdirSync(RUN_DIR, { recursive: true });
  const out = createWriteStream(join(RUN_DIR, 'stack.log'), { flags: 'w' });
  const child: ChildProcess = spawn(process.execPath, [STACK], { cwd: REPO_ROOT, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  child.stdout?.pipe(out, { end: false });
  child.stderr?.pipe(out, { end: false });
  let exited = false;
  child.once('exit', () => {
    exited = true;
  });

  const deadline = Date.now() + 300_000;
  while (Date.now() < deadline) {
    if (exited) throw new Error(`El arnes termino antes de estar listo. Revisa ${join(RUN_DIR, 'stack.log')}`);
    if (await isUp()) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!(await isUp())) {
    killTree(child.pid);
    throw new Error('El stack no estuvo listo en 300 s');
  }
  console.log(`[e2e] stack listo en ${((Date.now() - startedAt) / 1000).toFixed(1)} s (PID arnes ${child.pid})`);
  await warmUp();
  console.log(`[e2e] calentamiento de Vite terminado (${((Date.now() - startedAt) / 1000).toFixed(1)} s en total)`);

  return async () => {
    console.log('[e2e] apagando el stack...');
    try {
      await control('/shutdown', {});
    } catch {
      // puede que ya este cayendo
    }
    const waitExit = new Promise<void>((resolve) => {
      if (exited) resolve();
      else child.once('exit', () => resolve());
    });
    await Promise.race([waitExit, new Promise((r) => setTimeout(r, 40_000))]);
    if (!exited) {
      console.log('[e2e] el arnes no se apago a tiempo: se mata su arbol de procesos');
      killTree(child.pid);
    }
    // Comprobacion final: nada nuestro debe seguir escuchando.
    await new Promise((r) => setTimeout(r, 1500));
    const leftovers: number[] = [];
    for (const port of Object.values(PORTS)) {
      try {
        await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(800) });
        leftovers.push(port);
      } catch {
        // cerrado: bien
      }
    }
    console.log(leftovers.length === 0 ? '[e2e] todos los puertos propios quedaron libres' : `[e2e] ATENCION: siguen respondiendo los puertos ${leftovers.join(', ')}`);
  };
}
