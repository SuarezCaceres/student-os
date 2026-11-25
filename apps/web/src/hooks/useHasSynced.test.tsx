// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { syncStore } from '../sync/syncStore';
import { OFF_STATUS, type SyncStatus } from '../sync/types';
import { useHasSynced } from './useHasSynced';

afterEach(() => {
  cleanup();
  act(() => syncStore.disable());
});

const status = (extra: Partial<SyncStatus> = {}): SyncStatus => ({ ...OFF_STATUS, phase: 'syncing', ...extra });

function Probe({ onRender }: { onRender: () => void }) {
  const hasSynced = useHasSynced();
  onRender();
  return <span data-testid="synced">{String(hasSynced)}</span>;
}

describe('useHasSynced', () => {
  it('es false sin sincronización y pasa a true cuando llega la primera', () => {
    render(<Probe onRender={() => {}} />);
    expect(screen.getByTestId('synced').textContent).toBe('false');
    act(() => syncStore.publish(status({ lastSyncAt: null })));
    expect(screen.getByTestId('synced').textContent).toBe('false');
    act(() => syncStore.publish(status({ phase: 'idle', lastSyncAt: 1000 })));
    expect(screen.getByTestId('synced').textContent).toBe('true');
  });

  it('no re-renderiza el componente cuando el store publica cambios que no alteran el booleano', () => {
    let renders = 0;
    render(<Probe onRender={() => (renders += 1)} />);
    act(() => syncStore.publish(status({ phase: 'syncing', pending: 1 })));
    act(() => syncStore.publish(status({ phase: 'syncing', pending: 2 })));
    act(() => syncStore.publish(status({ phase: 'idle', pending: 0 })));
    expect(renders).toBe(1);

    act(() => syncStore.publish(status({ phase: 'idle', lastSyncAt: 1000 })));
    expect(renders).toBe(2);
    const afterFirstSync = renders;
    act(() => syncStore.publish(status({ phase: 'syncing', lastSyncAt: 1000, pending: 3 })));
    act(() => syncStore.publish(status({ phase: 'idle', lastSyncAt: 2000 })));
    expect(renders).toBe(afterFirstSync);
  });
});
