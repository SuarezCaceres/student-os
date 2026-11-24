import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { registerAccountDeletionHook } from '../common/account-deletion';
import {
  GoogleApiClient,
  GoogleNetworkError,
  GoogleOAuthError,
  type CalendarCall,
  type CalendarResult,
} from './google-api.client';
import { GoogleConfig } from './google.config';
import {
  ACCESS_TOKEN_REFRESH_MARGIN_MS,
  GOOGLE_CLOCK,
  GOOGLE_ERROR_CODES,
  GOOGLE_REPOSITORY,
  GOOGLE_SCOPES,
  OAUTH_STATE_TTL_MS,
  REQUIRED_EVENTS_SCOPE,
} from './google.constants';
import {
  accountMismatch,
  GoogleHttpException,
  invalidProviderToken,
  missingScopes,
  notConfigured,
  notConnected,
  reauthRequired,
  upstreamError,
} from './google.errors';
import type { GoogleRepository } from './google.repository';
import { generateNonce, generatePkcePair, InvalidStateError } from './oauth-state';
import { resolveReturnUrl, withGoogleResult } from './return-url';
import { pkceVerifierAad, refreshTokenAad, TokenDecryptionError } from './token-cipher';

export interface GoogleStatus {
  /** El servidor tiene credenciales de Google (client id/secret, redirect URI y clave de cifrado). */
  configured: boolean;
  connected: boolean;
  /** Google revoco/caduco el permiso: hay que volver a autorizar. */
  needsReauth: boolean;
  email: string | null;
  connectedAt: string | null;
  scopes: string[];
}

export type CallbackFailureReason =
  | 'denied'
  | 'invalid_state'
  | 'expired'
  | 'exchange_failed'
  | 'missing_refresh_token'
  | 'missing_scopes'
  | 'not_configured'
  | 'server';

interface CachedAccessToken {
  token: string;
  expiresAt: number;
}

/** Fragmento de `error.message` de Google apto para mostrar: una linea, sin saltos ni espacios raros, recortada. */
function sanitizeGoogleMessage(body: unknown): string {
  const message = (body as { error?: { message?: unknown } } | null)?.error?.message;
  if (typeof message !== 'string') return '';
  return message.replace(/\s+/g, ' ').trim().slice(0, 200);
}

function googleReason(body: unknown): string {
  const errors = (body as { error?: { errors?: Array<{ reason?: unknown }> } } | null)?.error?.errors;
  const reason = Array.isArray(errors) ? errors[0]?.reason : undefined;
  return typeof reason === 'string' ? reason : '';
}

const RATE_LIMIT_REASONS = new Set([
  'rateLimitExceeded',
  'userRateLimitExceeded',
  'quotaExceeded',
  'dailyLimitExceeded',
]);

@Injectable()
export class GoogleService implements OnModuleInit {
  private readonly logger = new Logger(GoogleService.name);
  /** Access tokens SOLO en memoria (por proceso). Nunca se escriben en la base de datos ni se envian al navegador. */
  private readonly accessTokens = new Map<string, CachedAccessToken>();
  private readonly inflightRefresh = new Map<string, Promise<string>>();

  constructor(
    private readonly config: GoogleConfig,
    private readonly client: GoogleApiClient,
    @Inject(GOOGLE_REPOSITORY) private readonly repo: GoogleRepository,
    @Inject(GOOGLE_CLOCK) private readonly now: () => number,
  ) {}

  onModuleInit(): void {
    // PUBLIC borra la cuenta ejecutando todos los ganchos registrados: aqui se revoca y borra el secreto de Google.
    registerAccountDeletionHook({
      name: 'google',
      run: async (userId) => {
        await this.disconnect(userId);
        await this.repo.deleteOAuthStatesForUser(userId);
      },
    });
  }

  // --- Conexion ------------------------------------------------------------------

  /** Inicia el flujo: guarda el verifier PKCE (cifrado, con TTL) y devuelve la URL de consentimiento de Google. */
  async startConnect(userId: string, returnTo: string | undefined): Promise<{ url: string }> {
    if (!this.config.isConfigured) throw notConfigured();

    const redirectTo = resolveReturnUrl(returnTo, this.config.webOrigins);
    if (!redirectTo) {
      throw new GoogleHttpException(
        400,
        GOOGLE_ERROR_CODES.invalidReturnTo,
        'La direccion de retorno no esta permitida.',
      );
    }

    const { verifier, challenge } = generatePkcePair();
    const nonce = generateNonce();
    const nowMs = this.now();
    const expiresAtMs = nowMs + OAUTH_STATE_TTL_MS;

    await this.repo.createOAuthState(
      {
        id: nonce,
        userId,
        codeVerifierEnc: this.config.cipher.encrypt(verifier, pkceVerifierAad(userId, nonce)).blob,
        redirectTo,
        expiresAt: new Date(expiresAtMs),
      },
      new Date(nowMs),
    );

    const state = this.config.stateSigner.sign({ userId, nonce, expiresAtMs });
    const params = new URLSearchParams({
      client_id: this.config.clientId as string,
      redirect_uri: this.config.redirectUri as string,
      response_type: 'code',
      scope: GOOGLE_SCOPES.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    });
    return { url: `${this.config.authUrl}?${params.toString()}` };
  }

