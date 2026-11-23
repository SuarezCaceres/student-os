import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';

/** Longitud minima (en bytes UTF-8) de la clave de cifrado configurada. */
export const MIN_ENC_KEY_BYTES = 32;

const HKDF_SALT = Buffer.from('student-os/google-token/v1', 'utf8');
const IV_BYTES = 12; // tamano recomendado para GCM
const TAG_BYTES = 16;

export class TokenDecryptionError extends Error {
  constructor() {
    // Mensaje fijo y generico: nunca incluye texto cifrado ni claves.
    super('No se pudo descifrar el secreto guardado');
    this.name = 'TokenDecryptionError';
  }
}

export class WeakEncryptionKeyError extends Error {
  constructor() {
    super(`La clave de cifrado debe tener al menos ${MIN_ENC_KEY_BYTES} bytes`);
    this.name = 'WeakEncryptionKeyError';
  }
}

export interface CipherKey {
  /** Numero de version que se escribe en el blob y en la columna `keyVersion`. */
  version: number;
  /** Secreto en bruto (variable de entorno). Se deriva una clave AES-256 con HKDF-SHA256. */
  secret: string;
}

export interface EncryptedSecret {
  blob: string;
  keyVersion: number;
}

const b64u = (buffer: Buffer): string => buffer.toString('base64url');

/**
 * Deriva una clave de 32 bytes a partir de un secreto de >= 32 bytes con HKDF-SHA256 y un `info` de dominio
 * (asi la misma variable de entorno produce claves distintas para cifrar y para firmar el `state`).
 */
export function deriveKey(secret: string, info: string): Buffer {
  if (Buffer.byteLength(secret, 'utf8') < MIN_ENC_KEY_BYTES) {
    throw new WeakEncryptionKeyError();
  }
  return Buffer.from(hkdfSync('sha256', Buffer.from(secret, 'utf8'), HKDF_SALT, Buffer.from(info, 'utf8'), 32));
}

/**
 * AES-256-GCM con IV aleatorio por cifrado, version de clave en el blob y `aad` (datos autenticados adicionales,
 * p. ej. el `userId`): un blob copiado a otro usuario o manipulado NO descifra.
 *
 * Formato del blob: `v<version>.<iv>.<tag>.<ciphertext>` (base64url).
 */
export class TokenCipher {
  private readonly keys = new Map<number, Buffer>();
  private readonly currentVersion: number;

  /** El primer elemento es la clave vigente (con la que se cifra); el resto solo descifra (rotacion). */
  constructor(keys: CipherKey[]) {
    if (keys.length === 0) throw new WeakEncryptionKeyError();
    for (const key of keys) {
      if (!Number.isInteger(key.version) || key.version < 1) {
        throw new Error('La version de clave debe ser un entero >= 1');
      }
      this.keys.set(key.version, deriveKey(key.secret, 'student-os/google/aes-256-gcm'));
    }
    this.currentVersion = keys[0].version;
  }

  get version(): number {
    return this.currentVersion;
  }

  encrypt(plaintext: string, aad: string): EncryptedSecret {
    const key = this.keys.get(this.currentVersion) as Buffer;
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv('aes-256-gcm', key, iv, { authTagLength: TAG_BYTES });
    cipher.setAAD(Buffer.from(aad, 'utf8'));
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
      blob: `v${this.currentVersion}.${b64u(iv)}.${b64u(tag)}.${b64u(ciphertext)}`,
      keyVersion: this.currentVersion,
    };
  }

  decrypt(blob: string, aad: string): string {
    try {
      const parts = blob.split('.');
      if (parts.length !== 4 || !/^v\d+$/.test(parts[0])) throw new TokenDecryptionError();
      const version = Number(parts[0].slice(1));
      const key = this.keys.get(version);
      if (!key) throw new TokenDecryptionError();
      const iv = Buffer.from(parts[1], 'base64url');
      const tag = Buffer.from(parts[2], 'base64url');
      const ciphertext = Buffer.from(parts[3], 'base64url');
      if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) throw new TokenDecryptionError();
      const decipher = createDecipheriv('aes-256-gcm', key, iv, { authTagLength: TAG_BYTES });
      decipher.setAAD(Buffer.from(aad, 'utf8'));
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    } catch {
      throw new TokenDecryptionError();
    }
  }

  /** `true` si el blob se cifro con una version de clave anterior a la vigente (conviene re-cifrarlo). */
  needsRewrap(blob: string): boolean {
    const match = /^v(\d+)\./.exec(blob);
    return !match || Number(match[1]) !== this.currentVersion;
  }
}

/** AAD para el refresh token de un usuario. */
export const refreshTokenAad = (userId: string): string => `student-os:google:refresh:${userId}`;
/** AAD para el verifier PKCE de un usuario/estado. */
export const pkceVerifierAad = (userId: string, nonce: string): string => `student-os:google:pkce:${userId}:${nonce}`;
