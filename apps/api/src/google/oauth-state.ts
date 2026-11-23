import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { deriveKey } from './token-cipher';

/** Par PKCE (RFC 7636) con metodo S256. */
export interface PkcePair {
  verifier: string;
  challenge: string;
}

export function pkceChallengeFor(verifier: string): string {
  return createHash('sha256').update(verifier, 'ascii').digest('base64url');
}

/** Verifier de 43 caracteres (32 bytes aleatorios en base64url), dentro del rango 43-128 del RFC. */
export function generatePkcePair(): PkcePair {
  const verifier = randomBytes(32).toString('base64url');
  return { verifier, challenge: pkceChallengeFor(verifier) };
}

export function generateNonce(): string {
  return randomBytes(24).toString('base64url');
}

export type StateFailureReason = 'malformed' | 'bad_signature' | 'expired' | 'wrong_user';

export class InvalidStateError extends Error {
  constructor(readonly reason: StateFailureReason) {
    super(`state invalido (${reason})`);
    this.name = 'InvalidStateError';
  }
}

export interface StatePayload {
  userId: string;
  nonce: string;
  expiresAtMs: number;
}

interface WirePayload {
  v: 1;
  u: string;
  n: string;
  e: number;
}

/**
 * Firma/verifica el `state` del flujo OAuth: `base64url(json).base64url(hmac-sha256)`.
 * Liga el state al usuario (`u`), a un nonce de un solo uso (`n`, clave de la fila con el verifier PKCE) y a una
 * expiracion (`e`). Cualquier alteracion invalida la firma. La clave HMAC se deriva con HKDF de GOOGLE_TOKEN_ENC_KEY
 * con un `info` distinto al del cifrado.
 */
export class OAuthStateSigner {
  private readonly key: Buffer;

  constructor(secret: string) {
    this.key = deriveKey(secret, 'student-os/google/state-hmac');
  }

  sign(payload: StatePayload): string {
    const wire: WirePayload = { v: 1, u: payload.userId, n: payload.nonce, e: payload.expiresAtMs };
    const body = Buffer.from(JSON.stringify(wire), 'utf8').toString('base64url');
    return `${body}.${this.mac(body)}`;
  }

  verify(state: string, options: { now: number; expectedUserId?: string }): StatePayload {
    if (typeof state !== 'string' || state.length > 1024) throw new InvalidStateError('malformed');
    const parts = state.split('.');
    if (parts.length !== 2 || parts[0] === '' || parts[1] === '') throw new InvalidStateError('malformed');
    const [body, signature] = parts;

    const expected = Buffer.from(this.mac(body), 'utf8');
    const given = Buffer.from(signature, 'utf8');
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
      throw new InvalidStateError('bad_signature');
    }

    let wire: Partial<WirePayload>;
    try {
      wire = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Partial<WirePayload>;
    } catch {
      throw new InvalidStateError('malformed');
    }
    if (
      wire.v !== 1 ||
      typeof wire.u !== 'string' ||
      typeof wire.n !== 'string' ||
      typeof wire.e !== 'number' ||
      !Number.isFinite(wire.e)
    ) {
      throw new InvalidStateError('malformed');
    }
    if (options.now >= wire.e) throw new InvalidStateError('expired');
    if (options.expectedUserId !== undefined && options.expectedUserId !== wire.u) {
      throw new InvalidStateError('wrong_user');
    }
    return { userId: wire.u, nonce: wire.n, expiresAtMs: wire.e };
  }

  private mac(body: string): string {
    return createHmac('sha256', this.key).update(body, 'utf8').digest('base64url');
  }
}