  /**
   * Procesa la vuelta de Google. NUNCA lanza: devuelve siempre la URL a la que redirigir el navegador
   * (`?google=connected` o `?google=error`), siempre dentro de WEB_ORIGINS.
   */
  async handleCallback(query: { code?: string; state?: string; error?: string }): Promise<string> {
    const fallbackBase = resolveReturnUrl(undefined, this.config.webOrigins) ?? 'http://localhost:5173/';
    try {
      if (!this.config.isConfigured) return withGoogleResult(fallbackBase, 'error', 'not_configured');

      const failure = (base: string, reason: CallbackFailureReason): string => withGoogleResult(base, 'error', reason);

      if (!query.state) return failure(fallbackBase, 'invalid_state');

      let payload;
      try {
        payload = this.config.stateSigner.verify(query.state, { now: this.now() });
      } catch (error) {
        const reason = error instanceof InvalidStateError && error.reason === 'expired' ? 'expired' : 'invalid_state';
        return failure(fallbackBase, reason);
      }

      // Un solo uso: aunque Google falle despues, el state no se puede reutilizar.
      const row = await this.repo.consumeOAuthState(payload.nonce);
      if (!row || row.userId !== payload.userId || row.expiresAt.getTime() <= this.now()) {
        return failure(fallbackBase, row && row.expiresAt.getTime() <= this.now() ? 'expired' : 'invalid_state');
      }
      // Defensa en profundidad: el destino se valida otra vez aunque se hubiera validado al crearlo.
      const base = resolveReturnUrl(row.redirectTo, this.config.webOrigins) ?? fallbackBase;

      if (query.error) return failure(base, query.error === 'access_denied' ? 'denied' : 'exchange_failed');
      if (!query.code) return failure(base, 'exchange_failed');

      let verifier: string;
      try {
        verifier = this.config.cipher.decrypt(row.codeVerifierEnc, pkceVerifierAad(row.userId, row.id));
      } catch {
        return failure(base, 'server');
      }

      let tokens;
      try {
        tokens = await this.client.exchangeCode({ code: query.code, codeVerifier: verifier });
      } catch (error) {
        this.logger.warn(`Intercambio de codigo rechazado (${error instanceof GoogleOAuthError ? error.oauthError : 'red'})`);
        return failure(base, 'exchange_failed');
      }

      if (!tokens.refresh_token) return failure(base, 'missing_refresh_token');
      const granted = (tokens.scope ?? '').split(/\s+/).filter(Boolean);
      if (granted.length > 0 && !granted.includes(REQUIRED_EVENTS_SCOPE)) {
        // El usuario desmarco el permiso de eventos en el consentimiento granular: se revoca lo concedido.
        await this.client.revokeToken(tokens.refresh_token);
        return failure(base, 'missing_scopes');
      }

      const email = await this.client.fetchAccountEmail(tokens.access_token);
      const encrypted = this.config.cipher.encrypt(tokens.refresh_token, refreshTokenAad(row.userId));
      await this.repo.saveConnection({
        userId: row.userId,
        refreshTokenEnc: encrypted.blob,
        keyVersion: encrypted.keyVersion,
        scopes: granted.length > 0 ? granted.join(' ') : GOOGLE_SCOPES.join(' '),
        accountEmail: email,
        connectedAt: new Date(this.now()),
      });
      this.accessTokens.set(row.userId, {
        token: tokens.access_token,
        expiresAt: this.now() + tokens.expires_in * 1000,
      });
      return withGoogleResult(base, 'connected');
    } catch (error) {
      this.logger.error(`Fallo inesperado en el callback de Google (${error instanceof Error ? error.name : 'Error'})`);
      return withGoogleResult(fallbackBase, 'error', 'server');
    }
  }

