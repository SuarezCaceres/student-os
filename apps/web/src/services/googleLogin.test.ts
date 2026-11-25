import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const request = vi.fn();
vi.mock('./api', async () => {
  const actual = await vi.importActual<typeof import('./api')>('./api');
  return { ...actual, getApiClient: () => ({ request }) };
});

import { ApiError } from './api';
import {
  __resetGoogleLoginForTests,
  CALENDAR_LINK_MESSAGES,
  clearCalendarLinkState,
  createProviderTokenStrippingStorage,
  getCalendarLinkState,
  GOOGLE_LOGIN_CALENDAR_SCOPES,
  hasPendingProviderRefreshToken,
  linkCalendarAfterLogin,
  takeProviderRefreshToken,
  type StorageLike,
} from './googleLogin';

const GOOGLE_REFRESH = '1//refresh-token-de-google-para-las-pruebas';

function memoryStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

const sessionJson = (extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    access_token: 'jwt-de-supabase',
    refresh_token: 'refresh-de-supabase',
    token_type: 'bearer',
    expires_in: 3600,
    user: { id: 'u1', email: 'ana@gmail.example' },
    ...extra,
  });

beforeEach(() => {
  __resetGoogleLoginForTests();
  request.mockReset();
});

afterEach(() => {
  __resetGoogleLoginForTests();
});

describe('permisos que se piden en el login (C4)', () => {
  it('pide exactamente los permisos estrechos de Calendar verificados en Google (spec 008, C9)', () => {
    expect(GOOGLE_LOGIN_CALENDAR_SCOPES.split(' ')).toEqual([
      'https://www.googleapis.com/auth/calendar.events.owned',
      'https://www.googleapis.com/auth/calendar.freebusy',
      'https://www.googleapis.com/auth/calendar.calendars.readonly',
    ]);
  });
});

describe('storage que no persiste los tokens de Google (C10)', () => {
  it('guarda la sesion SIN provider_token ni provider_refresh_token, aunque supabase-js los incluya', () => {
    const base = memoryStorage();
    const storage = createProviderTokenStrippingStorage(base);
    storage.setItem('sb-auth-token', sessionJson({ provider_token: 'google-access', provider_refresh_token: GOOGLE_REFRESH }));

    const stored = base.data.get('sb-auth-token') ?? '';
    expect(stored).not.toContain(GOOGLE_REFRESH);
    expect(stored).not.toContain('google-access');
    expect(stored).not.toContain('provider_');
    // El resto de la sesion se conserva intacto.
    expect(JSON.parse(stored)).toMatchObject({ access_token: 'jwt-de-supabase', refresh_token: 'refresh-de-supabase' });
  });

  it('ningun valor guardado en el almacenamiento contiene el refresh token de Google', () => {
    const base = memoryStorage();
    const storage = createProviderTokenStrippingStorage(base);
    storage.setItem('sb-auth-token', sessionJson({ provider_refresh_token: GOOGLE_REFRESH }));
    storage.setItem('sb-auth-token-code-verifier', 'verifier-pkce-en-texto-plano');
    expect([...base.data.values()].join('\n')).not.toContain(GOOGLE_REFRESH);
  });

  it('captura el refresh token en memoria, una sola vez, para enlazarlo con el servidor', () => {
    const storage = createProviderTokenStrippingStorage(memoryStorage());
    expect(hasPendingProviderRefreshToken()).toBe(false);
    storage.setItem('sb-auth-token', sessionJson({ provider_refresh_token: GOOGLE_REFRESH }));
    expect(hasPendingProviderRefreshToken()).toBe(true);
    expect(takeProviderRefreshToken()).toBe(GOOGLE_REFRESH);
    expect(takeProviderRefreshToken()).toBeNull();
    expect(hasPendingProviderRefreshToken()).toBe(false);
  });

  it('un refresco de sesion (sin tokens del proveedor) no captura nada ni toca el valor', () => {
    const base = memoryStorage();
    const storage = createProviderTokenStrippingStorage(base);
    const value = sessionJson();
    storage.setItem('sb-auth-token', value);
    expect(base.data.get('sb-auth-token')).toBe(value);
    expect(hasPendingProviderRefreshToken()).toBe(false);
  });

  it('los valores que no son JSON (verifier PKCE) y las lecturas pasan sin cambios', () => {
    const base = memoryStorage();
    const storage = createProviderTokenStrippingStorage(base);
    storage.setItem('k', 'provider_texto-que-no-es-json');
    expect(storage.getItem('k')).toBe('provider_texto-que-no-es-json');
    storage.removeItem('k');
    expect(storage.getItem('k')).toBeNull();
  });
});

