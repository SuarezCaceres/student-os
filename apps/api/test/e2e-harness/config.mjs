// Constantes compartidas entre el arnes (stack.mjs) y la suite Playwright (apps/web/e2e).
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PORTS = { pg: 54340, supabase: 54341, google: 54342, control: 54343, api: 3100, web: 5293, webNoCloud: 5294 };

const HERE = dirname(fileURLToPath(import.meta.url));
export const API_ROOT = resolve(HERE, '..', '..');
export const REPO_ROOT = resolve(API_ROOT, '..', '..');
export const WEB_ROOT = join(REPO_ROOT, 'apps', 'web');
export const RUN_DIR = join(WEB_ROOT, 'e2e', '.run');

export const PG_PASSWORD = 'e2e-only-password';
export const PG_DATABASE = 'e2e';
export const PG_SCHEMA = 'dev_e2e';
export const DATABASE_URL = `postgresql://postgres:${PG_PASSWORD}@127.0.0.1:${PORTS.pg}/${PG_DATABASE}?schema=${PG_SCHEMA}`;