  /**
   * Vincula Calendar al terminar el LOGIN con Google (Supabase): la web entrega UNA vez el refresh token que Google
   * dio en ese mismo consentimiento y el servidor lo valida, lo cifra y lo guarda. El usuario no pulsa ningun boton.
   *
   * Reglas (spec 009):
   *  - El token solo vale si Google lo reconoce y se emitio para NUESTRO cliente OAuth (el proveedor Google de
   *    Supabase debe usar el mismo client id/secret que este servidor).
   *  - Si falta el permiso de eventos (consentimiento granular), se revoca y NO se guarda nada (C9).
   *  - Si la cuenta de Google no es la de la sesion, no se guarda nada.
   * El token jamas se registra en logs ni se devuelve en la respuesta.
   */
  async linkFromLogin(userId: string, sessionEmail: string | undefined, providerRefreshToken: string): Promise<GoogleStatus> {
    if (!this.config.isConfigured) throw notConfigured();

    let tokens;
    try {
      tokens = await this.client.refreshAccessToken(providerRefreshToken);
    } catch (error) {
      if (error instanceof GoogleOAuthError) {
        this.logger.warn(`Vinculacion tras login rechazada por Google (${error.oauthError})`);
        throw invalidProviderToken();
      }
      if (error instanceof GoogleNetworkError) throw upstreamError();
      throw error;
    }

    const granted = (tokens.scope ?? '').split(/\s+/).filter(Boolean);
    if (!granted.includes(REQUIRED_EVENTS_SCOPE)) {
      // Sin el permiso de eventos la app no puede publicar gym ni turno: se revoca lo concedido y no se guarda nada.
      await this.client.revokeToken(providerRefreshToken);
      throw missingScopes();
    }

    const email = await this.client.fetchAccountEmail(tokens.access_token);
    if (sessionEmail && email && sessionEmail.toLowerCase() !== email.toLowerCase()) {
      throw accountMismatch();
    }

    const encrypted = this.config.cipher.encrypt(providerRefreshToken, refreshTokenAad(userId));
    await this.repo.saveConnection({
      userId,
      refreshTokenEnc: encrypted.blob,
      keyVersion: encrypted.keyVersion,
      scopes: granted.join(' '),
      accountEmail: email,
      connectedAt: new Date(this.now()),
    });
    this.accessTokens.set(userId, {
      token: tokens.access_token,
      expiresAt: this.now() + tokens.expires_in * 1000,
    });
    return this.getStatus(userId);
  }

  async getStatus(userId: string): Promise<GoogleStatus> {
    const configured = this.config.isConfigured;
    const connection = await this.repo.getConnection(userId);
    if (!connection) {
      return { configured, connected: false, needsReauth: false, email: null, connectedAt: null, scopes: [] };
    }
    return {
      configured,
      connected: true,
      needsReauth: connection.needsReauth,
      email: connection.accountEmail,
      connectedAt: connection.connectedAt.toISOString(),
      scopes: connection.scopes.split(/\s+/).filter(Boolean),
    };
  }

  /**
   * Revoca el token en Google y BORRA el secreto. Siempre borra, aunque Google no responda: `revoked` indica si
   * Google confirmo (si es `false`, el usuario puede quitar el acceso en myaccount.google.com/permissions).
   * Idempotente.
   */
  async disconnect(userId: string): Promise<{ disconnected: boolean; revoked: boolean }> {
    const connection = await this.repo.getConnection(userId);
    this.accessTokens.delete(userId);
    this.inflightRefresh.delete(userId);
    if (!connection) return { disconnected: false, revoked: false };

    let revoked = false;
    try {
      const refreshToken = this.config.cipher.decrypt(connection.refreshTokenEnc, refreshTokenAad(userId));
      revoked = await this.client.revokeToken(refreshToken);
    } catch (error) {
      this.logger.warn(
        `No se pudo revocar en Google (${error instanceof TokenDecryptionError ? 'secreto ilegible' : 'error'})`,
      );
    }
    await this.repo.deleteConnection(userId);
    return { disconnected: true, revoked };
  }

  // --- Access token (solo memoria) -------------------------------------------------

  private async accessTokenFor(userId: string, options: { force?: boolean } = {}): Promise<string> {
    const cached = this.accessTokens.get(userId);
    if (!options.force && cached && cached.expiresAt - this.now() > ACCESS_TOKEN_REFRESH_MARGIN_MS) {
      return cached.token;
    }
    // Single-flight: varias llamadas simultaneas del mismo usuario comparten UNA renovacion.
    const pending = this.inflightRefresh.get(userId);
    if (pending) return pending;

    const refresh = this.refreshAccessToken(userId).finally(() => this.inflightRefresh.delete(userId));
    this.inflightRefresh.set(userId, refresh);
    return refresh;
  }

