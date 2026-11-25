import { describe, expect, it } from 'vitest';
import { QUOTA_DETAIL, REJECTED_DETAIL, describeSyncStatus } from '../describeStatus';

const base = { phase: 'idle' as const, pending: 0, online: true, waking: false };
// Mismo texto que deja el motor al recibir un 422 (ver engine.ts); la prueba del motor comprueba que sigue diciendo "limite".
const QUOTA_ERROR = 'Llegaste al límite de registros de tu cuenta. Libera espacio para seguir sincronizando.';

describe('describeSyncStatus: limites de la cuenta (spec 010, C9)', () => {
  it('con la cuota agotada (422) lo dice con claridad y explica que lo guardado esta a salvo', () => {
    const label = describeSyncStatus({ ...base, phase: 'error', pending: 2, error: QUOTA_ERROR, rejected: 0 });
    expect(label).toMatchObject({ text: 'Límite de la cuenta alcanzado', tone: 'danger', icon: 'alert', detail: QUOTA_DETAIL });
    expect(label.detail).toContain('lo que ya guardaste está a salvo');
  });

  it('un error cualquiera que no es de cuota conserva su texto de siempre y no inventa un aviso de limite', () => {
    const label = describeSyncStatus({ ...base, phase: 'error', pending: 0, error: 'Fallo raro', rejected: 0 });
    expect(label.text).toBe('No se pudo sincronizar');
    expect(label.detail).toBeUndefined();
  });

  it('con cambios rechazados (registro de mas de 64 KB u otro rechazo) avisa en vez de decir Sincronizado', () => {
    const label = describeSyncStatus({ ...base, rejected: 2 });
    expect(label).toMatchObject({ text: 'Sin sincronizar (2)', tone: 'warn', icon: 'alert', detail: REJECTED_DETAIL });
    expect(label.detail).toContain('64 KB');
  });

  it('sin rechazos ni errores sigue diciendo Sincronizado', () => {
    expect(describeSyncStatus({ ...base, rejected: 0, error: null })).toMatchObject({ text: 'Sincronizado', tone: 'ok' });
    expect(describeSyncStatus(base)).toMatchObject({ text: 'Sincronizado', tone: 'ok' });
  });

  it('sin conexion manda sobre los avisos de limite', () => {
    expect(describeSyncStatus({ ...base, online: false, rejected: 3 }).text).toBe('Sin conexión');
  });
});
