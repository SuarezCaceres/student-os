// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DayOfWeek } from '../types';
import {
  deleteGoogleGymEvent,
  deleteStudentOsGymEventsFromMonday,
  disconnectGoogleCalendar,
  fetchGoogleBusyIntervalsForWeek,
  fetchGoogleEventsAndBusyForWeek,
  getStoredAccessToken,
  getStoredGoogleMeta,
  isGoogleCalendarReady,
  trySilentGoogleReconnect,
  upsertGoogleGymEvent,
} from './googleCalendar';

/**
 * MODO GIS (la app desplegada hoy: sin VITE_API_URL ni Supabase). Estas pruebas fijan que la fachada habla con
 * Google DIRECTAMENTE con el token del navegador, con exactamente las mismas URLs, metodos y cabeceras de siempre.
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
const BASE = 'https://www.googleapis.com/calendar/v3';

interface Recorded {
  url: URL;
  method: string;
  headers: Record<string, string>;
  body?: unknown;
}

function stubFetch(responder: (call: Recorded) => Response | Promise<Response>) {
  const calls: Recorded[] = [];
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const call: Recorded = {
      url: new URL(String(input)),
      method: init?.method ?? 'GET',
      headers: { ...((init?.headers as Record<string, string> | undefined) ?? {}) },
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    };
    calls.push(call);
    return responder(call);
  });
  vi.stubGlobal('fetch', fn);
  return calls;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('googleCalendar en modo GIS (sin nube configurada)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('isGoogleCalendarReady depende solo del client id del navegador', () => {
    expect(isGoogleCalendarReady()).toBe(false);
    expect(isGoogleCalendarReady('abc.apps.googleusercontent.com')).toBe(true);
  });

  it('sin token en sessionStorage no hay access token y trySilentGoogleReconnect devuelve null sin tocar la red', async () => {
    const calls = stubFetch(() => json({}));
    expect(getStoredAccessToken()).toBeNull();
    expect(await trySilentGoogleReconnect()).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it('usa el token vigente de sessionStorage', () => {
    window.sessionStorage.setItem(
      'student_os_gcal_token',
      JSON.stringify({ accessToken: 'tok-sesion', expiresAt: Date.now() + 3_600_000 }),
    );
    expect(getStoredAccessToken()).toBe('tok-sesion');
  });

  it('lista eventos de la semana directo en Google con Authorization: Bearer <token> y sin method', async () => {
    window.localStorage.setItem('student_os_gcal_meta', JSON.stringify({ connected: true }));
    const calls = stubFetch(() =>
      json({
        defaultReminders: [{ method: 'popup', minutes: 10 }],
        items: [
          {
            id: 'ev1',
            summary: 'Clase',
            start: { dateTime: '2026-11-10T15:00:00Z' },
            end: { dateTime: '2026-11-10T16:00:00Z' },
          },
        ],
      }),
    );
    const { events } = await fetchGoogleEventsAndBusyForWeek('tok-gis', WEEK);
    expect(events.length).toBeGreaterThan(0);
    expect(calls).toHaveLength(1);
    expect(calls[0].url.origin + calls[0].url.pathname).toBe(`${BASE}/calendars/primary/events`);
    expect(Object.fromEntries(calls[0].url.searchParams)).toMatchObject({
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '250',
    });
    expect(calls[0].method).toBe('GET');
    expect(calls[0].headers).toEqual({ Authorization: 'Bearer tok-gis' });
    // Actualiza lastSyncedAt como siempre.
    expect(getStoredGoogleMeta().lastSyncedAt).toBeTruthy();
  });

  it('freeBusy: POST con Authorization + Content-Type y el cuerpo de siempre', async () => {
    const calls = stubFetch(() => json({ calendars: { primary: { busy: [] } } }));
    await fetchGoogleBusyIntervalsForWeek('tok-gis', WEEK);
    expect(calls[0].url.href).toBe(`${BASE}/freeBusy`);
    expect(calls[0].method).toBe('POST');
    expect(calls[0].headers).toEqual({ Authorization: 'Bearer tok-gis', 'Content-Type': 'application/json' });
    expect(calls[0].body).toMatchObject({ items: [{ id: 'primary' }] });
  });

  it('upsert: POST a /events para crear y PATCH a /events/<id> para actualizar (con RRULE y avisos)', async () => {
    const calls = stubFetch((call) => json({ id: call.method === 'POST' ? 'nuevo' : 'existente', htmlLink: 'https://x' }));
    const created = await upsertGoogleGymEvent('tok-gis', {
      title: 'Gym',
      dateIso: '2026-11-09',
      startTime: '07:00',
      endTime: '08:00',
      recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=MO'],
      reminderMinutes: [60],
      studentOsCategory: 'gym',
    });
    expect(created.eventId).toBe('nuevo');
    expect(calls[0].method).toBe('POST');
    expect(calls[0].url.href).toBe(`${BASE}/calendars/primary/events`);
    expect(calls[0].headers).toEqual({ Authorization: 'Bearer tok-gis', 'Content-Type': 'application/json' });
    expect(calls[0].body).toMatchObject({
      summary: 'Gym',
      recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=MO'],
      reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 60 }] },
      extendedProperties: { private: { studentOsSource: 'student-os', studentOsCategory: 'gym' } },
    });

    await upsertGoogleGymEvent('tok-gis', {
      eventId: 'abc',
      title: 'Gym',
      dateIso: '2026-11-09',
      startTime: '07:00',
      endTime: '08:00',
    });
    expect(calls[1].method).toBe('PATCH');
    expect(calls[1].url.href).toBe(`${BASE}/calendars/primary/events/abc`);
  });

  it('upsert: si el evento fue borrado en Google (404) lo recrea con POST', async () => {
    const calls = stubFetch((call) => (call.method === 'PATCH' ? json({}, 404) : json({ id: 'recreado' })));
    const result = await upsertGoogleGymEvent('tok-gis', {
      eventId: 'borrado',
      title: 'Gym',
      dateIso: '2026-11-09',
      startTime: '07:00',
      endTime: '08:00',
    });
    expect(result.eventId).toBe('recreado');
    expect(calls.map((c) => c.method)).toEqual(['PATCH', 'POST']);
  });

  it('delete: DELETE con solo Authorization; 404/410 no son error', async () => {
    const calls = stubFetch(() => new Response(null, { status: 410 }));
    await expect(deleteGoogleGymEvent('tok-gis', 'ev/1')).resolves.toBeUndefined();
    expect(calls[0].url.href).toBe(`${BASE}/calendars/primary/events/ev%2F1`);
    expect(calls[0].method).toBe('DELETE');
    expect(calls[0].headers).toEqual({ Authorization: 'Bearer tok-gis' });
  });

  it('un 401 de Google se traduce al mensaje "expiro" y limpia el token de sesion', async () => {
    window.sessionStorage.setItem(
      'student_os_gcal_token',
      JSON.stringify({ accessToken: 'tok-viejo', expiresAt: Date.now() + 3_600_000 }),
    );
    stubFetch(() => json({ error: { message: 'Invalid Credentials' } }, 401));
    await expect(fetchGoogleEventsAndBusyForWeek('tok-viejo', WEEK)).rejects.toThrow(/expiró/);
    expect(window.sessionStorage.getItem('student_os_gcal_token')).toBeNull();
  });

  it('un 403 mantiene su mensaje de permisos', async () => {
    stubFetch(() => json({}, 403));
    await expect(fetchGoogleEventsAndBusyForWeek('tok-gis', WEEK)).rejects.toThrow(/403/);
  });

  it('borrado de series: sin token -> auth_missing; con 401 -> auth_missing', async () => {
    const empty = await deleteStudentOsGymEventsFromMonday('', WEEK);
    expect(empty.status).toBe('auth_missing');

    stubFetch(() => json({}, 401));
    const expired = await deleteStudentOsGymEventsFromMonday('tok-gis', WEEK);
    expect(expired.status).toBe('auth_missing');
  });

  it('borrado de series: recorta con UNTIL las series previas al lunes y borra las nuevas (PATCH + DELETE)', async () => {
    const master = (id: string, startDay: string) => ({
      id,
      summary: 'Gym',
      description: 'Programado desde StudentOS',
      start: { dateTime: `${startDay}T07:00:00Z` },
      end: { dateTime: `${startDay}T08:00:00Z` },
      recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=MO'],
      extendedProperties: { private: { studentOsSource: 'student-os', studentOsCategory: 'gym' } },
    });
    const calls = stubFetch((call) => {
      const path = call.url.pathname;
      if (call.method === 'GET' && path.endsWith('/events')) {
        return json({
          items: [
            { ...master('inst-old', '2026-11-09'), id: 'inst-old', recurringEventId: 'serie-vieja', recurrence: undefined },
            { ...master('inst-new', '2026-11-09'), id: 'inst-new', recurringEventId: 'serie-nueva', recurrence: undefined },
          ],
        });
      }
      if (call.method === 'GET' && path.endsWith('/events/serie-vieja')) return json(master('serie-vieja', '2026-10-05'));
      if (call.method === 'GET' && path.endsWith('/events/serie-nueva')) return json(master('serie-nueva', '2026-11-09'));
      if (call.method === 'PATCH') return json({});
      return new Response(null, { status: 204 });
    });
    const result = await deleteStudentOsGymEventsFromMonday('tok-gis', WEEK);
    expect(result.status).toBe('ok');
    expect(result.cutSeriesCount).toBe(1);
    const patch = calls.find((c) => c.method === 'PATCH');
    expect(patch?.url.pathname.endsWith('/events/serie-vieja')).toBe(true);
    expect((patch?.body as { recurrence?: string[] } | undefined)?.recurrence?.[0]).toMatch(/UNTIL=\d{8}T\d{6}Z$/);
    expect(calls.some((c) => c.method === 'DELETE' && c.url.pathname.endsWith('/events/serie-nueva'))).toBe(true);
    expect(calls.every((c) => c.headers.Authorization === 'Bearer tok-gis')).toBe(true);
  });

  it('disconnectGoogleCalendar limpia el token y la meta, y revoca con GIS si esta cargado', () => {
    const revoke = vi.fn();
    (window as unknown as { google: unknown }).google = { accounts: { oauth2: { revoke } } };
    window.localStorage.setItem('student_os_gcal_meta', JSON.stringify({ connected: true, email: 'a@b.c' }));
    disconnectGoogleCalendar('tok-gis');
    expect(getStoredGoogleMeta()).toEqual({ connected: false });
    expect(revoke).toHaveBeenCalledWith('tok-gis', expect.any(Function));
    delete (window as unknown as { google?: unknown }).google;
  });
});
