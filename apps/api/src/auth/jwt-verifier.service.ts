import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import type { Env } from '../config/env.schema';
import type { AuthUser } from './auth.types';

/**
 * Algoritmos asimetricos admitidos (claves de firma asimetricas de Supabase). Se excluyen los
 * simetricos (HS*) a proposito: evita ataques de confusion de algoritmo con la clave publica.
 */
const ALLOWED_ALGORITHMS = ['ES256', 'RS256', 'EdDSA'];

@Injectable()
export class JwtVerifierService {
  readonly issuer: string;
  private readonly audience: string;
  private readonly jwks: JWTVerifyGetKey;

  constructor(config: ConfigService<Env, true>) {
    const supabaseUrl = config.get('SUPABASE_URL', { infer: true });
    this.issuer = `${supabaseUrl}/auth/v1`;
    this.audience = config.get('SUPABASE_JWT_AUDIENCE', { infer: true });
    // jose cachea el JWKS en memoria y solo vuelve a pedirlo si llega un `kid` desconocido
    // (rotacion de claves), respetando `cooldownDuration` para no ser un vector de DoS.
    this.jwks = createRemoteJWKSet(new URL(`${this.issuer}/.well-known/jwks.json`), {
      timeoutDuration: 5_000,
      cooldownDuration: 30_000,
      cacheMaxAge: 10 * 60_000,
    });
  }

  /**
   * Verifica firma (JWKS), `iss`, `aud` y expiracion. Lanza si algo no cuadra.
   * El mensaje del error es interno: el guard lo traduce a un 401 generico.
   */
  async verify(token: string): Promise<AuthUser> {
    const { payload } = await jwtVerify(token, this.jwks, {
      issuer: this.issuer,
      audience: this.audience,
      algorithms: ALLOWED_ALGORITHMS,
      clockTolerance: 5,
      requiredClaims: ['sub', 'exp'],
    });

    const sub = payload.sub;
    if (typeof sub !== 'string' || sub.length === 0) {
      throw new Error('Token sin sub');
    }
    const email = typeof payload.email === 'string' ? payload.email : undefined;
    return { id: sub, email };
  }
}
