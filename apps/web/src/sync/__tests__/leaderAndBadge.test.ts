import { describe, expect, it, vi } from 'vitest';
import { describeSyncStatus } from '../describeStatus';
import { runAsLeader } from '../leader';
import { FakeServer, createDevice, task, withTasks } from './helpers';

/** Gestor de locks en memoria: una sola pestana lider por nombre; las demas esperan su turno. */
function createFakeLocks() {
  const queues = new Map<string, Array<() => void>>();
  const held = new Set<string>();
  return {
    request(name: string, options: { signal?: AbortSignal }, callback: () => Promise<void>) {
      return new Promise<void>((resolve, reject) => {
        const run = async () => {
          if (options.signal?.aborted) {
            reject(new DOMException('abort', 'AbortError'));
            next();
            return;
          }
          held.add(name);
          try {
            await callback();
          } finally {
            held.delete(name);
            next();
          }
          resolve();
        };
        const next = () => queues.get(name)?.shift()?.();
        options.signal?.addEventListener('abort', () => {
          const q = queues.get(name) ?? [];
          const i = q.indexOf(run);
          if (i >= 0) {
            q.splice(i, 1);
            reject(new DOMException('abort', 'AbortError'));
          }
        });
        if (held.has(name)) queues.set(name, [...(queues.get(name) ?? []), run]);
        else void run();
      });
    },
  };
}

describe('lider entre pestanas', () => {
  it('solo una pestana lidera; al cerrarse la lider, la siguiente toma el relevo', async () => {
    const locks = createFakeLocks();
    const events: string[] = [];
    const tab = (n: string) =>
      runAsLeader(
        'sync:user',
        { onFollow: () => events.push(`${n}:follow`), onLead: () => (events.push(`${n}:lead`), () => events.push(`${n}:release`)) },
        locks,
      );
    const stopA = tab('A');
    const stopB = tab('B');
    await vi.waitFor(() => expect(events).toContain('A:lead'));
    expect(events).not.toContain('B:lead');
    stopA();
    await vi.waitFor(() => expect(events).toContain('B:lead'));
    expect(events).toContain('A:release');
    stopB();
  });

  it('sin Web Locks la pestana actual lidera', () => {
    const onLead = vi.fn();
    runAsLeader('x', { onLead }, undefined);
    // `navigator.locks` no existe en node: el argumento por defecto tambien cae aqui.
    expect(onLead).toHaveBeenCalledTimes(1);
  });
});

describe('textos del indicador', () => {
  const base = { phase: 'idle', pending: 0, online: true, waking: false } as const;
  it('cubre los estados pedidos', () => {
    expect(describeSyncStatus(base).text).toBe('Sincronizado');
    expect(describeSyncStatus({ ...base, pending: 3 }).text).toBe('Pendiente (3)');
    expect(describeSyncStatus({ ...base, online: false }).text).toBe('Sin conexión');
    expect(describeSyncStatus({ ...base, waking: true }).text).toBe('Despertando el servidor…');
  });
});

describe('dos pestanas del mismo navegador comparten cola: solo el lider sincroniza', () => {
  it('el relevo carga la cola persistida y no duplica subidas', async () => {
    const server = new FakeServer();
    const tabA = createDevice({ server });
    await tabA.engine.start();
    tabA.edit((s) => ({ ...s, kanbanItems: [task('t1')] }));
    await tabA.engine.syncNow();
    tabA.edit((s) => ({ ...s, kanbanItems: [...s.kanbanItems, task('t2')] }));
    await tabA.engine.stop(); // la lider se cierra con un cambio aun en cola o subido

    const tabB = createDevice({ server, storage: tabA.storage, initial: tabA.holder.current });
    await tabB.start();
    expect(server.live().map((r) => r.id).sort()).toEqual(['t1', 't2']);
    expect(tabB.engine.getStatus().pending).toBe(0);
    const writes = server.requests.filter((r) => r.path === '/sync/push').length;
    await tabB.engine.syncNow();
    expect(server.requests.filter((r) => r.path === '/sync/push').length).toBe(writes);
  });
});
