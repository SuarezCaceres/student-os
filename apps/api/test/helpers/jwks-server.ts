import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { exportJWK, generateKeyPair, SignJWT, type JWK, type KeyLike } from 'jose';

export interface SignOptions {
  sub?: string;
  email?: string;
  audience?: string;
  /** Si es `null`, no se firma con `iss`. */
  issuer?: string | null;
  /** Segundos desde ahora (negativo = ya expirado). */
  expiresInSeconds?: number;
  /** Clave privada alterna (token firmado por otra clave). */
  privateKey?: KeyLike;
  kid?: string;
  alg?: string;
}

export interface TestKeyPair {
  privateKey: KeyLike;
  publicJwk: JWK;
  kid: string;
}

export async function createTestKeyPair(kid: string, alg = 'ES256'): Promise<TestKeyPair> {
  const { publicKey, privateKey } = await generateKeyPair(alg, { extractable: true });
  const publicJwk = await exportJWK(publicKey);
  return { privateKey, publicJwk: { ...publicJwk, kid, alg, use: 'sig' }, kid };
}

export interface JwksServer {
  /** Equivale a `SUPABASE_URL` (sin barra final). */
  url: string;
  issuer: string;
  keyPair: TestKeyPair;
  requestCount: () => number;
  sign: (options?: SignOptions) => Promise<string>;
  close: () => Promise<void>;
}

/**
 * Levanta un servidor HTTP local que sirve `/auth/v1/.well-known/jwks.json` con una clave de
 * prueba. Asi se ejercita `createRemoteJWKSet` real (descarga HTTP + cache) sin red externa.
 */
export async function startJwksServer(): Promise<JwksServer> {
  const keyPair = await createTestKeyPair('test-key-1');
  let requests = 0;

  const server: Server = createServer((req, res) => {
    if (req.url === '/auth/v1/.well-known/jwks.json') {
      requests += 1;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ keys: [keyPair.publicJwk] }));
      return;
    }
    res.statusCode = 404;
    res.end();
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  const url = `http://127.0.0.1:${port}`;
  const issuer = `${url}/auth/v1`;

  const sign = async (options: SignOptions = {}): Promise<string> => {
    const alg = options.alg ?? 'ES256';
    const jwt = new SignJWT({ email: options.email ?? 'ana@example.com', role: 'authenticated' })
      .setProtectedHeader({ alg, kid: options.kid ?? keyPair.kid })
      .setSubject(options.sub ?? '11111111-1111-4111-8111-111111111111')
      .setAudience(options.audience ?? 'authenticated')
      .setIssuedAt()
      .setExpirationTime(Math.floor(Date.now() / 1000) + (options.expiresInSeconds ?? 3600));
    if (options.issuer !== null) {
      jwt.setIssuer(options.issuer ?? issuer);
    }
    return jwt.sign(options.privateKey ?? keyPair.privateKey);
  };

  return {
    url,
    issuer,
    keyPair,
    requestCount: () => requests,
    sign,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeAllConnections();
      }),
  };
}
