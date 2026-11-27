import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * render.yaml debe declarar TODAS las variables de entorno que la API lee (env.schema.ts y GoogleConfig).
 * Motivo: en el primer despliegue faltó GOOGLE_REDIRECT_URI (la lee GoogleConfig, no env.schema) y la API
 * respondía google_not_configured aunque el login funcionara.
 */
const ROOT = join(__dirname, '..', '..', '..', '..');
const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), 'utf8');

const INJECTED_BY_RENDER = new Set(['PORT']);
/** Solo durante una rotación de la clave de cifrado (requiere aprobación del humano); no se declara en producción normal. */
const OPTIONAL_ONLY_FOR_ROTATION = new Set(['GOOGLE_TOKEN_ENC_KEY_PREVIOUS']);

function declaredInRenderYaml(): Set<string> {
  const keys = [...read('render.yaml').matchAll(/-\s*key:\s*([A-Z0-9_]+)/g)].map((m) => m[1]);
  return new Set(keys);
}

function readByApi(): string[] {
  const schema = read('apps', 'api', 'src', 'config', 'env.schema.ts');
  const objectBody = schema.slice(schema.indexOf('z.object({'), schema.indexOf('});', schema.indexOf('z.object({')));
  const fromSchema = [...objectBody.matchAll(/^\s{2}([A-Z][A-Z0-9_]+):/gm)].map((m) => m[1]);
  const google = read('apps', 'api', 'src', 'google', 'google.config.ts');
  const fromGoogle = [...google.matchAll(/this\.str\('([A-Z0-9_]+)'\)/g)].map((m) => m[1]);
  return [...new Set([...fromSchema, ...fromGoogle])].filter((name) => !INJECTED_BY_RENDER.has(name) && !OPTIONAL_ONLY_FOR_ROTATION.has(name));
}

describe('render.yaml declara las variables que lee la API', () => {
  it('encuentra las variables conocidas (la extracción funciona)', () => {
    const vars = readByApi();
    expect(vars).toEqual(expect.arrayContaining(['DATABASE_URL', 'SUPABASE_URL', 'GOOGLE_CLIENT_ID', 'GOOGLE_REDIRECT_URI']));
  });

  it('cada variable que lee la API está declarada en render.yaml', () => {
    const declared = declaredInRenderYaml();
    const missing = readByApi().filter((name) => !declared.has(name));
    expect(missing).toEqual([]);
  });
});
