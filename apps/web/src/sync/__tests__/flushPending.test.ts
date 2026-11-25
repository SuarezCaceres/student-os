import { afterEach, describe, expect, it, vi } from 'vitest';
import { FLUSH_TIMEOUT_MS, syncStore } from '../syncStore';
import { OFF_STATUS, type SyncStatus } from '../types';

const status = (patch: Partial<SyncStatus>): SyncStatus => ({ ...OFF_STATUS, phase: 'idle', ...patch });

afterEach(() => {
  vi.useRealTimers();
  syncStore.disable();
});

describe('syncStore.flushPending (spec 010, C7)', () => {
  it('sin sync activa no intenta nada y devuelve los pendientes conocidos', async () => {
    syncStore.disable();
    expect(await syncStore.flushPending()).toEqual({ attempted: false, timedOut: false, pending: 0 });
  });

  it('en una pestana seguidora (sin controlador) no intenta subir', async () => {
    syncStore.publish(status({ pending: 3 }));
    syncStore.setFollower();
    const result = await syncStore.flushPending();
    expect(result.attempted).toBe(false);
  });

  it('sube lo pendiente: registra los cambios en espera, sincroniza y devuelve 0 pendientes', async () => {
    const calls: string[] = [];
    syncStore.publish(status({ pending: 2 }));
    syncStore.setController({
      observeNow: () => calls.push('observe'),
      syncNow: async () => {
        calls.push('sync');
        syncStore.publish(status({ pending: 0 }));
      },
    });
    expect(await syncStore.flushPending()).toEqual({ attempted: true, timedOut: false, pending: 0 });
    expect(calls).toEqual(['observe', 'sync']);
  });

  it('sin conexion no sube y devuelve lo que se perderia', async () => {
    syncStore.publish(status({ phase: 'offline', pending: 4, online: false }));
    syncStore.setController({ syncNow: async () => undefined });
    expect(await syncStore.flushPending()).toEqual({ attempted: true, timedOut: false, pending: 4 });
  });

  it('si la sincronizacion falla no lanza: devuelve los pendientes que quedan', async () => {
    syncStore.publish(status({ phase: 'error', pending: 1 }));
    syncStore.setController({
      syncNow: async () => {
        throw new Error('boom');
      },
    });
    expect(await syncStore.flushPending()).toEqual({ attempted: true, timedOut: false, pending: 1 });
  });

  it('el tiempo maximo corta la espera aunque la API siga dormida (el boton no se cuelga)', async () => {
    vi.useFakeTimers();
    syncStore.publish(status({ phase: 'syncing', pending: 2 }));
    syncStore.setController({ syncNow: () => new Promise<void>(() => undefined) });
    const pending = syncStore.flushPending();
    await vi.advanceTimersByTimeAsync(FLUSH_TIMEOUT_MS);
    expect(await pending).toEqual({ attempted: true, timedOut: true, pending: 2 });
  });

  it('el tiempo maximo por defecto es de unos 5 segundos', () => {
    expect(FLUSH_TIMEOUT_MS).toBe(5000);
  });

  it('acepta un tiempo maximo propio', async () => {
    vi.useFakeTimers();
    syncStore.publish(status({ pending: 1 }));
    syncStore.setController({ syncNow: () => new Promise<void>(() => undefined) });
    const pending = syncStore.flushPending(100);
    await vi.advanceTimersByTimeAsync(100);
    expect((await pending).timedOut).toBe(true);
  });
});
