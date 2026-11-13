import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DEFAULT_GOOGLE_API_BASE,
  DEFAULT_GOOGLE_AUTH_URL,
  DEFAULT_GOOGLE_OAUTH_BASE,
} from './google.constants';
import { OAuthStateSigner } from './oauth-state';
import { TokenCipher, type CipherKey } from './token-cipher';

/**
 * Lee la configuracion de Google con `ConfigService.get` (que cae a `process.env` para las variables que
 * `env.schema.ts` no declara, como GOOGLE_REDIRECT_URI). Nada se cachea salvo el cifrador/firmante, que se
 * recrean si la clave cambia. Jamas se loguea ningun valor.
 */
@Injectable()
export class GoogleConfig {
  private cipherCache: { secret: string; extra: string; cipher: TokenCipher } | null = null;
  private signerCache: { secret: string; signer: OAuthStateSigner } | null = null;

  constructor(private readonly config: ConfigService) {}

  private str(name: string): string | undefined {
    const value = this.config.get<string>(name);
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  }

  get clientId(): string | undefined {
    return this.str('GOOGLE_CLIENT_ID');
  }

  get clientSecret(): string | undefined {
    return this.str('GOOGLE_CLIENT_SECRET');
  }

  /** URL completa (publica) del callback de esta API: https://<api>/google/callback. Debe estar autorizada en Google Cloud. */
  get redirectUri(): string | undefined {
    return this.str('GOOGLE_REDIRECT_URI');
  }

  get encryptionKey(): string | undefined {
    return this.str('GOOGLE_TOKEN_ENC_KEY');
  }

  /** `true` si estan todos los datos para iniciar el flujo (y la clave de cifrado tiene longitud suficiente). */
  get isConfigured(): boolean {
    const key = this.encryptionKey;
    return Boolean(
      this.clientId &&
        this.clientSecret &&
        this.redirectUri &&
        key &&
        Buffer.byteLength(key, 'utf8') >= 32,
    );
  }

  /** Origenes web permitidos (ya validados por env.schema: array; si llegara como texto, se separa por comas). */
  get webOrigins(): string[] {
    const raw = this.config.get<string[] | string>('WEB_ORIGINS');
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
      return raw
        .split(',')
        .map((origin) => origin.trim().replace(/\/+$/, ''))
        .filter((origin) => origin.length > 0);
    }
    return ['http://localhost:5173'];
  }

  private endpoint(name: string, fallback: string): string {
    const value = (this.str(name) ?? fallback).replace(/\/+$/, '');
    // Las sobrescrituras existen solo para pruebas locales (servidor falso). En produccion deben ser https:
    // asi una variable mal puesta no manda refresh tokens por HTTP plano a un host arbitrario.
    if (this.config.get<string>('NODE_ENV') === 'production' && !value.startsWith('https://')) {
      throw new Error(`${name} debe ser https en produccion`);
    }
    return value;
  }

  get oauthBase(): string {
    return this.endpoint('GOOGLE_OAUTH_BASE', DEFAULT_GOOGLE_OAUTH_BASE);
  }

  get apiBase(): string {
    return this.endpoint('GOOGLE_API_BASE', DEFAULT_GOOGLE_API_BASE);
  }

  get authUrl(): string {
    return this.endpoint('GOOGLE_AUTH_URL', DEFAULT_GOOGLE_AUTH_URL);
  }

  /** Cifrador vigente (+ clave anterior opcional para rotacion). Lanza si la clave falta o es corta. */
  get cipher(): TokenCipher {
    const secret = this.encryptionKey;
    if (!secret) throw new Error('GOOGLE_TOKEN_ENC_KEY no esta configurada');
    const previous = this.str('GOOGLE_TOKEN_ENC_KEY_PREVIOUS') ?? '';
    const version = this.version('GOOGLE_TOKEN_ENC_KEY_VERSION', 1);
    const previousVersion = this.version('GOOGLE_TOKEN_ENC_KEY_PREVIOUS_VERSION', Math.max(1, version - 1));
    const extra = `${version}|${previous}|${previousVersion}`;
    if (!this.cipherCache || this.cipherCache.secret !== secret || this.cipherCache.extra !== extra) {
      const keys: CipherKey[] = [{ version, secret }];
      if (previous) keys.push({ version: previousVersion, secret: previous });
      this.cipherCache = { secret, extra, cipher: new TokenCipher(keys) };
    }
    return this.cipherCache.cipher;
  }

  get stateSigner(): OAuthStateSigner {
    const secret = this.encryptionKey;
    if (!secret) throw new Error('GOOGLE_TOKEN_ENC_KEY no esta configurada');
    if (!this.signerCache || this.signerCache.secret !== secret) {
      this.signerCache = { secret, signer: new OAuthStateSigner(secret) };
    }
    return this.signerCache.signer;
  }

  private version(name: string, fallback: number): number {
    const raw = this.str(name);
    if (raw === undefined) return fallback;
    const parsed = Number(raw);
    return Number.isInteger(parsed) && parsed >= 1 ? parsed : fallback;
  }
}
