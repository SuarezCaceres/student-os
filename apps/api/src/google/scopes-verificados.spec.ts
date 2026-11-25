import { GOOGLE_SCOPES, REQUIRED_EVENTS_SCOPE } from './google.constants';

/**
 * Spec 008 · C8. Lista de scopes declarados (o por declarar) en la pantalla de consentimiento de Google y enviados a
 * verificación. Si cambias `GOOGLE_SCOPES`, esta prueba falla A PROPÓSITO.
 *
 * Cambiar scopes después de la verificación obliga a VOLVER A VERIFICAR la app en Google (semanas de revisión):
 * antes de tocar esta lista, actualiza la consola (Data access), `docs/specs/008-verificacion-app-google/scopes.md`,
 * las justificaciones, el guion del vídeo y la política de privacidad, y pide la aprobación del humano (ver la spec 008,
 * «Si Google pide cambios», y el ADR 0005).
 */
const SCOPES_VERIFICADOS = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/calendar.events.owned',
  'https://www.googleapis.com/auth/calendar.freebusy',
  'https://www.googleapis.com/auth/calendar.calendars.readonly',
] as const;

const AVISO =
  'GOOGLE_SCOPES no coincide con los scopes verificados en Google. Cambiar scopes obliga a VOLVER A VERIFICAR la app ' +
  '(spec 008, C8): actualiza la consola, scopes.md, las justificaciones, el vídeo y la política, y pide aprobación al humano.';

describe('Scopes verificados en Google (spec 008, C8)', () => {
  it('GOOGLE_SCOPES coincide exactamente con la lista de scopes verificados', () => {
    const actuales = [...GOOGLE_SCOPES].sort();
    const verificados = [...SCOPES_VERIFICADOS].sort();
    if (JSON.stringify(actuales) !== JSON.stringify(verificados)) {
      throw new Error(`${AVISO}\n  Actuales:    ${actuales.join(' ')}\n  Verificados: ${verificados.join(' ')}`);
    }
  });

  it('no hay scopes repetidos', () => {
    expect(new Set(GOOGLE_SCOPES).size).toBe(GOOGLE_SCOPES.length);
  });

  it('no se pide profile ni ningún scope amplio de Calendar', () => {
    expect(GOOGLE_SCOPES).not.toContain('profile');
    for (const amplio of ['https://www.googleapis.com/auth/calendar', 'https://www.googleapis.com/auth/calendar.readonly', 'https://www.googleapis.com/auth/calendar.events']) {
      expect(GOOGLE_SCOPES).not.toContain(amplio);
    }
  });

  it('el scope obligatorio para escribir eventos está entre los verificados', () => {
    expect(SCOPES_VERIFICADOS).toContain(REQUIRED_EVENTS_SCOPE);
  });
});
