// Constantes compartidas entre el arnes (stack.mjs) y la suite Playwright (apps/web/e2e).
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ports from '../ports.cjs';

// Puertos del E2E = base de apps/api/test/ports.cjs + E2E_PORT_OFFSET (con 0: 54340-54343, 3100, 5293 y 5294).
// La suite Playwright (apps/web/e2e/support/harness.ts) importa este mismo objeto: no hay numeros duplicados.
const { pg, supabase, google, control, api, web, webNoCloud } = ports.TEST_PORTS;
export const PORTS = { pg, supabase, google, control, api, web, webNoCloud };
export const PORT_OFFSET = ports.PORT_OFFSET;

const HERE = dirname(fileURLToPath(import.meta.url));
export const API_ROOT = resolve(HERE, '..', '..');
export const REPO_ROOT = resolve(API_ROOT, '..', '..');
export const WEB_ROOT = join(REPO_ROOT, 'apps', 'web');
export const RUN_DIR = join(WEB_ROOT, 'e2e', '.run');

export const PG_PASSWORD = 'e2e-only-password';
export const PG_DATABASE = 'e2e';
export const PG_SCHEMA = 'dev_e2e';
export const DATABASE_URL = `postgresql://postgres:${PG_PASSWORD}@127.0.0.1:${PORTS.pg}/${PG_DATABASE}?schema=${PG_SCHEMA}`;
