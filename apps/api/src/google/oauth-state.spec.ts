import {
  generateNonce,
  generatePkcePair,
  InvalidStateError,
  OAuthStateSigner,
  pkceChallengeFor,
} from './oauth-state';
import { resolveReturnUrl, withGoogleResult } from './return-url';

const SECRET = 'clave-de-prueba-para-firmar-el-state-0123456789';
const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';
const NOW = Date.UTC(2026, 10, 13, 12, 0, 0);

function reason(fn: () => unknown): string | null {
  try {
    fn();
    return null;
  } catch (error) {
    return error instanceof InvalidStateError ? error.reason : `otro:${String(error)}`;
  }
}

describe('OAuthStateSigner', () => {
  const signer = new OAuthStateSigner(SECRET);
  const payload = { userId: USER_A, nonce: 'nonce-123', expiresAtMs: NOW + 600_000 };

  it('un state valido se verifica y devuelve usuario, nonce y expiracion', () => {
    const state = signer.sign(payload);
    expect(signer.verify(state, { now: NOW })).toEqual(payload);
    expect(signer.verify(state, { now: NOW, expectedUserId: USER_A })).toEqual(payload);
  });

  it('expirado: se rechaza exactamente en el instante de expiracion y despues', () => {
    const state = signer.sign(payload);
    expect(reason(() => signer.verify(state, { now: payload.expiresAtMs - 1 }))).toBeNull();
    expect(reason(() => signer.verify(state, { now: payload.expiresAtMs }))).toBe('expired');
    expect(reason(() => signer.verify(state, { now: payload.expiresAtMs + 1 }))).toBe('expired');
  });

  it('ligado al usuario: si se espera otro usuario, se rechaza', () => {
    const state = signer.sign(payload);
    expect(reason(() => signer.verify(state, { now: NOW, expectedUserId: USER_B }))).toBe('wrong_user');
  });

  it('alterado: cambiar el payload (p. ej. el userId) invalida la firma', () => {
    const state = signer.sign(payload);
    const [body, signature] = state.split('.');
    const forged = Buffer.from(JSON.stringify({ v: 1, u: USER_B, n: payload.nonce, e: payload.expiresAtMs })).toString('base64url');
    expect(reason(() => signer.verify(`${forged}.${signature}`, { now: NOW }))).toBe('bad_signature');
    // Alargar la vida del state tampoco funciona.
    const longer = Buffer.from(JSON.stringify({ v: 1, u: USER_A, n: payload.nonce, e: NOW + 99_999_999 })).toString('base64url');
    expect(reason(() => signer.verify(`${longer}.${signature}`, { now: NOW }))).toBe('bad_signature');
    // Y cambiar la firma.
    const flipped = `${signature.slice(0, -1)}${signature.endsWith('A') ? 'B' : 'A'}`;
    expect(reason(() => signer.verify(`${body}.${flipped}`, { now: NOW }))).toBe('bad_signature');
  });

  it('firmado con otra clave: se rechaza', () => {
    const other = new OAuthStateSigner('otra-clave-de-prueba-completamente-distinta-9876543210');
    expect(reason(() => signer.verify(other.sign(payload), { now: NOW }))).toBe('bad_signature');
  });

  it('mal formado: vacio, sin punto, partes vacias, demasiado largo, tipos incorrectos', () => {
    for (const bad of ['', 'abc', '.', 'a.', '.b', 'a.b.c', 'x'.repeat(2000)]) {
      expect(['malformed', 'bad_signature']).toContain(reason(() => signer.verify(bad, { now: NOW })));
    }
    expect(reason(() => signer.verify(undefined as unknown as string, { now: NOW }))).toBe('malformed');
  });

  it('exige clave de >= 32 bytes', () => {
    expect(() => new OAuthStateSigner('corta')).toThrow();
  });

  it('nonces unicos', () => {
    expect(new Set(Array.from({ length: 500 }, () => generateNonce())).size).toBe(500);
  });
});

describe('PKCE (RFC 7636)', () => {
  it('coincide con el vector de prueba del Apendice B del RFC', () => {
    expect(pkceChallengeFor('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    );
  });

  it('el verifier tiene 43-128 caracteres del alfabeto permitido y el challenge es su S256', () => {
    const { verifier, challenge } = generatePkcePair();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(verifier.length).toBeLessThanOrEqual(128);
    expect(verifier).toMatch(/^[A-Za-z0-9\-._~]+$/);
    expect(challenge).toBe(pkceChallengeFor(verifier));
    expect(challenge).not.toBe(verifier);
    expect(challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('cada par es distinto', () => {
    expect(new Set(Array.from({ length: 200 }, () => generatePkcePair().verifier)).size).toBe(200);
  });
});

describe('resolveReturnUrl (sin open redirect)', () => {
  const allowed = ['https://student-os.example.com', 'http://localhost:5173'];

  it('acepta origenes de la lista blanca y conserva solo origen + ruta', () => {
    expect(resolveReturnUrl('https://student-os.example.com/', allowed)).toBe('https://student-os.example.com/');
    expect(resolveReturnUrl('https://student-os.example.com/app?x=1#h', allowed)).toBe('https://student-os.example.com/app');
    expect(resolveReturnUrl('http://localhost:5173/horario', allowed)).toBe('http://localhost:5173/horario');
  });

  it('sin candidato usa el primer origen permitido', () => {
    expect(resolveReturnUrl(undefined, allowed)).toBe('https://student-os.example.com/');
    expect(resolveReturnUrl('', allowed)).toBe('https://student-os.example.com/');
  });

  it.each([
    'https://evil.com/',
    'https://student-os.example.com.evil.com/',
    'https://evil.com/https://student-os.example.com',
    'https://student-os.example.com@evil.com/',
    'https://student-os.example.com:8443/',
    'http://student-os.example.com/',
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    '//evil.com',
    '/solo-ruta',
    'https:evil.com',
    'https://student-os.example.com\\@evil.com',
    ' https://evil.com',
    'https://student-os.example.com/\nSet-Cookie:a=b',
    'https://user:pass@student-os.example.com/',
    'ftp://student-os.example.com/',
    'no es una url',
  ])('bloquea %j', (candidate) => {
    expect(resolveReturnUrl(candidate, allowed)).toBeNull();
  });

  it('sin origenes permitidos nunca devuelve nada', () => {
    expect(resolveReturnUrl('https://student-os.example.com/', [])).toBeNull();
    expect(resolveReturnUrl(undefined, [])).toBeNull();
  });

  it('una ruta con barras dobles se normaliza dentro del mismo origen', () => {
    expect(resolveReturnUrl('https://student-os.example.com//evil.com', allowed)).toBe('https://student-os.example.com/evil.com');
  });

  it('withGoogleResult anade el resultado y el motivo', () => {
    expect(withGoogleResult('https://student-os.example.com/app', 'connected')).toBe(
      'https://student-os.example.com/app?google=connected',
    );
    expect(withGoogleResult('https://student-os.example.com/', 'error', 'denied')).toBe(
      'https://student-os.example.com/?google=error&reason=denied',
    );
  });
});
