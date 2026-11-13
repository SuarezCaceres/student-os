import { createHash } from 'node:crypto';

/**
 * Utilidades para registrar sin datos personales (PII) ni credenciales.
 *
 * Reglas de logging de la API:
 *  - Nunca se registra el cuerpo de las peticiones, el correo, nombres ni contenido de `data`.
 *  - `authorization`, `cookie` y `set-cookie` ya se eliminan en `pino-http` (app.module.ts).
 *  - Cuando hace falta correlacionar a un usuario en un log, se usa `userRef(userId)` (hash corto), nunca el
 *    `userId` ni el correo.
 */

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const JWT = /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]*/g;
const BEARER = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;
/** Access token de Google (`ya29.`) y refresh token (`1//`). */
const GOOGLE_TOKEN = /\b(?:ya29\.[A-Za-z0-9._-]+|1\/\/[A-Za-z0-9._-]{20,})/g;

/** Elimina correos, JWT, cabeceras Bearer y tokens de Google de un texto libre. */
export function redactPii(text: string): string {
  return text
    .replace(JWT, '[token]')
    .replace(BEARER, 'Bearer [token]')
    .replace(GOOGLE_TOKEN, '[token]')
    .replace(EMAIL, '[email]');
}

/** Referencia opaca y estable de un usuario para logs (8 hex de SHA-256). No es reversible de forma practica. */
export function userRef(userId: string): string {
  return createHash('sha256').update(userId).digest('hex').slice(0, 8);
}

/**
 * Descripcion segura de un error para logs o para el informe de borrado: solo el nombre de la clase y, si
 * existe, un codigo corto (`code` de Prisma/Node). Nunca el `message` (puede incluir datos del usuario).
 */
export function safeErrorSummary(error: unknown): string {
  if (!(error instanceof Error)) return 'Error';
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' && /^[A-Za-z0-9_.-]{1,40}$/.test(code) ? `${error.name} (${code})` : error.name;
}

/**
 * Rutas que `pino` debe eliminar si el Integrador amplia la redaccion de `app.module.ts`
 * (ver docs/agent-notes/PUBLIC.md). Hoy ya se eliminan las tres primeras.
 */
export const PII_LOG_REDACT_PATHS: readonly string[] = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  'req.body',
  'req.query.token',
  'req.query.code',
  'req.query.state',
];
