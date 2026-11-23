import { describe, expect, it, vi } from 'vitest';
import { ApiError, createApiClient, parseRetryAfter, type ApiStatus } from './api';

function json(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' }, ...init });
}

function setup(responses: Array<() => Response | Promise<Response>>, extra: Partial<Parameters<typeof createApiClient>[0]> = {}) {
  const calls: Array<{ url: string; headers: Headers }> = [];
  const delays: number[] = [];
  const queue = [...responses];
  const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), headers: new Headers(init?.headers) });
    const next = queue.shift();
    if (!next) throw new Error('sin respuestas simuladas');
    return next();
  });
  const statuses: ApiStatus[] = [];
  const client = createApiClient({
    baseUrl: 'http://api.test',
    getAccessToken: async () => 'tok',
    refreshSession: async () => null,
    onAuthFailure: () => undefined,
    fetchImpl: fetchImpl as unknown as typeof fetch,
    sleep: async (ms) => {
      delays.push(ms);
    },
    random: () => 0.5,
    isOnline: () => true,
    ...extra,
  });
  client.subscribeApiStatus((s) => statuses.push(s));
  return { client, calls, delays, statuses, fetchImpl };
}

describe('cliente API', () => {
  it('envia el token de Supabase y marca el estado ok', async () => {
    const { client, calls, statuses } = setup([() => json({ id: 'u1' })]);
    await expect(client.getProfile()).resolves.toEqual({ id: 'u1' });
    expect(calls[0].headers.get('Authorization')).toBe('Bearer tok');
    expect(calls[0].url).toBe('http://api.test/profile');
    expect(statuses).toEqual(['ok']);
  });

  it('cold start: reintenta con backoff exponencial y jitter, pasa por "waking" y termina en "ok"', async () => {
    const { client, delays, statuses, calls } = setup([
      () => new Response('', { status: 503 }),
      () => new Response('', { status: 502 }),
      () => new Response('', { status: 503 }),
      () => json({ ok: true }),
    ]);
    await expect(client.request('/health')).resolves.toEqual({ ok: true });
    expect(calls).toHaveLength(4);
    // random = 0.5 => 0.75 * tope: 1000 -> 750, 2000 -> 1500, 4000 -> 3000
    expect(delays).toEqual([750, 1500, 3000]);
    expect(statuses).toEqual(['waking', 'ok']);
  });

  it('un timeout por intento cuenta como transitorio y se reintenta', async () => {
    const hang = () =>
      new Promise<Response>(() => {
        /* nunca responde */
      });
    // fetch que respeta la senal de aborto
    const fetchImpl = vi
      .fn()
      .mockImplementationOnce((_u: string, init: RequestInit) => new Promise((_, reject) => init.signal!.addEventListener('abort', () => reject(new DOMException('x', 'AbortError')))))
      .mockImplementationOnce(async () => json({ ok: 1 }));
    void hang;
    const delays: number[] = [];
    const client = createApiClient({
      baseUrl: 'http://api.test',
      getAccessToken: async () => 'tok',
      refreshSession: async () => null,
      onAuthFailure: () => undefined,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep: async (ms) => {
        delays.push(ms);
      },
      random: () => 0,
      requestTimeoutMs: 20,
      isOnline: () => true,
    });
    await expect(client.request('/x')).resolves.toEqual({ ok: 1 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(delays).toEqual([500]);
  });

  it('se rinde al agotar el presupuesto y deja el estado en "error" con error tipado', async () => {
    let t = 0;
    const { client, statuses } = setup(
      Array.from({ length: 20 }, () => () => new Response('', { status: 503 })),
      { maxElapsedMs: 5_000, now: () => (t += 1000) },
    );
    await expect(client.request('/x')).rejects.toMatchObject({ name: 'ApiError', kind: 'server', status: 503 });
    expect(statuses.at(-1)).toBe('error');
  });

  it('401: renueva la sesion una vez y repite con el token nuevo', async () => {
    let token = 'viejo';
    const { client, calls } = setup([() => new Response('', { status: 401 }), () => json({ ok: true })], {
      getAccessToken: async () => token,
      refreshSession: async () => (token = 'nuevo'),
    });
    await expect(client.request('/x')).resolves.toEqual({ ok: true });
    expect(calls.map((c) => c.headers.get('Authorization'))).toEqual(['Bearer viejo', 'Bearer nuevo']);
  });

  it('401 tras renovar: cierra la sesion y lanza error de autenticacion', async () => {
    const onAuthFailure = vi.fn();
    const { client } = setup([() => new Response('', { status: 401 }), () => new Response('', { status: 401 })], {
      refreshSession: async () => 'otro',
      onAuthFailure,
    });
    await expect(client.request('/x')).rejects.toMatchObject({ kind: 'auth' });
    expect(onAuthFailure).toHaveBeenCalledTimes(1);
  });

  it('401 sin posibilidad de renovar cierra la sesion de inmediato', async () => {
    const onAuthFailure = vi.fn();
    const { client, calls } = setup([() => new Response('', { status: 401 })], { onAuthFailure });
    await expect(client.request('/x')).rejects.toBeInstanceOf(ApiError);
    expect(calls).toHaveLength(1);
    expect(onAuthFailure).toHaveBeenCalledTimes(1);
  });

  it('429: respeta Retry-After (segundos)', async () => {
    const { client, delays } = setup([
      () => new Response('', { status: 429, headers: { 'Retry-After': '7' } }),
      () => json({ ok: true }),
    ]);
    await client.request('/x');
    expect(delays).toEqual([7000]);
  });

  it('429 con espera mayor al presupuesto: error rate_limit con retryAfterMs', async () => {
    const { client } = setup([() => new Response('', { status: 429, headers: { 'Retry-After': '300' } })]);
    await expect(client.request('/x')).rejects.toMatchObject({ kind: 'rate_limit', retryAfterMs: 300_000 });
  });

  it('4xx de cliente (400/413/422) no se reintenta', async () => {
    for (const status of [400, 413, 422]) {
      const { client, calls } = setup([() => new Response(JSON.stringify({ message: 'no' }), { status })]);
      await expect(client.request('/x')).rejects.toMatchObject({ kind: 'client', status });
      expect(calls).toHaveLength(1);
    }
  });

  it('sin conexion falla rapido con kind offline y sin llamar a la red', async () => {
    const { client, fetchImpl } = setup([], { isOnline: () => false });
    await expect(client.request('/x')).rejects.toMatchObject({ kind: 'offline' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('sin VITE_API_URL: error not_configured', async () => {
    const { client } = setup([], { baseUrl: null });
    await expect(client.request('/x')).rejects.toMatchObject({ kind: 'not_configured' });
  });

  it('pull descarta registros que no cumplen el contrato y reporta cuantos', async () => {
    const good = { id: 'k1', collection: 'kanban', data: { id: 'k1', title: 'a', status: 'todo', category: 'personal', priority: 'media', createdAt: '2026-11-01' }, updatedAt: '2026-11-13T10:00:00.000Z', deletedAt: null, rev: 1 };
    const bad = { ...good, id: 'k2', data: { id: 'k2' } };
    const { client, calls } = setup([() => json({ records: [good, bad], cursor: '2', hasMore: true })]);
    const res = await client.pull({ since: '1', limit: 50 });
    expect(res.records.map((r) => r.id)).toEqual(['k1']);
    expect(res.invalid).toBe(1);
    expect(res.hasMore).toBe(true);
    expect(calls[0].url).toBe('http://api.test/sync/pull?since=1&limit=50');
  });

  it('parseRetryAfter acepta segundos y fechas HTTP', () => {
    expect(parseRetryAfter('3', 0)).toBe(3000);
    expect(parseRetryAfter(new Date(10_000).toUTCString(), 4_000)).toBe(6000);
    expect(parseRetryAfter(null, 0)).toBeUndefined();
  });
});
