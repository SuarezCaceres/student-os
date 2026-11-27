/**
 * Scopes de Google Calendar que StudentOS pide y declara en la verificación de Google (spec 008, C8 y C9; ADR 0008).
 *
 * Fuente única: el web los pide en el consentimiento del login (`GOOGLE_LOGIN_CALENDAR_SCOPES`) y el API los pide al
 * reconectar (`GOOGLE_SCOPES`, que añade `openid email`). Cada lado tiene una prueba que fija esta lista a mano
 * (`scopes-verificados.spec.ts` en el API y `googleLogin.test.ts` en el web).
 *
 * Cambiar esta lista obliga a VOLVER A VERIFICAR la app en Google: actualiza antes la consola (Data access),
 * `docs/specs/008-verificacion-app-google/scopes.md`, las justificaciones, el guion del vídeo y la política de
 * privacidad, y pide la aprobación del humano.
 *
 * Solo `calendar.events.owned` (revisión del ADR 0008, 2026-11-26): la app lee los eventos del calendario `primary`
 * (también para calcular los huecos libres) y crea, edita y borra los suyos. No usa `freebusy.query` ni `calendars.get`.
 */
export const VERIFIED_GOOGLE_CALENDAR_SCOPES = ['https://www.googleapis.com/auth/calendar.events.owned'] as const;

export type VerifiedGoogleCalendarScope = (typeof VERIFIED_GOOGLE_CALENDAR_SCOPES)[number];
