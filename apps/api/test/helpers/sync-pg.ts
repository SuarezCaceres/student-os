import { execFileSync, spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { join } from 'node:path';
import { TEST_PORTS } from '../ports.cjs';

/** Puerto base 54329 + E2E_PORT_OFFSET (ver test/ports.cjs). */
export const SYNC_PG_PORT = TEST_PORTS.syncPg;
export const SYNC_PG_DATABASE = 'sync_api_test';
/** Schema privado del agente (convencion `dev_<agente>`): nada se crea en `public`. */
export const SYNC_PG_SCHEMA = 'dev_sync_api';

const API_ROOT = join(__dirname, '..', '..');

export interface SyncPg {
  /** Equivale a DATABASE_URL / DIRECT_URL de la API. */
  url: string;
  stop: () => Promise<void>;
}

/**
 * Arranca un Postgres real embebido (sin Docker) en el puerto `SYNC_PG_PORT` con una base temporal y crea las tablas
 * con `prisma db push` en el schema privado `dev_sync_api`. NO usa credenciales reales ni Supabase y NO genera
 * migraciones.
 */
export async function startSyncPg(): Promise<SyncPg> {
  const child: ChildProcessWithoutNullStreams = spawn(
    process.execPath,
    [join(__dirname, 'sync-pg-server.mjs'), String(SYNC_PG_PORT), SYNC_PG_DATABASE],
    { cwd: API_ROOT, stdio: ['pipe', 'pipe', 'pipe'] },
  );

  const stopped = new Promise<void>((resolve) => child.once('exit', () => resolve()));
  const stop = async (): Promise<void> => {
    if (child.exitCode === null) {
      child.stdin.end(); // senal de apagado limpio (el hijo detiene Postgres y borra su carpeta)
      const timeout = setTimeout(() => child.kill(), 20_000);
      await stopped;
      clearTimeout(timeout);
    }
  };

  let stderr = '';
  child.stderr.on('data', (chunk: Buffer) => {
    stderr += chunk.toString();
  });

  const password = await new Promise<string>((resolve, reject) => {
    let out = '';
    child.stdout.on('data', (chunk: Buffer) => {
      out += chunk.toString();
      const line = out.split('\n').find((l) => l.includes('"ready"'));
      if (line) resolve((JSON.parse(line) as { password: string }).password);
    });
    child.once('exit', () => reject(new Error(`Postgres embebido termino antes de estar listo: ${stderr}`)));
    child.once('error', reject);
  }).catch(async (error) => {
    await stop();
    throw error;
  });

  const url = `postgresql://postgres:${password}@127.0.0.1:${SYNC_PG_PORT}/${SYNC_PG_DATABASE}?schema=${SYNC_PG_SCHEMA}`;

  try {
    execFileSync(
      process.execPath,
      [require.resolve('prisma/build/index.js'), 'db', 'push', '--skip-generate', '--accept-data-loss'],
      { cwd: API_ROOT, env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url }, stdio: 'pipe' },
    );
  } catch (error) {
    await stop();
    const output = (error as { stdout?: Buffer; stderr?: Buffer }).stderr?.toString() ?? String(error);
    throw new Error(`prisma db push fallo: ${output}`);
  }

  return { url, stop };
}
