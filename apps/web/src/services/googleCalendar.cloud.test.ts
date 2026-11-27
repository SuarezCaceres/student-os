// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DayOfWeek } from '../types';
import { ApiError } from './api';
import * as api from './api';
import * as supabase from './supabase';

vi.mock('./supabase', () => ({
  isSyncConfigured: vi.fn(() => true),
  getAccessToken: vi.fn(async () => 'supabase-jwt'),
  getSupabase: vi.fn(async () => null),
}));

vi.mock('./api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api')>();
  return { ...actual, getApiClient: vi.fn() };
});

/**
 * Spec 009: la fachada solo habla con /google/* de la API (jamas con Google directo ni con un token del navegador) y
 * traduce los errores de la API a la semantica de siempre (`auth_missing`, `partial`...).
 */

const WEEK: Record<DayOfWeek, string> = {
  Lunes: '2026-11-09',
  Martes: '2026-11-10',
  Miércoles: '2026-11-11',
  Jueves: '2026-11-12',
  Viernes: '2026-11-13',
  Sábado: '2026-11-14',
  Domingo: '2026-11-15',
};

type RequestFn = (path: string, options?: { method?: string; query?: Record<string, string>; body?: unknown }) => Promise<unknown>;

function clientError(status: number, body: Record<string, unknown>): ApiError {
  return new ApiError('client', `La petición fue rechazada (${status}).`, { status, body });
}

const REAUTH = () => clientError(409, { statusCode: 409, code: 'google_reauth_required', message: 'reautoriza' });
const UPSTREAM = () => clientError(424, { statusCode: 424, code: 'google_upstream_error', message: 'Google no respondio' });