  private async refreshAccessToken(userId: string): Promise<string> {
    const connection = await this.repo.getConnection(userId);
    if (!connection) {
      this.accessTokens.delete(userId);
      throw notConnected();
    }
    // Ya sabemos que Google lo rechazo: no se vuelve a intentar hasta que el usuario reconecte.
    if (connection.needsReauth) throw reauthRequired();

    let refreshToken: string;
    try {
      refreshToken = this.config.cipher.decrypt(connection.refreshTokenEnc, refreshTokenAad(userId));
    } catch {
      // Clave cambiada o blob manipulado: el secreto es inservible, hay que reconectar (se sobrescribira).
      this.logger.error('No se pudo descifrar el refresh token (clave incorrecta o dato alterado)');
      await this.flagReauth(userId);
      throw reauthRequired();
    }

    try {
      const tokens = await this.client.refreshAccessToken(refreshToken);
      this.accessTokens.set(userId, { token: tokens.access_token, expiresAt: this.now() + tokens.expires_in * 1000 });

      // Google puede rotar el refresh token; ademas, si el blob usa una clave antigua, se re-cifra con la vigente.
      const rotated = tokens.refresh_token;
      if (rotated || this.config.cipher.needsRewrap(connection.refreshTokenEnc)) {
        const encrypted = this.config.cipher.encrypt(rotated ?? refreshToken, refreshTokenAad(userId));
        await this.repo.updateRefreshToken(userId, encrypted.blob, encrypted.keyVersion);
      }
      return tokens.access_token;
    } catch (error) {
      if (error instanceof GoogleOAuthError && (error.isInvalidGrant || error.oauthError === 'invalid_client')) {
        await this.flagReauth(userId);
        throw reauthRequired();
      }
      if (error instanceof GoogleHttpException) throw error;
      this.logger.warn(`Renovacion del access token fallida (${error instanceof GoogleOAuthError ? error.oauthError : 'red'})`);
      throw upstreamError();
    }
  }

  private async flagReauth(userId: string): Promise<void> {
    this.accessTokens.delete(userId);
    await this.repo.markNeedsReauth(userId);
  }

  // --- Proxy a Calendar API v3 ------------------------------------------------------

  /**
   * Ejecuta una llamada a Calendar en nombre del usuario. Renueva el access token si esta por vencer; si Google
   * responde 401 con un token "vigente" (revocado entre medias), renueva UNA vez y reintenta.
   */
  async calendarRequest(userId: string, call: CalendarCall): Promise<CalendarResult> {
    let accessToken = await this.accessTokenFor(userId);
    let result = await this.callGoogle(accessToken, call);

    if (result.status === 401) {
      this.accessTokens.delete(userId);
      accessToken = await this.accessTokenFor(userId, { force: true });
      result = await this.callGoogle(accessToken, call);
      if (result.status === 401) {
        await this.flagReauth(userId);
        throw reauthRequired();
      }
    }
    if (result.status >= 200 && result.status < 300) return result;
    throw this.mapCalendarError(result);
  }

  private async callGoogle(accessToken: string, call: CalendarCall): Promise<CalendarResult> {
    try {
      return await this.client.calendar(accessToken, call);
    } catch (error) {
      if (error instanceof GoogleNetworkError) throw upstreamError();
      throw error;
    }
  }

  /** Traduce un error de Calendar a un `code` estable (nunca reenvia el cuerpo crudo de Google). */
  private mapCalendarError(result: CalendarResult): GoogleHttpException {
    const { status, body } = result;
    if (status === 400) {
      const detail = sanitizeGoogleMessage(body);
      return new GoogleHttpException(
        400,
        GOOGLE_ERROR_CODES.badRequest,
        `Google rechazo la solicitud${detail ? `: ${detail}` : '.'}`,
      );
    }
    if (status === 429 || (status === 403 && RATE_LIMIT_REASONS.has(googleReason(body)))) {
      return new GoogleHttpException(
        429,
        GOOGLE_ERROR_CODES.rateLimited,
        'Google limito temporalmente las solicitudes. Intenta de nuevo en un minuto.',
      );
    }
    if (status === 403) {
      return new GoogleHttpException(
        403,
        GOOGLE_ERROR_CODES.forbidden,
        'Google rechazo los permisos de calendario (403). Reconecta y acepta todos los permisos.',
      );
    }
    if (status === 404) {
      return new GoogleHttpException(404, GOOGLE_ERROR_CODES.notFound, 'No se encontro el evento en Google Calendar.');
    }
    if (status === 409) {
      return new GoogleHttpException(409, GOOGLE_ERROR_CODES.conflict, 'El evento ya existe en Google Calendar.');
    }
    if (status === 410) {
      return new GoogleHttpException(410, GOOGLE_ERROR_CODES.gone, 'El evento ya fue eliminado de Google Calendar.');
    }
    if (status >= 500) return upstreamError();
    return new GoogleHttpException(400, GOOGLE_ERROR_CODES.badRequest, 'Google rechazo la solicitud.');
  }
}
