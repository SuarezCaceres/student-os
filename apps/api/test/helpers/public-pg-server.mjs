// Postgres embebido para los tests de la capa Prisma (agente PUBLIC). Sin Docker.
//
// `embedded-postgres` es ESM puro y Jest corre en CommonJS, asi que el servidor vive en un proceso hijo
// (lo lanza test/helpers/public-pg.ts). Protocolo: escribe una linea JSON `{"ready":true}` en stdout cuando
// acepta conexiones; se detiene limpiamente cuando el padre cierra su stdin (o al recibir SIGTERM/SIGINT).
//
// Uso manual:  node test/helpers/public-pg-server.mjs <puerto> <baseDeDatos>
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import ports from '../ports.cjs';

// Sin argumento: puerto base 54335 + E2E_PORT_OFFSET (el padre, public-pg.ts, siempre lo pasa ya calculado).
const port = Number(process.argv[2] ?? ports.TEST_PORTS.publicPg);
const database = process.argv[3] ?? 'public_test';
const password = 'public-test-only';

const databaseDir = mkdtempSync(join(tmpdir(), 'student-os-public-pg-'));
const pg = new EmbeddedPostgres({
  databaseDir,
  user: 'postgres',
  password,
  port,
  persistent: false,
  // Como Supabase: UTF8. Sin esto, en Windows initdb hereda WIN1252 y rechaza emojis y otros caracteres.
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  onLog: () => {},
  onError: () => {},
});

let stopping = false;
async function shutdown(code) {
  if (stopping) return;
  stopping = true;
  try {
    await pg.stop();
  } catch {
    // ya detenido
  }
  rmSync(databaseDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  process.exit(code);
}

try {
  await pg.initialise();
  await pg.start();
  await pg.createDatabase(database);
  process.stdout.write(`${JSON.stringify({ ready: true, port, database, password })}\n`);
} catch (error) {
  process.stderr.write(`public-pg-server: ${error instanceof Error ? error.message : String(error)}\n`);
  await shutdown(1);
}

process.stdin.resume();
process.stdin.on('end', () => shutdown(0));
process.stdin.on('close', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
process.on('SIGINT', () => shutdown(0));
