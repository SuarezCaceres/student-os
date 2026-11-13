import { refreshTokenAad, TokenCipher, TokenDecryptionError, WeakEncryptionKeyError } from './token-cipher';

const KEY_1 = 'primera-clave-de-prueba-con-mas-de-32-caracteres-ok';
const KEY_2 = 'segunda-clave-de-prueba-totalmente-distinta-123456';
const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';
const SECRET = '1//0g-refresh-token-falso-de-prueba_ABC123';

describe('TokenCipher (AES-256-GCM)', () => {
  const cipher = new TokenCipher([{ version: 1, secret: KEY_1 }]);

  it('round-trip: descifra exactamente lo cifrado (incluye unicode)', () => {
    for (const text of [SECRET, '', 'ñandú ✓ \u{1F680}', 'x'.repeat(5000)]) {
      const { blob } = cipher.encrypt(text, refreshTokenAad(USER_A));
      expect(cipher.decrypt(blob, refreshTokenAad(USER_A))).toBe(text);
    }
  });

  it('el blob no contiene el texto en claro y lleva version, IV, tag y ciphertext', () => {
    const { blob, keyVersion } = cipher.encrypt(SECRET, refreshTokenAad(USER_A));
    expect(keyVersion).toBe(1);
    expect(blob).not.toContain(SECRET);
    expect(blob).not.toContain(Buffer.from(SECRET).toString('base64url'));
    const parts = blob.split('.');
    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe('v1');
    expect(Buffer.from(parts[1], 'base64url')).toHaveLength(12);
    expect(Buffer.from(parts[2], 'base64url')).toHaveLength(16);
  });

  it('IV aleatorio por registro: el mismo texto cifrado dos veces da blobs e IV distintos', () => {
    const a = cipher.encrypt(SECRET, refreshTokenAad(USER_A)).blob;
    const b = cipher.encrypt(SECRET, refreshTokenAad(USER_A)).blob;
    expect(a).not.toBe(b);
    expect(a.split('.')[1]).not.toBe(b.split('.')[1]);
    const ivs = new Set(Array.from({ length: 200 }, () => cipher.encrypt('x', 'aad').blob.split('.')[1]));
    expect(ivs.size).toBe(200);
  });

  it('detecta manipulacion del ciphertext, del tag, del IV y de la version', () => {
    const { blob } = cipher.encrypt(SECRET, refreshTokenAad(USER_A));
    const [version, iv, tag, ct] = blob.split('.');
    const flip = (value: string): string => {
      const bytes = Buffer.from(value, 'base64url');
      bytes[0] ^= 0x01;
      return bytes.toString('base64url');
    };
    const tampered = [
      [version, iv, tag, flip(ct)],
      [version, iv, flip(tag), ct],
      [version, flip(iv), tag, ct],
      ['v2', iv, tag, ct],
      [version, iv, tag, ''],
    ].map((parts) => parts.join('.'));
    for (const bad of tampered) {
      expect(() => cipher.decrypt(bad, refreshTokenAad(USER_A))).toThrow(TokenDecryptionError);
    }
  });

  it('rechaza blobs mal formados sin filtrar nada', () => {
    for (const bad of ['', 'abc', 'v1.a.b', 'v1.a.b.c.d', 'x1.AAAA.AAAA.AAAA']) {
      expect(() => cipher.decrypt(bad, 'aad')).toThrow(TokenDecryptionError);
    }
    try {
      cipher.decrypt('v1.AAAA.AAAA.AAAA', 'aad');
    } catch (error) {
      expect((error as Error).message).not.toMatch(/AAAA|key|clave/i);
    }
  });

  it('una clave incorrecta no descifra', () => {
    const { blob } = cipher.encrypt(SECRET, refreshTokenAad(USER_A));
    const other = new TokenCipher([{ version: 1, secret: KEY_2 }]);
    expect(() => other.decrypt(blob, refreshTokenAad(USER_A))).toThrow(TokenDecryptionError);
  });

  it('un blob copiado a otro usuario no descifra (el userId va como dato autenticado)', () => {
    const { blob } = cipher.encrypt(SECRET, refreshTokenAad(USER_A));
    expect(() => cipher.decrypt(blob, refreshTokenAad(USER_B))).toThrow(TokenDecryptionError);
  });

  it('exige una clave de al menos 32 bytes', () => {
    expect(() => new TokenCipher([{ version: 1, secret: 'corta' }])).toThrow(WeakEncryptionKeyError);
    expect(() => new TokenCipher([{ version: 1, secret: 'x'.repeat(31) }])).toThrow(WeakEncryptionKeyError);
    expect(() => new TokenCipher([{ version: 1, secret: 'x'.repeat(32) }])).not.toThrow();
    expect(() => new TokenCipher([])).toThrow();
    expect(() => new TokenCipher([{ version: 0, secret: KEY_1 }])).toThrow();
  });

  describe('rotacion de claves', () => {
    const v1 = new TokenCipher([{ version: 1, secret: KEY_1 }]);
    const rotated = new TokenCipher([
      { version: 2, secret: KEY_2 },
      { version: 1, secret: KEY_1 },
    ]);

    it('cifra con la version vigente y sigue descifrando blobs de la anterior', () => {
      const old = v1.encrypt(SECRET, 'aad');
      expect(old.keyVersion).toBe(1);
      expect(rotated.decrypt(old.blob, 'aad')).toBe(SECRET);
      expect(rotated.needsRewrap(old.blob)).toBe(true);

      const fresh = rotated.encrypt(SECRET, 'aad');
      expect(fresh.keyVersion).toBe(2);
      expect(fresh.blob.startsWith('v2.')).toBe(true);
      expect(rotated.needsRewrap(fresh.blob)).toBe(false);
    });

    it('sin la clave anterior, un blob viejo ya no se puede leer', () => {
      const old = v1.encrypt(SECRET, 'aad');
      const onlyNew = new TokenCipher([{ version: 2, secret: KEY_2 }]);
      expect(() => onlyNew.decrypt(old.blob, 'aad')).toThrow(TokenDecryptionError);
    });
  });
});
