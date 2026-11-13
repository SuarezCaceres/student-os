import { validateEnv } from './env.schema';

const base = {
  DATABASE_URL: 'postgresql://user:pass@localhost:6543/postgres?pgbouncer=true',
  DIRECT_URL: 'postgresql://user:pass@localhost:5432/postgres',
  SUPABASE_URL: 'https://abcd1234.supabase.co/',
};

describe('validateEnv', () => {
  it('aplica valores por defecto y normaliza', () => {
    const env = validateEnv(base);
    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(3000);
    expect(env.SUPABASE_URL).toBe('https://abcd1234.supabase.co');
    expect(env.SUPABASE_JWT_AUDIENCE).toBe('authenticated');
    expect(env.WEB_ORIGINS).toEqual(['http://localhost:5173']);
    expect(env.GOOGLE_CLIENT_ID).toBeUndefined();
  });

  it('convierte PORT a numero y respeta la audiencia', () => {
    const env = validateEnv({ ...base, PORT: '8080', SUPABASE_JWT_AUDIENCE: 'otra' });
    expect(env.PORT).toBe(8080);
    expect(env.SUPABASE_JWT_AUDIENCE).toBe('otra');
  });

  it('parsea WEB_ORIGINS separados por comas, con espacios y barra final', () => {
    const env = validateEnv({ ...base, WEB_ORIGINS: 'https://app.vercel.app/, http://localhost:5173 ,' });
    expect(env.WEB_ORIGINS).toEqual(['https://app.vercel.app', 'http://localhost:5173']);
  });

  it('rechaza origenes con ruta o esquema invalido', () => {
    expect(() => validateEnv({ ...base, WEB_ORIGINS: 'https://app.com/ruta' })).toThrow(/WEB_ORIGINS/);
    expect(() => validateEnv({ ...base, WEB_ORIGINS: 'app.com' })).toThrow(/WEB_ORIGINS/);
  });

  it('exige WEB_ORIGINS en produccion', () => {
    expect(() => validateEnv({ ...base, NODE_ENV: 'production' })).toThrow(/WEB_ORIGINS/);
    expect(validateEnv({ ...base, NODE_ENV: 'production', WEB_ORIGINS: 'https://app.com' }).WEB_ORIGINS).toEqual([
      'https://app.com',
    ]);
  });

  it('exige DATABASE_URL, DIRECT_URL y SUPABASE_URL', () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL[\s\S]*DIRECT_URL[\s\S]*SUPABASE_URL/);
  });

  it('rechaza una DATABASE_URL que no sea Postgres', () => {
    expect(() => validateEnv({ ...base, DATABASE_URL: 'mysql://x' })).toThrow(/DATABASE_URL/);
  });

  it('trata las variables de Google vacias como no definidas', () => {
    const env = validateEnv({ ...base, GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '  ', GOOGLE_TOKEN_ENC_KEY: '' });
    expect(env.GOOGLE_CLIENT_ID).toBeUndefined();
    expect(env.GOOGLE_CLIENT_SECRET).toBeUndefined();
    expect(env.GOOGLE_TOKEN_ENC_KEY).toBeUndefined();
  });

  it('exige una clave de cifrado de al menos 32 caracteres si se define', () => {
    expect(() => validateEnv({ ...base, GOOGLE_TOKEN_ENC_KEY: 'corta' })).toThrow(/GOOGLE_TOKEN_ENC_KEY/);
    expect(validateEnv({ ...base, GOOGLE_TOKEN_ENC_KEY: 'x'.repeat(32) }).GOOGLE_TOKEN_ENC_KEY).toHaveLength(32);
  });

  it('el mensaje de error no incluye los valores (no filtra secretos)', () => {
    let message = '';
    try {
      validateEnv({ ...base, DATABASE_URL: 'mysql://super-secreto', GOOGLE_TOKEN_ENC_KEY: 'clave-secreta' });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('DATABASE_URL');
    expect(message).not.toContain('super-secreto');
    expect(message).not.toContain('clave-secreta');
  });
});
