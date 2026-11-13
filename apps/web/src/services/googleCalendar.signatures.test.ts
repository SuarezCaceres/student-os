// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import * as facade from './googleCalendar';

/**
 * Candado de la fachada: las firmas exportadas de `googleCalendar.ts` NO pueden cambiar (Gym, Calendario, App y los
 * modales las consumen). Solo se permite AGREGAR exports. `Function.length` cuenta los parametros sin valor por
 * defecto, asi que detecta quitar/agregar parametros obligatorios.
 */
const FROZEN_FUNCTIONS: Record<string, number> = {
  hasEnvGoogleClientId: 0,
  getConfiguredGoogleClientId: 0,
  saveCustomGoogleClientId: 1,
  getStoredGoogleMeta: 0,
  getStoredAccessToken: 0,
  isGoogleCalendarReady: 1,
  fetchGoogleUserProfile: 1,
  signInWithGoogleAccount: 2,
  connectGoogleCalendar: 1,
  trySilentGoogleReconnect: 0,
  disconnectGoogleCalendar: 1,
  fetchGoogleEventsAndBusyForWeek: 2,
  fetchGoogleBusyIntervalsForWeek: 2,
  buildWeeklyRecurrenceRule: 2,
  formatPrevSundayUntilUtc: 1,
  upsertGoogleGymEvent: 2,
  deleteGoogleGymEvent: 2,
  deleteStudentOsGymEventsFromMonday: 2,
  clearOrCutoffWorkShiftEventsFromMonday: 2,
  upsertWorkShiftRecurringSeries: 2,
};

const FROZEN_CONSTANTS: Record<string, string> = {
  GOOGLE_CLIENT_ID_STORAGE_KEY: 'student_os_gcal_client_id',
  GOOGLE_META_STORAGE_KEY: 'student_os_gcal_meta',
};

describe('googleCalendar: firmas exportadas congeladas (patron fachada)', () => {
  it.each(Object.entries(FROZEN_FUNCTIONS))('%s sigue exportada con %i parametros obligatorios', (name, length) => {
    const value = (facade as Record<string, unknown>)[name];
    expect(typeof value).toBe('function');
    expect((value as (...args: unknown[]) => unknown).length).toBe(length);
  });

  it('upsertGoogleCalendarEvent sigue siendo un alias de upsertGoogleGymEvent', () => {
    expect(facade.upsertGoogleCalendarEvent).toBe(facade.upsertGoogleGymEvent);
  });

  it.each(Object.entries(FROZEN_CONSTANTS))('la constante %s conserva su valor', (name, value) => {
    expect((facade as Record<string, unknown>)[name]).toBe(value);
  });
});
