import { z } from 'zod';

/** Convierte cadenas vacias (`VAR=` en .env) en `undefined` para que cuenten como "no definida". */
const emptyToUndefined = (value: unknown): unknown =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

const optionalString = z.preprocess(emptyToUndefined, z.string().min(1).optional());

const postgresUrl = z
  .string()
  .min(1, 'requerida')
  .regex(/^postgres(ql)?:\/\//, 'debe empezar por postgresql://');

const originSchema = z.string().refine((value) => {
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.origin === value;
  } catch {
    return false;
  }
}, 'cada origen debe ser http(s)://host[:puerto] sin ruta ni barra final');

export const DEFAULT_DEV_ORIGINS = ['http://localhost:5173'];

const envObjectSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),

  /** Pooler de Supabase (6543, `?pgbouncer=true`) para la app. */
  DATABASE_URL: postgresUrl,
  /** Conexion directa (5432) para migraciones / `prisma db push`. */
  DIRECT_URL: postgresUrl,

  /** URL del proyecto Supabase, p. ej. https://abcd1234.supabase.co (sin barra final). */
  SUPABASE_URL: z
    .string()
    .url('debe ser una URL valida')
    .transform((value) => value.replace(/\/+$/, '')),
  SUPABASE_JWT_AUDIENCE: z.preprocess(emptyToUndefined, z.string().min(1).default('authenticated')),

  /** Lista separada por comas de origenes web permitidos por CORS. */
  WEB_ORIGINS: z.preprocess(emptyToUndefined, z.string().optional()),

  // Opcionales por ahora: los usa el agente GOOGLE en la Ola 3.
  GOOGLE_CLIENT_ID: optionalString,
  GOOGLE_CLIENT_SECRET: optionalString,
  /** Clave de cifrado AES-256-GCM del refresh token (>= 32 caracteres; p. ej. `openssl rand -base64 32`). */
  GOOGLE_TOKEN_ENC_KEY: z.preprocess(
    emptyToUndefined,
    z.string().min(32, 'debe tener al menos 32 caracteres').optional(),
  ),
});

export const envSchema = envObjectSchema.transform((env, ctx) => {
  const rawOrigins = env.WEB_ORIGINS;
  let webOrigins: string[];

  if (rawOrigins === undefined) {
    if (env.NODE_ENV === 'production') {
      ctx.addIssue({
        code: 'custom',
        path: ['WEB_ORIGINS'],
        message: 'es obligatoria en produccion (lista de origenes separada por comas)',
      });
    }
    webOrigins = DEFAULT_DEV_ORIGINS;
  } else {
    webOrigins = rawOrigins
      .split(',')
      .map((origin) => origin.trim().replace(/\/+$/, ''))
      .filter((origin) => origin.length > 0);
    webOrigins.forEach((origin, index) => {
      const result = originSchema.safeParse(origin);
      if (!result.success) {
        ctx.addIssue({
          code: 'custom',
          path: ['WEB_ORIGINS', index],
          message: `"${origin}": ${result.error.issues[0]?.message ?? 'origen invalido'}`,
        });
      }
    });
    if (webOrigins.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['WEB_ORIGINS'], message: 'no puede quedar vacia' });
    }
  }

  return { ...env, WEB_ORIGINS: webOrigins };
});

/** Entorno ya validado y normalizado (`WEB_ORIGINS` es un array). */
export type Env = z.output<typeof envSchema>;

/**
 * Valida el entorno. Lanza un Error legible que NO incluye los valores (solo nombres de variable
 * y motivo), para no filtrar secretos a los logs.
 */
export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(entorno)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Variables de entorno invalidas:\n${details}`);
  }
  return result.data;
}
