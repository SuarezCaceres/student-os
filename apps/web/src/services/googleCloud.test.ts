import { describe, expect, it } from 'vitest';
import { toProxyTarget } from './googleCloud';

/**
 * ADR 0008, revisión 2026-11-26: la app solo pide `calendar.events.owned`, así que el proxy solo expone rutas de
 * eventos del calendario `primary`. `freeBusy` y `calendars/primary` exigen otros scopes y ya no se traducen.
 */
describe('toProxyTarget: solo rutas de eventos del calendario primary', () => {
  it('traduce la lista de eventos conservando la query', () => {
    expect(toProxyTarget('calendars/primary/events?singleEvents=true&maxResults=250')).toEqual({
      path: '/google/calendar/events',
      query: { singleEvents: 'true', maxResults: '250' },
    });
  });

  it('traduce un evento concreto y sus instancias', () => {
    expect(toProxyTarget('calendars/primary/events/abc123').path).toBe('/google/calendar/events/abc123');
    expect(toProxyTarget('calendars/primary/events/abc123/instances').path).toBe('/google/calendar/events/abc123/instances');
  });

  it.each(['freeBusy', 'calendars/primary', 'calendars/otro@example.com/events', 'users/me/calendarList'])(
    'rechaza %s: necesitaría un scope que la app no pide',
    (path) => {
      expect(() => toProxyTarget(path)).toThrow(/no soportada/);
    },
  );
});
