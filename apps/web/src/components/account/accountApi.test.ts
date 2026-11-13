import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../services/api';
import {
  DELETE_CONFIRMATION,
  deleteAccountOnServer,
  describeAccountError,
  exportFileName,
  failedModules,
  fetchAccountExport,
} from './accountApi';

describe('exportFileName', () => {
  it('usa la fecha local con ceros a la izquierda', () => {
    expect(exportFileName(new Date(2026, 0, 5, 12))).toBe('studentos-datos-2026-01-05.json');
  });
});

describe('fetchAccountExport', () => {
  it('pide /account/export y devuelve el JSON con sangria y el total', async () => {
    const request = vi.fn().mockResolvedValue({ schemaVersion: 1, counts: { total: 7 }, records: [] });
    const result = await fetchAccountExport({ request } as never, new Date(2026, 10, 13));
    expect(request).toHaveBeenCalledWith('/account/export');
    expect(result.total).toBe(7);
    expect(result.fileName).toBe('studentos-datos-2026-11-13.json');
    expect(JSON.parse(result.text)).toMatchObject({ schemaVersion: 1 });
    expect(result.text).toContain('\n  ');
  });

  it('rechaza una respuesta que no es un objeto', async () => {
    const request = vi.fn().mockResolvedValue(null);
    await expect(fetchAccountExport({ request } as never)).rejects.toThrow(/formato/);
  });
});

describe('deleteAccountOnServer', () => {
  it('envia DELETE /account con la confirmacion exacta', async () => {
    const request = vi.fn().mockResolvedValue({ deleted: true });
    await deleteAccountOnServer({ request } as never);
    expect(request).toHaveBeenCalledWith('/account', { method: 'DELETE', body: { confirm: DELETE_CONFIRMATION } });
    expect(DELETE_CONFIRMATION).toBe('BORRAR');
  });
});

describe('mensajes de error', () => {
  const failed424 = new ApiError('client', 'rechazada', {
    status: 424,
    body: { message: ['No se pudo completar...', 'google: fallo (Error)', 'calendar: ok'] },
  });

  it('extrae los servicios que fallaron en un 424', () => {
    expect(failedModules(failed424)).toEqual(['Google Calendar']);
    expect(failedModules(new Error('x'))).toEqual([]);
  });

  it('explica el 424 sin tecnicismos y dice que no se borro nada', () => {
    const text = describeAccountError(failed424, 'delete');
    expect(text).toContain('Google Calendar');
    expect(text).toContain('no se borró nada');
  });

  it('traduce limite de frecuencia a minutos', () => {
    const error = new ApiError('rate_limit', 'x', { status: 429, retryAfterMs: 540_000 });
    expect(describeAccountError(error, 'export')).toContain('9 minutos');
    expect(describeAccountError(new ApiError('rate_limit', 'x'), 'export')).toContain('unos minutos');
  });

  it.each([
    ['offline', 'conexión'],
    ['auth', 'sesión'],
    ['timeout', 'servidor'],
    ['server', 'servidor'],
  ] as const)('caso %s', (kind, fragment) => {
    expect(describeAccountError(new ApiError(kind, 'x'), 'export')).toContain(fragment);
  });

  it('error desconocido: mensaje generico que nombra la accion', () => {
    expect(describeAccountError(new Error('boom'), 'delete')).toContain('borrar tu cuenta');
    expect(describeAccountError(new Error('boom'), 'export')).toContain('descargar tus datos');
    expect(describeAccountError(new Error('boom detalle-interno'), 'export')).not.toContain('detalle-interno');
  });
});
