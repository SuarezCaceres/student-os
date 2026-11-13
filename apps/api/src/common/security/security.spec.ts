import { of } from 'rxjs';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { ThrottlerModuleOptions, ThrottlerStorage } from '@nestjs/throttler';
import { redactPii, safeErrorSummary, userRef } from './pii';
import { applyExtraSecurityHeaders, SecurityHeadersInterceptor } from './security-headers.interceptor';
import { USER_THROTTLER, UserThrottlerGuard } from './user-throttler.guard';

describe('redactPii', () => {
  it('elimina correos, JWT, Bearer y tokens de Google', () => {
    const jwt = 'eyJhbGciOiJFUzI1NiJ9.eyJzdWIiOiIxMjM0NSJ9.c2lnbmF0dXJl';
    const text = `usuario ana.perez+x@uni.edu.co token ${jwt} Authorization: Bearer abc.def-ghi ya29.A0Token_x y 1//0gAbCdEfGhIjKlMnOpQrStUv`;
    const out = redactPii(text);
    expect(out).not.toMatch(/ana\.perez|eyJ|abc\.def|ya29|1\/\/0g/);
    expect(out).toContain('[email]');
    expect(out).toContain('Bearer [token]');
  });

  it('deja intacto un texto sin datos personales', () => {
    expect(redactPii('Cuota de registros excedida: maximo 5000')).toBe('Cuota de registros excedida: maximo 5000');
  });
});

describe('userRef / safeErrorSummary', () => {
  it('userRef es estable, corto y no contiene el id', () => {
    const id = '11111111-1111-4111-8111-111111111111';
    expect(userRef(id)).toBe(userRef(id));
    expect(userRef(id)).toMatch(/^[0-9a-f]{8}$/);
    expect(userRef(id)).not.toContain('1111-');
    expect(userRef(id)).not.toBe(userRef('otro'));
  });

  it('safeErrorSummary nunca devuelve el mensaje', () => {
    expect(safeErrorSummary(new TypeError('ana@example.com'))).toBe('TypeError');
    expect(safeErrorSummary(Object.assign(new Error('x@y.co'), { code: 'P2002' }))).toBe('Error (P2002)');
    expect(safeErrorSummary(Object.assign(new Error('x'), { code: 'con espacios y @' }))).toBe('Error');
    expect(safeErrorSummary('texto')).toBe('Error');
  });
});

describe('SecurityHeadersInterceptor', () => {
  function fakeResponse(initial: Record<string, string> = {}) {
    const headers = new Map(Object.entries(initial));
    return {
      headers,
      setHeader: (name: string, value: string) => void headers.set(name, value),
      getHeader: (name: string) => headers.get(name),
    };
  }

  it('anade las cabeceras y no pisa un Cache-Control propio de la ruta', () => {
    const res = fakeResponse({ 'Cache-Control': 'private, max-age=60' });
    applyExtraSecurityHeaders(res as never);
    expect(res.headers.get('Cache-Control')).toBe('private, max-age=60');
    expect(res.headers.get('Permissions-Policy')).toContain('camera=()');
    expect(res.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
  });

  it('pone Cache-Control: no-store por defecto y no altera el cuerpo', async () => {
    const res = fakeResponse();
    const context = {
      getType: () => 'http',
      switchToHttp: () => ({ getResponse: () => res }),
    } as unknown as ExecutionContext;
    const handler: CallHandler = { handle: () => of({ ok: true }) };
    const result = await new Promise((resolve) => new SecurityHeadersInterceptor().intercept(context, handler).subscribe(resolve));
    expect(result).toEqual({ ok: true });
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });
});

describe('UserThrottlerGuard', () => {
  class Probe extends UserThrottlerGuard {
    track(req: Record<string, unknown>) {
      return this.getTracker(req);
    }
    get configured() {
      return this.throttlers;
    }
    header(res: Record<string, unknown>, name: string, value: string | number) {
      this.setResponseHeader(res, name, value);
    }
  }
  const storage = {} as ThrottlerStorage;
  const options: ThrottlerModuleOptions = [{ name: 'default', ttl: 60_000, limit: 120 }];
  const probe = new Probe(options, storage, new Reflector());

  beforeAll(async () => {
    await probe.onModuleInit();
  });

  it('el tracker es el usuario autenticado; sin usuario, la IP', async () => {
    await expect(probe.track({ user: { id: 'abc' }, ip: '1.2.3.4' })).resolves.toBe('user:abc');
    await expect(probe.track({ ip: '1.2.3.4' })).resolves.toBe('ip:1.2.3.4');
    await expect(probe.track({ user: { id: '' }, ip: '1.2.3.4' })).resolves.toBe('ip:1.2.3.4');
  });

  it('nunca confia en un token sin verificar: ignora Authorization y cuerpo', async () => {
    const tracker = await probe.track({
      headers: { authorization: 'Bearer eyJ.fake.token' },
      body: { userId: 'victima' },
      query: { userId: 'victima' },
      ip: '9.9.9.9',
    });
    expect(tracker).toBe('ip:9.9.9.9');
  });

  it('usa su propio limitador, ignorando el del modulo anfitrion', () => {
    expect(probe.configured.map((t) => t.name)).toEqual([USER_THROTTLER]);
  });

  it('emite Retry-After estandar en lugar de Retry-After-user', () => {
    const headers: Record<string, string | number> = {};
    const res = { setHeader: (n: string, v: string | number) => void (headers[n] = v) };
    probe.header(res, 'Retry-After-user', 30);
    probe.header(res, 'X-RateLimit-Limit-user', 5);
    expect(headers).toEqual({ 'Retry-After': 30, 'X-RateLimit-Limit-user': 5 });
  });
});
