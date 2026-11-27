// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import type { DayOfWeek } from '../types';
import { GOOGLE_REAUTH_MESSAGES } from './googleReauthMessages';
import { deleteStudentOsGymEventsFromMonday, fetchGoogleEventsAndBusyForWeek, upsertGoogleGymEvent } from './googleCalendar';

vi.mock('./supabase', () => ({
  isSyncConfigured: vi.fn(() => true),
  getAccessToken: vi.fn(async () => 'supabase-jwt'),
  getSupabase: vi.fn(async () => null),
}));

/**
 * Spec 009: Calendar se vincula al iniciar sesión con Google y en Google Sync ya no hay botón «Conectar» ni «Reconectar».
 * Los avisos de acceso caducado deben pedir la acción que sí existe: cerrar sesión y volver a entrar con Google.
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

/** Acciones que dejaron de existir con la spec 009. */
const RETIRED_ACTION = /Google Sync|reconect|conectar tu cuenta|al conectar Google Calendar/i;
const REAL_ACTION = /(Cierra|cierra|cierres) sesión y (vuelve|vuelvas) a entrar con Google/;

/** Código de la web (sin pruebas) para detectar si alguien vuelve a pedir reconectar en Google Sync. */
const WEB_SOURCES = import.meta.glob<string>(['../**/*.{ts,tsx}', '!../**/*.test.{ts,tsx}'], {
  query: '?raw',
  import: 'default',
  eager: true,
});

describe('avisos de acceso a Google caducado (spec 009)', () => {
  it.each(Object.entries(GOOGLE_REAUTH_MESSAGES))('%s pide cerrar sesión y volver a entrar con Google', (_key, text) => {
    expect(text).toMatch(REAL_ACTION);
    expect(text).not.toMatch(RETIRED_ACTION);
  });

  it('el aviso del turno laboral sin acceso pide volver a entrar con Google para publicar la serie', () => {
    expect(GOOGLE_REAUTH_MESSAGES.workShiftSavedLocally).toBe(
      'Tu sesión de Google Calendar expiró. El turno laboral quedó guardado localmente; cierra sesión y vuelve a entrar con Google para publicar su serie recurrente.',
    );
  });

  it('borrar eventos del gym sin acceso devuelve auth_missing con la acción real', async () => {
    const result = await deleteStudentOsGymEventsFromMonday('', WEEK);

    expect(result.status).toBe('auth_missing');
    expect(result.message).toBe(GOOGLE_REAUTH_MESSAGES.deleteEventsMissingAccess);
    expect(result.message).toMatch(REAL_ACTION);
  });

  it('leer o escribir en Calendar sin acceso falla con un error que pide volver a entrar con Google', async () => {
    await expect(fetchGoogleEventsAndBusyForWeek('', WEEK)).rejects.toThrow(GOOGLE_REAUTH_MESSAGES.calendarNotConnected);
    await expect(
      upsertGoogleGymEvent('', { title: 'Gym', date: '2026-11-09', startTime: '07:00', endTime: '08:00' } as never),
    ).rejects.toThrow(GOOGLE_REAUTH_MESSAGES.calendarNotConnected);
  });

  it('ningún texto de la web remite a reconectar en Google Sync', () => {
    const files = Object.keys(WEB_SOURCES);
    expect(files.length).toBeGreaterThan(20);
    const offenders = files.filter((file) =>
      /Reconecta(r)? (manualmente )?en Google Sync|reconect(es|ar) Google Sync/i.test(WEB_SOURCES[file]),
    );
    expect(offenders).toEqual([]);
  });
});