describe('enlace de Calendar al terminar el login (C5, C9)', () => {
  it('envia el refresh token UNA vez a POST /google/link-login y queda vinculado', async () => {
    request.mockResolvedValueOnce({ connected: true });
    const result = await linkCalendarAfterLogin({ provider_refresh_token: GOOGLE_REFRESH, provider_token: 'google-access' });
    expect(result).toBe('linked');
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith('/google/link-login', { method: 'POST', body: { refreshToken: GOOGLE_REFRESH } });
    expect(getCalendarLinkState()).toEqual({ status: 'linked' });
    // El token no queda en memoria ni en el estado.
    expect(hasPendingProviderRefreshToken()).toBe(false);
    expect(JSON.stringify(getCalendarLinkState())).not.toContain(GOOGLE_REFRESH);
  });

  it('usa el token capturado por el storage cuando la sesion del evento ya no lo trae', async () => {
    const storage = createProviderTokenStrippingStorage(memoryStorage());
    storage.setItem('sb-auth-token', sessionJson({ provider_refresh_token: GOOGLE_REFRESH }));
    request.mockResolvedValueOnce({});
    expect(await linkCalendarAfterLogin({ provider_token: 'google-access' })).toBe('linked');
    expect(request.mock.calls[0][1].body).toEqual({ refreshToken: GOOGLE_REFRESH });
  });

  it('C9: si el usuario desmarco Calendar, falla con el mensaje claro y no vincula nada', async () => {
    request.mockRejectedValueOnce(new ApiError('client', 'x', { status: 409, body: { code: 'google_missing_scopes' } }));
    const result = await linkCalendarAfterLogin({ provider_refresh_token: GOOGLE_REFRESH });
    expect(result).toBe('failed');
    expect(getCalendarLinkState()).toEqual({
      status: 'failed',
      reason: 'missing_scopes',
      message: CALENDAR_LINK_MESSAGES.missing_scopes,
    });
    expect(CALENDAR_LINK_MESSAGES.missing_scopes).toContain('necesita acceso a tu Google Calendar');
    expect(hasPendingProviderRefreshToken()).toBe(false);
  });

  it('una cuenta de Google distinta de la de la sesion se informa como account_mismatch', async () => {
    request.mockRejectedValueOnce(new ApiError('client', 'x', { status: 409, body: { code: 'google_account_mismatch' } }));
    expect(await linkCalendarAfterLogin({ provider_refresh_token: GOOGLE_REFRESH })).toBe('failed');
    expect(getCalendarLinkState()).toMatchObject({ status: 'failed', reason: 'account_mismatch' });
  });

  it('un fallo de red u otro error del servidor se informa como "other" y permite reintentar', async () => {
    request.mockRejectedValueOnce(new ApiError('network', 'sin red'));
    expect(await linkCalendarAfterLogin({ provider_refresh_token: GOOGLE_REFRESH })).toBe('failed');
    expect(getCalendarLinkState()).toMatchObject({ status: 'failed', reason: 'other' });
  });

  it('si Google no entrego refresh token (hay provider_token pero no refresh), falla sin llamar al servidor', async () => {
    expect(await linkCalendarAfterLogin({ provider_token: 'google-access' })).toBe('failed');
    expect(getCalendarLinkState()).toMatchObject({ status: 'failed', reason: 'missing_refresh_token' });
    expect(request).not.toHaveBeenCalled();
  });

  it('una sesion que ya existia (sin tokens del proveedor) no hace nada', async () => {
    expect(await linkCalendarAfterLogin({})).toBe('skipped');
    expect(request).not.toHaveBeenCalled();
    expect(getCalendarLinkState()).toEqual({ status: 'idle' });
  });

  it('clearCalendarLinkState olvida el fallo anterior', async () => {
    request.mockRejectedValueOnce(new ApiError('network', 'sin red'));
    await linkCalendarAfterLogin({ provider_refresh_token: GOOGLE_REFRESH });
    clearCalendarLinkState();
    expect(getCalendarLinkState()).toEqual({ status: 'idle' });
  });
});
