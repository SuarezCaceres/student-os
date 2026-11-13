import { ExecutionContext, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { generateKeyPair } from 'jose';
import { createTestKeyPair, startJwksServer, type JwksServer } from '../../test/helpers/jwks-server';
import type { Env } from '../config/env.schema';
import { JwtVerifierService } from './jwt-verifier.service';
import { Public } from './public.decorator';
import { SupabaseJwtGuard } from './supabase-jwt.guard';
import type { AuthenticatedRequest } from './auth.types';

class ProtectedController {
  handler(): void {}
}

@Public()
class PublicController {
  handler(): void {}
}

class MixedController {
  @Public()
  open(): void {}
  closed(): void {}
}

function makeContext(
  authorization: string | undefined,
  target: { cls: new () => object; method: string } = { cls: ProtectedController, method: 'handler' },
): { context: ExecutionContext; request: AuthenticatedRequest } {
  const request = { headers: authorization === undefined ? {} : { authorization } } as AuthenticatedRequest;
  const prototype = target.cls.prototype as Record<string, () => void>;
  const context = {
    getType: () => 'http',
    getHandler: () => prototype[target.method],
    getClass: () => target.cls,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
}

describe('SupabaseJwtGuard', () => {
  let jwks: JwksServer;
  let guard: SupabaseJwtGuard;

  beforeAll(async () => {
    Logger.overrideLogger(false); // silencia el DEBUG de los rechazos esperados
    jwks = await startJwksServer();
    const values: Record<string, unknown> = {
      SUPABASE_URL: jwks.url,
      SUPABASE_JWT_AUDIENCE: 'authenticated',
    };
    const config = { get: (key: string) => values[key] } as unknown as ConfigService<Env, true>;
    guard = new SupabaseJwtGuard(new Reflector(), new JwtVerifierService(config));
  });

  afterAll(async () => {
    await jwks.close();
  });

  it('acepta un token valido y expone id (sub) y email', async () => {
    const token = await jwks.sign({ sub: '22222222-2222-4222-8222-222222222222', email: 'sergio@example.com' });
    const { context, request } = makeContext(`Bearer ${token}`);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual({ id: '22222222-2222-4222-8222-222222222222', email: 'sergio@example.com' });
  });

  it('descarga el JWKS por HTTP y lo cachea entre peticiones', async () => {
    const before = jwks.requestCount();
    for (let i = 0; i < 3; i += 1) {
      const token = await jwks.sign();
      await guard.canActivate(makeContext(`Bearer ${token}`).context);
    }
    expect(jwks.requestCount() - before).toBeLessThanOrEqual(1);
  });

  it('rechaza un token expirado', async () => {
    const token = await jwks.sign({ expiresInSeconds: -3600 });
    await expect(guard.canActivate(makeContext(`Bearer ${token}`).context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rechaza un token con audiencia incorrecta', async () => {
    const token = await jwks.sign({ audience: 'otra-audiencia' });
    await expect(guard.canActivate(makeContext(`Bearer ${token}`).context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rechaza un token con issuer incorrecto o ausente', async () => {
    const wrongIssuer = await jwks.sign({ issuer: 'https://evil.example.com/auth/v1' });
    const noIssuer = await jwks.sign({ issuer: null });
    await expect(guard.canActivate(makeContext(`Bearer ${wrongIssuer}`).context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(guard.canActivate(makeContext(`Bearer ${noIssuer}`).context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rechaza un token firmado por otra clave (aunque use el mismo kid)', async () => {
    const attacker = await generateKeyPair('ES256');
    const forged = await jwks.sign({ privateKey: attacker.privateKey });
    await expect(guard.canActivate(makeContext(`Bearer ${forged}`).context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rechaza un token con un kid que no esta en el JWKS', async () => {
    const other = await createTestKeyPair('clave-desconocida');
    const token = await jwks.sign({ privateKey: other.privateKey, kid: other.kid });
    await expect(guard.canActivate(makeContext(`Bearer ${token}`).context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rechaza algoritmos simetricos (HS256) aunque la firma sea coherente', async () => {
    const { SignJWT } = await import('jose');
    const secret = new TextEncoder().encode('un-secreto-compartido-de-prueba-123456');
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256', kid: jwks.keyPair.kid })
      .setSubject('11111111-1111-4111-8111-111111111111')
      .setAudience('authenticated')
      .setIssuer(jwks.issuer)
      .setExpirationTime('1h')
      .sign(secret);
    await expect(guard.canActivate(makeContext(`Bearer ${token}`).context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rechaza cabeceras ausentes o mal formadas', async () => {
    for (const header of [undefined, '', 'Bearer', 'Basic abc', 'Bearer a b', 'Bearer no-es-un-jwt']) {
      await expect(guard.canActivate(makeContext(header).context)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    }
  });

  it('el 401 no filtra el motivo interno', async () => {
    const token = await jwks.sign({ expiresInSeconds: -3600 });
    const error = await guard.canActivate(makeContext(`Bearer ${token}`).context).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UnauthorizedException);
    expect((error as UnauthorizedException).message).toBe('Token invalido o expirado');
  });

  it('deja pasar rutas @Public() (metodo o clase) sin token', async () => {
    await expect(
      guard.canActivate(makeContext(undefined, { cls: PublicController, method: 'handler' }).context),
    ).resolves.toBe(true);
    await expect(
      guard.canActivate(makeContext(undefined, { cls: MixedController, method: 'open' }).context),
    ).resolves.toBe(true);
    await expect(
      guard.canActivate(makeContext(undefined, { cls: MixedController, method: 'closed' }).context),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
