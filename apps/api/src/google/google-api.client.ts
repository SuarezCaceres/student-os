import { Inject, Injectable, Optional } from '@nestjs/common';
import { GOOGLE_FETCH, GOOGLE_HTTP_TIMEOUT_MS } from './google.constants';
import { GoogleConfig } from './google.config';

export interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
}

/** Error del endpoint OAuth de Google (`invalid_grant`, `invalid_client`...). Nunca incluye tokens ni codigos. */
export class GoogleOAuthError extends Error {
  constructor(
    readonly oauthError: string,
    readonly httpStatus: number,
  ) {
    super(`Google OAuth: ${oauthError}`);
    this.name = 'GoogleOAuthError';
  }

  get isInvalidGrant(): boolean {
    return this.oauthError === 'invalid_grant';
  }
}

/** Fallo de red / timeout / respuesta ilegible al hablar con Google. */
export class GoogleNetworkError extends Error {
  constructor() {
    super('No se pudo comunicar con Google');
    this.name = 'GoogleNetworkError';
  }
}

export interface CalendarCall {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  /** Ruta relativa a `/calendar/v3/`, p. ej. `calendars/primary/events`. */
  path: string;
  query?: Record<string, string>;
  body?: unknown;
}

export interface CalendarResult {
  status: number;
  /** JSON de Google, `null` si no hay cuerpo (204) o no es JSON. */
  body: unknown;
}

/**
 * Cliente HTTP minimo de Google (fetch nativo, sin dependencias). Las bases de URL salen de la configuracion y
 * solo cambian en pruebas (servidor falso local). Los tokens viajan en cabeceras/cuerpo y NO se loguean.
 */
@Injectable()
export class GoogleApiClient {
  constructor(
    private readonly config: GoogleConfig,
    @Optional() @Inject(GOOGLE_FETCH) private readonly fetchImpl?: typeof fetch,
  ) {}

  private async send(url: string, init: RequestInit): Promise<Response> {
    const doFetch = this.fetchImpl ?? fetch;
    try {
      return await doFetch(url, { ...init, signal: AbortSignal.timeout(GOOGLE_HTTP_TIMEOUT_MS) });
    } catch {
      throw new GoogleNetworkError();
    }
  }

  private async readJson(response: Response): Promise<unknown> {
    try {
      const text = await response.text();
      return text === '' ? null : (JSON.parse(text) as unknown);
    } catch {
      return null;
    }
  }

  private async tokenRequest(params: Record<string, string>): Promise<GoogleTokenResponse> {
    const response = await this.send(`${this.config.oauthBase}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams(params).toString(),
    });
    const body = (await this.readJson(response)) as Record<string, unknown> | null;
    if (!response.ok) {
      const code = typeof body?.error === 'string' ? body.error : 'unknown_error';
      throw new GoogleOAuthError(code, response.status);
    }
    if (!body || typeof body.access_token !== 'string' || body.access_token === '') {
      throw new GoogleNetworkError();
    }
    const expiresIn = typeof body.expires_in === 'number' ? body.expires_in : Number(body.expires_in);
    return {
      access_token: body.access_token,
      expires_in: Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 3600,
      refresh_token: typeof body.refresh_token === 'string' && body.refresh_token !== '' ? body.refresh_token : undefined,
      scope: typeof body.scope === 'string' ? body.scope : undefined,
      token_type: typeof body.token_type === 'string' ? body.token_type : undefined,
    };
  }

  exchangeCode(input: { code: string; codeVerifier: string }): Promise<GoogleTokenResponse> {
    return this.tokenRequest({
      grant_type: 'authorization_code',
      code: input.code,
      code_verifier: input.codeVerifier,
      client_id: this.config.clientId ?? '',
      client_secret: this.config.clientSecret ?? '',
      redirect_uri: this.config.redirectUri ?? '',
    });
  }

  refreshAccessToken(refreshToken: string): Promise<GoogleTokenResponse> {
    return this.tokenRequest({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: this.config.clientId ?? '',
      client_secret: this.config.clientSecret ?? '',
    });
  }

  /** Revoca un refresh token (o access token). Devuelve `true` si Google confirmo la revocacion. Nunca lanza. */
  async revokeToken(token: string): Promise<boolean> {
    try {
      const response = await this.send(`${this.config.oauthBase}/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token }).toString(),
      });
      // 400 invalid_token = ya estaba revocado/caducado: el objetivo (token inservible) esta cumplido.
      return response.ok || response.status === 400;
    } catch {
      return false;
    }
  }

  /** Email de la cuenta conectada (mejor esfuerzo: `null` si falla). */
  async fetchAccountEmail(accessToken: string): Promise<string | null> {
    try {
      const response = await this.send(`${this.config.apiBase}/oauth2/v3/userinfo`, {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
      });
      if (!response.ok) return null;
      const body = (await this.readJson(response)) as { email?: unknown } | null;
      return typeof body?.email === 'string' && body.email.includes('@') ? body.email : null;
    } catch {
      return null;
    }
  }

  /** Llamada a Calendar API v3. `path` es relativo a `/calendar/v3/` (p. ej. `calendars/primary/events` o `freeBusy`). */
  async calendar(accessToken: string, call: CalendarCall): Promise<CalendarResult> {
    const query = call.query && Object.keys(call.query).length > 0 ? `?${new URLSearchParams(call.query).toString()}` : '';
    const url = `${this.config.apiBase}/calendar/v3/${call.path}${query}`;
    const headers: Record<string, string> = { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' };
    if (call.body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await this.send(url, {
      method: call.method,
      headers,
      body: call.body !== undefined ? JSON.stringify(call.body) : undefined,
    });
    return { status: response.status, body: await this.readJson(response) };
  }
}
