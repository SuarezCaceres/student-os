// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { OFF_STATUS } from '../../sync/types';
import { syncStore } from '../../sync/syncStore';
import { SyncStatusBadge } from './SyncStatusBadge';

afterEach(() => {
  cleanup();
  syncStore.disable();
});

describe('SyncStatusBadge: aviso de limite visible (spec 010, C9)', () => {
  it('muestra el mensaje de limite como texto, no solo en un tooltip', () => {
    syncStore.publish({
      ...OFF_STATUS,
      phase: 'error',
      pending: 2,
      error: 'Llegaste al límite de registros de tu cuenta. Libera espacio para seguir sincronizando.',
    });
    render(<SyncStatusBadge />);
    expect(screen.getByRole('status').textContent).toContain('Límite de la cuenta alcanzado');
    expect(screen.getByRole('alert').textContent).toContain('Llegaste al límite de tu cuenta');
  });

  it('avisa de los cambios rechazados y desaparece el aviso cuando ya no los hay', () => {
    syncStore.publish({ ...OFF_STATUS, phase: 'idle', rejected: 1 });
    render(<SyncStatusBadge />);
    expect(screen.getByRole('alert').textContent).toContain('64 KB');
    act(() => syncStore.publish({ ...OFF_STATUS, phase: 'idle', rejected: 0 }));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('status').textContent).toContain('Sincronizado');
  });

  it('sin problemas no muestra ningun aviso', () => {
    syncStore.publish({ ...OFF_STATUS, phase: 'idle' });
    render(<SyncStatusBadge />);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
