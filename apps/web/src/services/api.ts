import {
  SyncPushResponseSchema,
  SyncRecordSchema,
  type Collection,
  type SyncRecord,
} from '@student-os/shared';
import { getAccessToken, getApiBaseUrl, refreshAccessToken, signOut } from './supabase';

/**
 * Cliente HTTP de la API de StudentOS (NestJS en Render).
 *
 * Pensado para el plan gratuito de Render, que "duerme" el servicio y tarda hasta ~60-90 s
 * en despertar:
 *  - timeout por intento (~20 s) para no quedarse colgado en una conexion que nunca responde;
 *  - reintentos con backoff exponencial + jitter dentro de un presupuesto total (~90 s);
 *  - estado observable `idle | waking | ok | error` para que la UI sea honesta ("Despertando el servidor...").
 *
 * La UI jamas espera a este cliente: lo usa el motor de sync en segundo plano.
 */

export type ApiStatus = 'idle' | 'waking' | 'ok' | 'error';

export type ApiErrorKind =
  | 'not_configured'
  | 'offline'
  | 'network'
  | 'timeout'
  | 'auth'
  | 'rate_limit'
  | 'server'
  | 'client'
  | 'invalid_response'
  | 'aborted';

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;
  readonly retryAfterMs?: number;
  readonly body?: unknown;
  readonly attempts: number;

  constructor(
    kind: ApiErrorKind,
    message: string,
    extra: { status?: number; retryAfterMs?: number; body?: unknown; attempts?: number } = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = extra.status;
    this.retryAfterMs = extra.retryAfterMs;
    this.body = extra.body;
    this.attempts = extra.attempts ?? 0;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/** Errores que se resuelven solos con tiempo (red, servidor dormido, limite de peticiones). */
export function isTransientApiError(error: unknown): boolean {
  if (!isApiError(error)) return true;
  return ['offline', 'network', 'timeout', 'server', 'rate_limit'].includes(error.kind);
}

export interface ApiClientOptions {
  baseUrl: string | null;
  getAccessToken: () => Promise<string | null>;
  /** Renueva la sesion; devuelve el token nuevo o null. */
  refreshSession: () => Promise<string | null>;
  /** Se llama cuando la sesion no se pudo recuperar (401 tras renovar). */
  onAuthFailure: () => void | Promise<void>;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  random?: () => number;
  now?: () => number;
  isOnline?: () => boolean;
  requestTimeoutMs?: number;
  /** Presupuesto total de reintentos por llamada (cold start de Render: hasta ~90 s). */
  maxElapsedMs?: number;
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  /** Si un intento tarda mas que esto, se informa "waking". */
  wakingAfterMs?: number;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  query?: Record<string, string | number | undefined | null>;
  body?: unknown;
  signal?: AbortSignal;
}

export interface PullQuery {
  since?: string | null;
  collection?: Collection;
  limit?: number;
}

export interface PullResult {
  records: SyncRecord[];
  cursor: string;
  hasMore: boolean;
  /** Registros que el servidor devolvio pero no cumplen el contrato (se descartan). */
  invalid: number;
}

export interface PushResult {
  applied: string[];
  conflicts: SyncRecord[];
}

/** Lo que el motor de sync necesita del cliente (permite sustituirlo en pruebas). */
export interface SyncTransport {
  pull(query: PullQuery, opts?: { signal?: AbortSignal }): Promise<PullResult>;
  push(changes: SyncRecord[], opts?: { signal?: AbortSignal }): Promise<PushResult>;
  getApiStatus?(): ApiStatus;
  subscribeApiStatus?(listener: (status: ApiStatus) => void): () => void;
}

export interface ApiClient extends SyncTransport {
  request<T = unknown>(path: string, options?: RequestOptions): Promise<T>;
  getProfile(opts?: { signal?: AbortSignal }): Promise<Record<string, unknown>>;
  getApiStatus(): ApiStatus;
  subscribeApiStatus(listener: (status: ApiStatus) => void): () => void;
}

const RETRYABLE_STATUS = new Set([408, 500, 502, 503, 504]);

function defaultSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new ApiError('aborted', 'Petición cancelada.'));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new ApiError('aborted', 'Petición cancelada.'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/** `Retry-After` puede venir en segundos o como fecha HTTP. */
export function parseRetryAfter(header: string | null | undefined, nowMs: number): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, Math.round(seconds * 1000));
  const date = Date.parse(header);
  if (Number.isFinite(date)) return Math.max(0, date - nowMs);
  return undefined;
}

