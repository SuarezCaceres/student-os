// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../services/api';

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  signOut: vi.fn().mockResolvedValue(undefined),
  clearSync: vi.fn().mockResolvedValue(undefined),
  configured: true,
  session: { status: 'signedIn', session: null, user: { id: 'user-1' } } as {
    status: string;
    session: null;
    user: { id: string } | null;
  },
}));

vi.mock('../../services/api', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../services/api')>();
  return { ...original, getApiClient: () => ({ request: mocks.request }) };
});
vi.mock('../../services/supabase', () => ({
  isSyncConfigured: () => mocks.configured,
  signOut: mocks.signOut,
  useSupabaseSession: () => mocks.session,
}));
vi.mock('../../utils/accountDataCleanup', () => ({ clearSyncDataOnSignOut: mocks.clearSync }));

import { AccountPanel } from './AccountPanel';

describe('AccountPanel', () => {
  beforeEach(() => {
    mocks.configured = true;
    mocks.session = { status: 'signedIn', session: null, user: { id: 'user-1' } };
    mocks.request.mockReset();
    mocks.signOut.mockClear();
    mocks.clearSync.mockClear();
    // jsdom no implementa estas APIs de descarga.
    URL.createObjectURL = vi.fn(() => 'blob:fake');
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  });
  afterEach(cleanup);

  it('no se muestra si la nube no esta configurada', () => {
    mocks.configured = false;
    const { container } = render(<AccountPanel />);
    expect(container.innerHTML).toBe('');
  });

  it('no se muestra sin sesion iniciada', () => {
    mocks.session = { status: 'signedOut', session: null, user: null };
    const { container } = render(<AccountPanel />);
    expect(container.innerHTML).toBe('');
  });

  it('descarga los datos y avisa cuantos registros incluye', async () => {
    mocks.request.mockResolvedValue({ counts: { total: 1 }, records: [{ id: 'a' }] });
    render(<AccountPanel />);
    fireEvent.click(screen.getByRole('button', { name: /Descargar mis datos/ }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/con 1 registro\./));
    expect(mocks.request).toHaveBeenCalledWith('/account/export');
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  });

  it('si la descarga falla por limite de frecuencia muestra un mensaje claro', async () => {
    mocks.request.mockRejectedValue(new ApiError('rate_limit', 'x', { status: 429, retryAfterMs: 120_000 }));
    render(<AccountPanel />);
    fireEvent.click(screen.getByRole('button', { name: /Descargar mis datos/ }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('2 minutos');
  });

  it('borrar exige escribir BORRAR; hasta entonces el boton esta desactivado', async () => {
    render(<AccountPanel />);
    fireEvent.click(screen.getByRole('button', { name: /^Borrar mi cuenta$/ }));
    const confirmButton = await screen.findByRole('button', { name: /Borrar para siempre/ });
    expect((confirmButton as HTMLButtonElement).disabled).toBe(true);

    const input = screen.getByLabelText(/Escribe BORRAR/);
    fireEvent.change(input, { target: { value: 'borrar' } });
    expect((confirmButton as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(input, { target: { value: 'BORRAR' } });
    expect((confirmButton as HTMLButtonElement).disabled).toBe(false);
    expect(mocks.request).not.toHaveBeenCalled();
  });

  it('confirmado: borra en el servidor, limpia la cola, cierra sesion y avisa al integrador', async () => {
    mocks.request.mockResolvedValue({ deleted: true });
    const onAccountDeleted = vi.fn();
    const onClearLocalData = vi.fn();
    render(<AccountPanel onAccountDeleted={onAccountDeleted} onClearLocalData={onClearLocalData} />);
    fireEvent.click(screen.getByRole('button', { name: /^Borrar mi cuenta$/ }));
    fireEvent.change(await screen.findByLabelText(/Escribe BORRAR/), { target: { value: 'BORRAR' } });
    fireEvent.click(screen.getByRole('button', { name: /Borrar para siempre/ }));

    await waitFor(() => expect(onAccountDeleted).toHaveBeenCalledTimes(1));
    expect(mocks.request).toHaveBeenCalledWith('/account', { method: 'DELETE', body: { confirm: 'BORRAR' } });
    expect(mocks.clearSync).toHaveBeenCalledWith('user-1');
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
    expect(onClearLocalData).toHaveBeenCalledTimes(1);
  });

  it('si el servidor falla (424) no cierra sesion y deja reintentar', async () => {
    mocks.request.mockRejectedValue(
      new ApiError('client', 'x', { status: 424, body: { message: ['...', 'google: fallo (Error)'] } }),
    );
    const onAccountDeleted = vi.fn();
    render(<AccountPanel onAccountDeleted={onAccountDeleted} />);
    fireEvent.click(screen.getByRole('button', { name: /^Borrar mi cuenta$/ }));
    fireEvent.change(await screen.findByLabelText(/Escribe BORRAR/), { target: { value: 'BORRAR' } });
    fireEvent.click(screen.getByRole('button', { name: /Borrar para siempre/ }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Google Calendar');
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(onAccountDeleted).not.toHaveBeenCalled();
    expect((screen.getByRole('button', { name: /Borrar para siempre/ }) as HTMLButtonElement).disabled).toBe(false);
  });
});
