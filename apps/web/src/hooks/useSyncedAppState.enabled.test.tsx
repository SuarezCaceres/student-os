// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { act, cleanup, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SyncStatusBadge } from '../components/sync/SyncStatusBadge';
import { initialData } from '../data/initialData';
import { FakeServer, fakeKanbanAdapter, makeApi, task } from '../sync/__tests__/helpers';
import { SYNC_DOC_PREFIX, getDefaultSyncStorage } from '../sync/storage';
import { useSyncedAppState } from './useSyncedAppState';

const h = vi.hoisted(() => ({
  api: null as unknown,
  session: { status: 'signedIn' as 'signedIn' | 'signedOut', session: null, user: { id: 'user-1' } as { id: string } | null },
}));

vi.mock('../sync/adapters', () => ({ syncAdapters: [] as unknown[] }));
vi.mock('../services/supabase', async (orig) => ({
  ...(await orig<typeof import('../services/supabase')>()),
  isSyncConfigured: () => true,
  useSupabaseSession: () => h.session,
}));
vi.mock('../services/api', async (orig) => ({
  ...(await orig<typeof import('../services/api')>()),
  getApiClient: () => h.api,
}));
vi.mock('../sync/backup', () => ({ downloadBackup: vi.fn() }));

const KEY = 'student_os_state_v1';
const EMPTY = { ...initialData, kanbanItems: [] };

describe('useSyncedAppState con sesion y configuracion completa', () => {
  let server: FakeServer;

  beforeEach(async () => {
    const adapters = await import('../sync/adapters');
    (adapters.syncAdapters as unknown[]).splice(0, 1, fakeKanbanAdapter);
    server = new FakeServer();
    h.api = makeApi(server);
    h.session.status = 'signedIn';
    h.session.user = { id: 'user-1' };
    window.localStorage.clear();
  });
  afterEach(async () => {
    cleanup();
    const storage = getDefaultSyncStorage();
    for (const k of await storage.keys()) if (k.startsWith(SYNC_DOC_PREFIX)) await storage.del(k);
  });

  it('trae la nube al estado, sube las ediciones locales y muestra "Sincronizado"', async () => {
    server.put({ id: 'cloud-1', collection: 'kanban', data: task('cloud-1'), updatedAt: new Date().toISOString(), deletedAt: null, rev: 1 });
    window.localStorage.setItem(KEY, JSON.stringify(EMPTY));
    render(<SyncStatusBadge />);
    const hook = renderHook(() => useSyncedAppState(EMPTY));

    // Estado de fabrica + nube con datos: se aplica la nube sin preguntar.
    await waitFor(() => expect(hook.result.current[0].kanbanItems.map((t) => t.id)).toEqual(['cloud-1']), { timeout: 3000 });
    expect(JSON.parse(window.localStorage.getItem(KEY)!).kanbanItems).toHaveLength(1);

    act(() => hook.result.current[1]((s) => ({ ...s, kanbanItems: [...s.kanbanItems, task('local-1')] })));
    await waitFor(() => expect(server.live().map((r) => r.id).sort()).toEqual(['cloud-1', 'local-1']), { timeout: 5000 });
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Sincronizado'), { timeout: 3000 });
  });

  it('al cerrar sesion limpia la cola de sync pero conserva los datos locales', async () => {
    window.localStorage.setItem(KEY, JSON.stringify(EMPTY));
    const hook = renderHook(() => useSyncedAppState(EMPTY));
    await waitFor(async () => expect(await getDefaultSyncStorage().get('doc:user-1')).toBeTruthy(), { timeout: 3000 });
    act(() => hook.result.current[1]((s) => ({ ...s, kanbanItems: [task('keep')] })));

    h.session.status = 'signedOut';
    h.session.user = null;
    hook.rerender();
    await waitFor(async () => expect(await getDefaultSyncStorage().get('doc:user-1')).toBeUndefined(), { timeout: 3000 });
    expect(hook.result.current[0].kanbanItems.map((t) => t.id)).toEqual(['keep']);
  });
});