export function createApiClient(options: ApiClientOptions): ApiClient {
  const fetchImpl = options.fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const sleep = options.sleep ?? defaultSleep;
  const random = options.random ?? Math.random;
  const now = options.now ?? Date.now;
  const isOnline = options.isOnline ?? (() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false));
  const requestTimeoutMs = options.requestTimeoutMs ?? 20_000;
  const maxElapsedMs = options.maxElapsedMs ?? 90_000;
  const maxAttempts = options.maxAttempts ?? 10;
  const baseDelayMs = options.baseDelayMs ?? 1_000;
  const maxDelayMs = options.maxDelayMs ?? 15_000;
  const wakingAfterMs = options.wakingAfterMs ?? 4_000;

  let status: ApiStatus = 'idle';
  const listeners = new Set<(s: ApiStatus) => void>();
  const setStatus = (next: ApiStatus) => {
    if (status === next) return;
    status = next;
    listeners.forEach((l) => l(next));
  };

  /** Backoff exponencial con "equal jitter": entre la mitad y el total del tope. */
  const backoffDelay = (retryNumber: number): number => {
    const cap = Math.min(maxDelayMs, baseDelayMs * 2 ** (retryNumber - 1));
    return Math.round(cap / 2 + random() * (cap / 2));
  };

  const buildUrl = (path: string, query?: RequestOptions['query']): string => {
    const base = options.baseUrl ?? '';
    const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
    if (!query) return url;
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
    }
    const qs = params.toString();
    return qs ? `${url}?${qs}` : url;
  };

  async function attemptOnce(
    url: string,
    opts: RequestOptions,
    token: string,
  ): Promise<{ response: Response } | { error: ApiError }> {
    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, requestTimeoutMs);
    const wakingTimer = setTimeout(() => setStatus('waking'), wakingAfterMs);
    const onExternalAbort = () => controller.abort();
    if (opts.signal) {
      if (opts.signal.aborted) controller.abort();
      else opts.signal.addEventListener('abort', onExternalAbort, { once: true });
    }
    try {
      const headers: Record<string, string> = {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      };
      if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
      const response = await fetchImpl(url, {
        method: opts.method ?? 'GET',
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal: controller.signal,
      });
      return { response };
    } catch (cause) {
      if (opts.signal?.aborted) return { error: new ApiError('aborted', 'Petición cancelada.') };
      if (timedOut) {
        return { error: new ApiError('timeout', 'El servidor tardó demasiado en responder.') };
      }
      const message = cause instanceof Error ? cause.message : 'Error de red';
      return { error: new ApiError('network', `No se pudo conectar con el servidor (${message}).`) };
    } finally {
      clearTimeout(timeout);
      clearTimeout(wakingTimer);
      opts.signal?.removeEventListener('abort', onExternalAbort);
    }
  }

  async function request<T = unknown>(path: string, opts: RequestOptions = {}): Promise<T> {
    if (!options.baseUrl) {
      throw new ApiError('not_configured', 'La API no está configurada.');
    }
    const url = buildUrl(path, opts.query);
    const startedAt = now();
    let attempts = 0;
    let retries = 0;
    let refreshed = false;
    let lastError: ApiError | null = null;

    const fail = (error: ApiError): never => {
      setStatus('error');
      throw error;
    };

    for (;;) {
      if (opts.signal?.aborted) fail(new ApiError('aborted', 'Petición cancelada.', { attempts }));
      if (!isOnline()) {
        fail(new ApiError('offline', 'Sin conexión a internet.', { attempts }));
      }

      const token = await options.getAccessToken();
      if (!token) {
        fail(new ApiError('auth', 'No hay una sesión iniciada.', { status: 401, attempts }));
      }

      attempts++;
      const outcome = await attemptOnce(url, opts, token as string);

      let retryAfterMs: number | undefined;
      if ('response' in outcome) {
        const { response } = outcome;
        if (response.ok) {
          let payload: unknown = null;
          if (response.status !== 204) {
            try {
              payload = await response.json();
            } catch {
              fail(new ApiError('invalid_response', 'El servidor devolvió una respuesta no válida.', { status: response.status, attempts }));
            }
          }
          setStatus('ok');
          return payload as T;
        }

        if (response.status === 401) {
          if (!refreshed) {
            refreshed = true;
            const fresh = await options.refreshSession();
            if (fresh) {
              attempts--; // la renovacion no cuenta como reintento
              continue;
            }
          }
          await options.onAuthFailure();
          fail(new ApiError('auth', 'Tu sesión expiró. Vuelve a iniciar sesión.', { status: 401, attempts }));
        }

        let body: unknown;
        try {
          body = await response.clone().json();
        } catch {
          body = undefined;
        }

        if (response.status === 429) {
          retryAfterMs = parseRetryAfter(response.headers.get('Retry-After'), now());
          lastError = new ApiError('rate_limit', 'Demasiadas peticiones. Esperando para reintentar.', {
            status: 429,
            retryAfterMs,
            body,
            attempts,
          });
        } else if (RETRYABLE_STATUS.has(response.status)) {
          lastError = new ApiError('server', `El servidor no está disponible (${response.status}).`, {
            status: response.status,
            body,
            attempts,
          });
        } else {
          fail(new ApiError('client', `La petición fue rechazada (${response.status}).`, { status: response.status, body, attempts }));
        }
      } else {
        lastError = outcome.error;
        if (lastError.kind === 'aborted') fail(lastError);
      }

      // --- Decision de reintento -------------------------------------------------
      const error = lastError as ApiError;
      retries++;
      const delay = error.kind === 'rate_limit' && retryAfterMs !== undefined ? retryAfterMs : backoffDelay(retries);
      const elapsed = now() - startedAt;
      if (attempts >= maxAttempts || elapsed + delay > maxElapsedMs) {
        fail(
          new ApiError(error.kind, error.message, {
            status: error.status,
            retryAfterMs: error.retryAfterMs ?? (error.kind === 'rate_limit' ? delay : undefined),
            body: error.body,
            attempts,
          }),
        );
      }
      if (error.kind !== 'rate_limit') setStatus('waking');
      await sleep(delay, opts.signal);
    }
  }

  async function pull(query: PullQuery, o: { signal?: AbortSignal } = {}): Promise<PullResult> {
    const raw = await request<unknown>('/sync/pull', {
      query: { since: query.since ?? undefined, collection: query.collection, limit: query.limit },
      signal: o.signal,
    });
    const body = (raw ?? {}) as { records?: unknown; cursor?: unknown; hasMore?: unknown };
    if (!Array.isArray(body.records) || typeof body.cursor !== 'string') {
      throw new ApiError('invalid_response', 'La respuesta de sincronización no tiene el formato esperado.');
    }
    const records: SyncRecord[] = [];
    let invalid = 0;
    for (const candidate of body.records) {
      const parsed = SyncRecordSchema.safeParse(candidate);
      if (parsed.success) records.push(parsed.data);
      else invalid++;
    }
    return { records, cursor: body.cursor, hasMore: body.hasMore === true, invalid };
  }

  async function push(changes: SyncRecord[], o: { signal?: AbortSignal } = {}): Promise<PushResult> {
    const raw = await request<unknown>('/sync/push', { method: 'POST', body: { changes }, signal: o.signal });
    const body = (raw ?? {}) as { applied?: unknown; conflicts?: unknown };
    // Parseo tolerante: un conflicto mal formado no debe tumbar toda la respuesta.
    const conflictsRaw = Array.isArray(body.conflicts) ? body.conflicts : [];
    const conflicts: SyncRecord[] = [];
    for (const candidate of conflictsRaw) {
      const parsed = SyncRecordSchema.safeParse(candidate);
      if (parsed.success) conflicts.push(parsed.data);
    }
    const shape = SyncPushResponseSchema.pick({ applied: true }).safeParse({ applied: body.applied });
    if (!shape.success) {
      throw new ApiError('invalid_response', 'La respuesta de subida no tiene el formato esperado.');
    }
    return { applied: shape.data.applied, conflicts };
  }

  return {
    request,
    pull,
    push,
    getProfile: (o = {}) => request<Record<string, unknown>>('/profile', { signal: o.signal }),
    getApiStatus: () => status,
    subscribeApiStatus: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

// --- Instancia por defecto (Supabase + VITE_API_URL) ---------------------------

let defaultClient: ApiClient | null = null;
let defaultClientBase: string | null = null;

/** Cliente de la app. Devuelve null si falta `VITE_API_URL`. */
export function getApiClient(): ApiClient | null {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) return null;
  if (!defaultClient || defaultClientBase !== baseUrl) {
    defaultClientBase = baseUrl;
    defaultClient = createApiClient({
      baseUrl,
      getAccessToken,
      refreshSession: refreshAccessToken,
      onAuthFailure: () => signOut().catch(() => undefined),
    });
  }
  return defaultClient;
}
