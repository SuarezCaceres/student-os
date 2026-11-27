// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import * as facade from './googleCalendar';

/**
 * Candado de la fachada: las firmas exportadas de `googleCalendar.ts` NO pueden cambiar (Gym, Calendario, App y los
 * modales las consumen). Solo se permite AGREGAR exports. `Function.length` cuenta los parametros sin valor por
 * defecto, asi que detecta quitar/agregar parametros obligatorios.
 *
 * Spec 009 (aprobado por el dueno): se retiro el transporte de Google Identity Services (token de 1 hora en el
 * navegador) y con el la conexion manual. Lo retirado esta en RETIRED_EXPORTS y ya no puede volver a aparecer.
 *
 * Revision del ADR 0008 (2026-11-26, decision del humano): la app solo pide `calendar.events.owned`, asi que se retiro
 * `fetchGoogleBusyIntervalsForWeek` (usaba `freebusy.query`, que exige otro scope y nadie la llamaba).
 */
const FROZEN_FUNCTIONS: Record<string, number> = {
  getStoredGoogleMeta: 0,
  getStoredAccessToken: 0,
  isGoogleCalendarReady: 0,
  fetchGoogleUserProfile: 1,
  trySilentGoogleReconnect: 0,
  disconnectGoogleCalendar: 0,
  fetchGoogleEventsAndBusyForWeek: 2,
  buildWeeklyRecurrenceRule: 2,
  formatPrevSundayUntilUtc: 1,
  upsertGoogleGymEvent: 2,
  deleteGoogleGymEvent: 2,
  deleteStudentOsGymEventsFromMonday: 2,
  clearOrCutoffWorkShiftEventsFromMonday: 2,
  upsertWorkShiftRecurringSeries: 2,
};

/** Retirados por la spec 009: el login con Google ya vincula Calendar y el navegador no maneja tokens de Google. */
const RETIRED_EXPORTS = [
  'hasEnvGoogleClientId',
  'getConfiguredGoogleClientId',
  'saveCustomGoogleClientId',
  'signInWithGoogleAccount',
  'connectGoogleCalendar',
  'beginGoogleCloudConnect',
  'disconnectGoogleCalendarCloud',
  'consumeGoogleRedirectResult',
  'GOOGLE_CLIENT_ID_STORAGE_KEY',
  // ADR 0008, revision 2026-11-26: sin el scope `calendar.freebusy` no puede existir.
  'fetchGoogleBusyIntervalsForWeek',
];

const FROZEN_CONSTANTS: Record<string, string> = {
  GOOGLE_META_STORAGE_KEY: 'student_os_gcal_meta',
};

describe('googleCalendar: firmas exportadas congeladas (patron fachada)', () => {
  it.each(Object.entries(FROZEN_FUNCTIONS))('%s sigue exportada con %i parametros obligatorios', (name, length) => {
    const value = (facade as Record<string, unknown>)[name];
    expect(typeof value).toBe('function');
    expect((value as (...args: unknown[]) => unknown).length).toBe(length);
  });

  it.each(RETIRED_EXPORTS)('%s fue retirada (spec 009 / ADR 0008) y no debe volver', (name) => {
    expect((facade as Record<string, unknown>)[name]).toBeUndefined();
  });

  it('upsertGoogleCalendarEvent sigue siendo un alias de upsertGoogleGymEvent', () => {
    expect(facade.upsertGoogleCalendarEvent).toBe(facade.upsertGoogleGymEvent);
  });

  it.each(Object.entries(FROZEN_CONSTANTS))('la constante %s conserva su valor', (name, value) => {
    expect((facade as Record<string, unknown>)[name]).toBe(value);
  });
});