describe('googleCalendar (transporte por la API)', () => {
  let request: ReturnType<typeof vi.fn<RequestFn>>;
  let fetchSpy: ReturnType<typeof vi.fn>;
  let cloud: typeof import('./googleCloud');
  let facade: typeof import('./googleCalendar');

  async function load() {
    vi.resetModules();
    cloud = await import('./googleCloud');
    cloud.__resetGoogleCloudForTests();
    cloud.__setGoogleCloudSessionForTests(true);
    facade = await import('./googleCalendar');
  }

  function respond(handler: (path: string, options?: Parameters<RequestFn>[1]) => unknown) {
    request.mockImplementation(async (path, options) => handler(path, options));
  }

  beforeEach(async () => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    request = vi.fn<RequestFn>();
    vi.mocked(api.getApiClient).mockReturnValue({ request } as unknown as ReturnType<typeof api.getApiClient>);
    vi.mocked(supabase.isSyncConfigured).mockReturnValue(true);
    vi.mocked(supabase.getAccessToken).mockResolvedValue('supabase-jwt');
    fetchSpy = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);
    await load();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const connectedMeta = () =>
    window.localStorage.setItem('student_os_gcal_meta', JSON.stringify({ connected: true, email: 'ana@gmail.example' }));
  const TOKEN = () => facade.GOOGLE_CLOUD_ACCESS_TOKEN;

  describe('deteccion del modo y sesion', () => {
    it('modo nube solo con la nube configurada Y sesion de Supabase iniciada', () => {
      expect(facade.isGoogleCloudMode()).toBe(true);
      cloud.__setGoogleCloudSessionForTests(false);
      expect(facade.isGoogleCloudMode()).toBe(false);
      cloud.__setGoogleCloudSessionForTests(true);
      vi.mocked(supabase.isSyncConfigured).mockReturnValue(false);
      expect(facade.isGoogleCloudMode()).toBe(false);
    });

    it('sin nube configurada no hay Calendar: ni token ni llamadas, aunque haya restos de la version anterior en el navegador', async () => {
      vi.mocked(supabase.isSyncConfigured).mockReturnValue(false);
      connectedMeta();
      window.sessionStorage.setItem('student_os_gcal_token', JSON.stringify({ accessToken: 'gis', expiresAt: Date.now() + 3_600_000 }));
      expect(facade.getStoredAccessToken()).toBeNull();
      expect(await facade.trySilentGoogleReconnect()).toBeNull();
      expect(request).not.toHaveBeenCalled();
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('con sesion cerrada en Supabase no hay token ni llamadas al servidor', async () => {
      cloud.__setGoogleCloudSessionForTests(false);
      vi.mocked(supabase.getAccessToken).mockResolvedValue(null);
      expect(await facade.resolveGoogleCloudMode()).toBe(false);
      expect(await facade.trySilentGoogleReconnect()).toBeNull();
      expect(request).not.toHaveBeenCalled();
    });

    it('isGoogleCalendarReady es true sin Client ID del navegador (las credenciales las tiene el servidor)', () => {
      expect(facade.isGoogleCalendarReady()).toBe(true);
      cloud.__setGoogleCloudSessionForTests(false);
      expect(facade.isGoogleCalendarReady()).toBe(false);
    });
  });

  describe('getStoredAccessToken / trySilentGoogleReconnect', () => {
    it('devuelve el marcador de nube solo si la meta local dice conectado', () => {
      expect(facade.getStoredAccessToken()).toBeNull();
      connectedMeta();
      expect(facade.getStoredAccessToken()).toBe(TOKEN());
    });

    it('el marcador no es un token real y nunca se manda a Google', async () => {
      connectedMeta();
      respond(() => ({ items: [] }));
      await facade.fetchGoogleEventsAndBusyForWeek(TOKEN(), WEEK);
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(TOKEN()).not.toMatch(/^ya29\./);
    });

    it('conectado en el servidor: consulta /google/status, devuelve el marcador y actualiza la meta', async () => {
      respond(() => ({ configured: true, connected: true, needsReauth: false, email: 'ana@gmail.example', connectedAt: '2026-11-13T10:00:00.000Z', scopes: [] }));
      expect(await facade.trySilentGoogleReconnect()).toBe(TOKEN());
      expect(request).toHaveBeenCalledWith('/google/status');
      expect(facade.getStoredGoogleMeta()).toMatchObject({ connected: true, email: 'ana@gmail.example', connectedAt: '2026-11-13T10:00:00.000Z' });
      expect(facade.getStoredAccessToken()).toBe(TOKEN());
    });

    it('no conectado en el servidor: null y la meta local se corrige', async () => {
      connectedMeta();
      respond(() => ({ configured: true, connected: false, needsReauth: false, email: null, connectedAt: null, scopes: [] }));
      expect(await facade.trySilentGoogleReconnect()).toBeNull();
      expect(facade.getStoredGoogleMeta()).toEqual({ connected: false });
      expect(facade.getStoredAccessToken()).toBeNull();
    });

    it('requiere reautorizar: null, la meta sigue "conectado" (para pedir volver a entrar con Google) y no hay token activo', async () => {
      respond(() => ({ configured: true, connected: true, needsReauth: true, email: 'ana@gmail.example', connectedAt: null, scopes: [] }));
      expect(await facade.trySilentGoogleReconnect()).toBeNull();
      expect(facade.getStoredGoogleMeta().connected).toBe(true);
      expect(facade.getStoredAccessToken()).toBeNull();
    });

    it('un fallo transitorio (servidor dormido) NO desconecta: sigue devolviendo el marcador', async () => {
      connectedMeta();
      request.mockRejectedValue(new ApiError('timeout', 'El servidor tardó demasiado en responder.'));
      expect(await facade.trySilentGoogleReconnect()).toBe(TOKEN());
    });

    it('consultas simultaneas del estado comparten una sola llamada y se cachean', async () => {
      respond(() => ({ configured: true, connected: true, needsReauth: false, email: 'a@b.c', connectedAt: null, scopes: [] }));
      await Promise.all([facade.trySilentGoogleReconnect(), facade.trySilentGoogleReconnect(), facade.trySilentGoogleReconnect()]);
      await facade.trySilentGoogleReconnect();
      expect(request).toHaveBeenCalledTimes(1);
    });
  });

  describe('llamadas a Calendar por la API', () => {
    it('lista la semana: GET /google/calendar/events con la misma query de siempre y mismos eventos', async () => {
      respond(() => ({
        defaultReminders: [{ method: 'popup', minutes: 10 }],
        items: [
          {
            id: 'ev1',
            summary: 'Clase',
            start: { dateTime: '2026-11-10T15:00:00Z' },
            end: { dateTime: '2026-11-10T16:00:00Z' },
            reminders: { useDefault: true },
          },
        ],
      }));
      connectedMeta();
      const { events, busyByDate } = await facade.fetchGoogleEventsAndBusyForWeek(TOKEN(), WEEK);
      expect(events.length).toBeGreaterThan(0);
      expect(events[0]).toMatchObject({ id: 'ev1', title: 'Clase', reminderMinutes: [10] });
      expect(Object.keys(busyByDate)).toHaveLength(7);
      const [path, options] = request.mock.calls[0];
      expect(path).toBe('/google/calendar/events');
      expect(options?.method).toBe('GET');
      expect(options?.query).toMatchObject({ singleEvents: 'true', orderBy: 'startTime', maxResults: '250' });
      expect(options?.body).toBeUndefined();
      expect(facade.getStoredGoogleMeta().lastSyncedAt).toBeTruthy();
    });

    it('upsert: crear = POST; actualizar = PATCH /events/<id>; si el evento ya no existe (404) lo recrea', async () => {
      respond((path, options) => {
        if (options?.method === 'PATCH' && path.endsWith('/borrado')) throw clientError(404, { code: 'google_not_found', message: 'no existe' });
        return { id: options?.method === 'POST' ? 'nuevo' : 'actualizado', htmlLink: 'https://x' };
      });
      const base = { title: 'Gym', dateIso: '2026-11-09', startTime: '07:00', endTime: '08:00' };

      const created = await facade.upsertGoogleGymEvent(TOKEN(), {
        ...base,
        recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=MO'],
        reminderMinutes: [60],
        studentOsCategory: 'gym',
      });
      expect(created).toEqual({ eventId: 'nuevo', htmlLink: 'https://x' });
      expect(request.mock.calls[0][0]).toBe('/google/calendar/events');
      expect(request.mock.calls[0][1]).toMatchObject({
        method: 'POST',
        body: {
          summary: 'Gym',
          recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=MO'],
          reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 60 }] },
          extendedProperties: { private: { studentOsSource: 'student-os', studentOsCategory: 'gym' } },
        },
      });

      await facade.upsertGoogleGymEvent(TOKEN(), { ...base, eventId: 'abc' });
      expect(request.mock.calls[1][0]).toBe('/google/calendar/events/abc');
      expect(request.mock.calls[1][1]?.method).toBe('PATCH');

      request.mockClear();
      const recreated = await facade.upsertGoogleGymEvent(TOKEN(), { ...base, eventId: 'borrado' });
      expect(recreated.eventId).toBe('nuevo');
      expect(request.mock.calls.map((c) => c[1]?.method)).toEqual(['PATCH', 'POST']);
    });

    it('delete: DELETE con el id codificado; 204 y "ya no existe" (404/410) no son error', async () => {
      respond(() => null);
      await expect(facade.deleteGoogleGymEvent(TOKEN(), 'ev/1')).resolves.toBeUndefined();
      expect(request.mock.calls[0][0]).toBe('/google/calendar/events/ev%2F1');
      expect(request.mock.calls[0][1]?.method).toBe('DELETE');

      respond(() => {
        throw clientError(410, { code: 'google_gone', message: 'ya fue eliminado' });
      });
      await expect(facade.deleteGoogleGymEvent(TOKEN(), 'x')).resolves.toBeUndefined();
      respond(() => {
        throw clientError(404, { code: 'google_not_found', message: 'no existe' });
      });
      await expect(facade.deleteGoogleGymEvent(TOKEN(), 'x')).resolves.toBeUndefined();
    });

    it('series: recorta con UNTIL las previas al lunes (PATCH) y borra las nuevas (DELETE), con la misma logica de siempre', async () => {
      const master = (id: string, startDay: string) => ({
        id,
        summary: 'Gym',
        description: 'Programado desde StudentOS',
        start: { dateTime: `${startDay}T07:00:00Z` },
        end: { dateTime: `${startDay}T08:00:00Z` },
        recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=MO'],
        extendedProperties: { private: { studentOsSource: 'student-os', studentOsCategory: 'gym' } },
      });
      respond((path, options) => {
        if (options?.method === 'GET' && path === '/google/calendar/events') {
          return {
            items: [
              { ...master('inst-old', '2026-11-09'), recurringEventId: 'serie-vieja', recurrence: undefined },
              { ...master('inst-new', '2026-11-09'), recurringEventId: 'serie-nueva', recurrence: undefined },
            ],
          };
        }
        if (options?.method === 'GET' && path.endsWith('/serie-vieja')) return master('serie-vieja', '2026-10-05');
        if (options?.method === 'GET' && path.endsWith('/serie-nueva')) return master('serie-nueva', '2026-11-09');
        return options?.method === 'PATCH' ? {} : null;
      });
      const result = await facade.deleteStudentOsGymEventsFromMonday(TOKEN(), WEEK);
      expect(result).toMatchObject({ status: 'ok', cutSeriesCount: 1, failedCount: 0 });
      const patch = request.mock.calls.find((c) => c[1]?.method === 'PATCH');
      expect(patch?.[0]).toBe('/google/calendar/events/serie-vieja');
      expect((patch?.[1]?.body as { recurrence?: string[] } | undefined)?.recurrence?.[0]).toMatch(/UNTIL=\d{8}T\d{6}Z$/);
      expect(request.mock.calls.some((c) => c[1]?.method === 'DELETE' && c[0].endsWith('/serie-nueva'))).toBe(true);
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe('mapeo de errores de la API a la semantica de siempre', () => {
    beforeEach(() => connectedMeta());

    it('google_reauth_required (409) -> como un 401 de Google: mensaje "expiro", sin token activo', async () => {
      respond(() => {
        throw REAUTH();
      });
      await expect(facade.fetchGoogleEventsAndBusyForWeek(TOKEN(), WEEK)).rejects.toThrow(/expiró/);
      expect(facade.getStoredAccessToken()).toBeNull();
      // La meta sigue "conectada": la UI muestra "Requiere reconexión" y pide volver a entrar con Google.
      expect(facade.getStoredGoogleMeta().connected).toBe(true);
    });

    it('google_not_connected tambien se trata como sesion ausente', async () => {
      respond(() => {
        throw clientError(409, { code: 'google_not_connected', message: 'no conectado' });
      });
      await expect(facade.fetchGoogleEventsAndBusyForWeek(TOKEN(), WEEK)).rejects.toThrow(/expiró/);
    });

    it('borrado de series con reauth -> status auth_missing (no "error")', async () => {
      respond(() => {
        throw REAUTH();
      });
      const result = await facade.deleteStudentOsGymEventsFromMonday(TOKEN(), WEEK);
      expect(result.status).toBe('auth_missing');
      const workShift = await facade.clearOrCutoffWorkShiftEventsFromMonday(TOKEN(), WEEK);
      expect(workShift.status).toBe('auth_missing');
    });

    it('Google caido (424) -> el borrado de series responde "error" (no auth_missing) con el mensaje del servidor', async () => {
      respond(() => {
        throw UPSTREAM();
      });
      const result = await facade.deleteStudentOsGymEventsFromMonday(TOKEN(), WEEK);
      expect(result.status).toBe('error');
      expect(result.message).toContain('Google no respondio');
      await expect(facade.fetchGoogleEventsAndBusyForWeek(TOKEN(), WEEK)).rejects.toThrow(/Google no respondio/);
      // No es un problema de autorizacion: sigue conectado.
      expect(facade.getStoredAccessToken()).toBe(TOKEN());
    });

    it('red caida / timeout / servidor dormido: el borrado devuelve "error" y listar lanza, como un fetch fallido', async () => {
      for (const kind of ['network', 'timeout', 'offline', 'server'] as const) {
        respond(() => {
          throw new ApiError(kind, `fallo ${kind}`);
        });
        expect((await facade.deleteStudentOsGymEventsFromMonday(TOKEN(), WEEK)).status).toBe('error');
        await expect(facade.fetchGoogleEventsAndBusyForWeek(TOKEN(), WEEK)).rejects.toThrow(`fallo ${kind}`);
      }
    });

    it('sin sesion de StudentOS (ApiError auth) -> auth_missing', async () => {
      respond(() => {
        throw new ApiError('auth', 'No hay una sesión iniciada.', { status: 401 });
      });
      expect((await facade.deleteStudentOsGymEventsFromMonday(TOKEN(), WEEK)).status).toBe('auth_missing');
    });

    it('resultado "partial": una serie se corta bien y otra falla por Google caido', async () => {
      const gym = (id: string) => ({
        id,
        summary: 'Gym',
        description: 'Programado desde StudentOS',
        start: { dateTime: '2026-11-10T07:00:00Z' },
        end: { dateTime: '2026-11-10T08:00:00Z' },
        extendedProperties: { private: { studentOsSource: 'student-os', studentOsCategory: 'gym' } },
      });
      respond((path, options) => {
        if (options?.method === 'GET') return { items: [gym('suelto-1'), gym('suelto-2')] };
        if (options?.method === 'DELETE' && path.endsWith('/suelto-2')) throw UPSTREAM();
        return null;
      });
      const result = await facade.deleteStudentOsGymEventsFromMonday(TOKEN(), WEEK);
      expect(result.status).toBe('partial');
      expect(result.deletedIds).toEqual(['suelto-1']);
      expect(result.failedCount).toBe(1);
    });

    it('un 400 de Google se informa con el texto del servidor', async () => {
      respond(() => {
        throw clientError(400, { code: 'google_bad_request', message: 'Google rechazo la solicitud: Invalid value for: end' });
      });
      await expect(
        facade.upsertGoogleGymEvent(TOKEN(), { title: 'x', dateIso: '2026-11-09', startTime: '07:00', endTime: '08:00' })
      ).rejects.toThrow(/Invalid value for: end/);
    });

    it('429 (limite) y 403 (permisos) conservan su semantica', async () => {
      respond(() => {
        throw new ApiError('rate_limit', 'Demasiadas peticiones.', { status: 429, body: { message: 'espera' } });
      });
      await expect(facade.fetchGoogleEventsAndBusyForWeek(TOKEN(), WEEK)).rejects.toThrow(/espera/);
      respond(() => {
        throw clientError(403, { code: 'google_forbidden', message: 'permisos' });
      });
      await expect(facade.fetchGoogleEventsAndBusyForWeek(TOKEN(), WEEK)).rejects.toThrow(/403/);
    });
  });

  describe('estado de la vinculacion', () => {
    it('disconnectGoogleCalendar (cierre de sesion) solo olvida lo LOCAL: no revoca la conexion del servidor', () => {
      connectedMeta();
      facade.disconnectGoogleCalendar();
      expect(facade.getStoredGoogleMeta()).toEqual({ connected: false });
      expect(request).not.toHaveBeenCalled();
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('refreshGoogleCloudConnection resume el estado para la UI (y es null fuera del modo nube)', async () => {
      respond(() => ({ configured: true, connected: true, needsReauth: true, email: 'a@b.c', connectedAt: null, scopes: [] }));
      expect(await facade.refreshGoogleCloudConnection()).toMatchObject({ accessToken: null, needsReauth: true, serverConfigured: true });

      respond(() => ({ configured: true, connected: true, needsReauth: false, email: 'a@b.c', connectedAt: null, scopes: [] }));
      expect(await facade.refreshGoogleCloudConnection()).toMatchObject({ accessToken: TOKEN(), needsReauth: false });

      vi.mocked(supabase.isSyncConfigured).mockReturnValue(false);
      expect(await facade.refreshGoogleCloudConnection()).toBeNull();
    });

    it('fetchGoogleUserProfile en modo nube usa el email del servidor, no la red de Google', async () => {
      respond(() => ({ configured: true, connected: true, needsReauth: false, email: 'ana@gmail.example', connectedAt: null, scopes: [] }));
      expect(await facade.fetchGoogleUserProfile(TOKEN())).toEqual({ email: 'ana@gmail.example' });
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });
});
