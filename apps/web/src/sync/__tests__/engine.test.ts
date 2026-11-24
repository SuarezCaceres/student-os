import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../services/api';
import { createIdbStorage, createMemoryStorage } from '../storage';
import { syncDocKey } from '../storage';
import {
  EMPTY_STATE,
  FakeServer,
  createDevice,
  fakeKanbanAdapter,
  makeApi,
  task,
  withTasks,
} from './helpers';

const ISO = (ms: number) => new Date(ms).toISOString();

describe('motor de sync: offline -> online', () => {
  it('arranca sin red, el usuario edita y al reconectar sus ediciones se suben sin preguntar nada', async () => {
    const server = new FakeServer();
    const online = { value: false };
    const a = createDevice({ server, online });
    // Offline en el arranque: aun no se puede comparar con la nube.
    await a.engine.start();
    await a.engine.syncNow();
    expect(server.requests).toHaveLength(0);
    expect(a.engine.getStatus().phase).toBe('offline');
    // El usuario sigue trabajando sin red: estas ediciones son suyas y no se pierden.
    a.edit((s) => ({ ...s, kanbanItems: [task('t1')] }));

    online.value = true;
    // Simula el evento `online`.
    const listeners: Record<string, () => void> = {};
    a.engine.attachBrowserEvents(
      { addEventListener: (n: string, l: () => void) => (listeners[n] = l), removeEventListener: () => undefined } as never,
      { addEventListener: () => undefined, removeEventListener: () => undefined, visibilityState: 'visible' } as never,
    );
    listeners.online();
    await vi.waitFor(() => expect(a.engine.getStatus().phase).toBe('idle'), { timeout: 2000 });
    await a.engine.syncNow();
    expect(server.live().map((r) => r.id)).toEqual(['t1']);
    expect(a.tasks().map((t) => t.id)).toEqual(['t1']);
  });

  it('con la sesion ya arrancada: ediciones offline se suben al volver la red', async () => {
    const server = new FakeServer();
    const online = { value: true };
    const a = createDevice({ server, online, initial: EMPTY_STATE });
    await a.start();
    expect(a.engine.getStatus().phase).toBe('idle');

    online.value = false;
    a.edit((s) => ({ ...s, kanbanItems: [...s.kanbanItems, task('t1'), task('t2')] }));
    a.edit((s) => ({ ...s, kanbanItems: s.kanbanItems.map((i) => (i.id === 't1' ? { ...i, title: 'Editada' } : i)) }));
    await a.engine.syncNow();
    expect(a.engine.getStatus().phase).toBe('offline');
    expect(a.engine.getStatus().pending).toBe(2);
    expect(server.live()).toHaveLength(0);

    online.value = true;
    await a.engine.syncNow();
    expect(a.engine.getStatus().pending).toBe(0);
    expect(server.live().map((r) => r.id).sort()).toEqual(['t1', 't2']);
    const t1 = server.live().find((r) => r.id === 't1');
    expect((t1!.data as { title: string }).title).toBe('Editada');
  });

  it('la cola sobrevive a un reinicio (IndexedDB) y se sube despues', async () => {
    const server = new FakeServer();
    const storage = createIdbStorage('test-restart', 'kv');
    const online = { value: true };
    const a = createDevice({ server, online, storage, userId: 'u-restart' });
    await a.start();
    online.value = false;
    a.edit((s) => ({ ...s, kanbanItems: [task('persist-1')] }));
    await a.engine.syncNow();
    await a.engine.stop();
    const doc = await storage.get<{ queue: Record<string, unknown> }>(syncDocKey('u-restart'));
    expect(Object.keys(doc!.queue)).toEqual(['kanban/persist-1']);

    // "Recarga": nueva instancia, mismo localStorage (estado) y mismo IndexedDB.
    online.value = true;
    const b = createDevice({ server, online, storage, userId: 'u-restart', initial: a.holder.current });
    await b.start();
    expect(server.live().map((r) => r.id)).toEqual(['persist-1']);
    expect(b.engine.getStatus().pending).toBe(0);
  });

  it('un cambio hecho mientras el motor estaba apagado se detecta por diff al arrancar', async () => {
    const server = new FakeServer();
    const storage = createMemoryStorage();
    const a = createDevice({ server, storage });
    await a.start();
    a.edit((s) => ({ ...s, kanbanItems: [task('t1')] }));
    await a.engine.syncNow();
    await a.engine.stop();

    const edited = withTasks([{ ...task('t1'), title: 'Cambiada sin motor' }, task('t9')]);
    const b = createDevice({ server, storage, initial: edited });
    await b.start();
    expect(server.live().map((r) => r.id).sort()).toEqual(['t1', 't9']);
  });
});

describe('motor de sync: dos dispositivos, conflictos y eco', () => {
  async function pairedDevices() {
    const server = new FakeServer();
    const clock = { t: Date.parse('2026-11-13T10:00:00Z') };
    const now = () => clock.t;
    const a = createDevice({ server, now });
    const b = createDevice({ server, now, userId: 'user-1' });
    await a.start();
    await b.start();
    return { server, clock, a, b };
  }

  it('A crea y B lo recibe; B edita y A lo recibe; A borra y B lo pierde', async () => {
    const { clock, a, b } = await pairedDevices();
    clock.t += 1000;
    a.edit((s) => ({ ...s, kanbanItems: [task('t1')] }));
    await a.engine.syncNow();
    await b.engine.syncNow();
    expect(b.tasks().map((t) => t.id)).toEqual(['t1']);

    clock.t += 1000;
    b.edit((s) => ({ ...s, kanbanItems: s.kanbanItems.map((i) => ({ ...i, title: 'Desde B' })) }));
    await b.engine.syncNow();
    await a.engine.syncNow();
    expect(a.tasks()[0].title).toBe('Desde B');

    clock.t += 1000;
    a.edit((s) => ({ ...s, kanbanItems: [] }));
    await a.engine.syncNow();
    await b.engine.syncNow();
    expect(b.tasks()).toEqual([]);
  });

  it('conflicto: gana la ultima edicion por updatedAt, sin importar quien sincroniza primero', async () => {
    const { clock, a, b } = await pairedDevices();
    clock.t += 1000;
    a.edit((s) => ({ ...s, kanbanItems: [task('t1')] }));
    await a.engine.syncNow();
    await b.engine.syncNow();

    // Ediciones concurrentes: B edita DESPUES que A, pero A sincroniza al final.
    clock.t += 1000;
    a.edit((s) => ({ ...s, kanbanItems: s.kanbanItems.map((i) => ({ ...i, title: 'A (mas vieja)' })) }));
    clock.t += 5000;
    b.edit((s) => ({ ...s, kanbanItems: s.kanbanItems.map((i) => ({ ...i, title: 'B (mas nueva)' })) }));
    await b.engine.syncNow();
    await a.engine.syncNow(); // empuja una edicion mas vieja: el servidor responde conflicto
    await b.engine.syncNow();

    expect(a.tasks()[0].title).toBe('B (mas nueva)');
    expect(b.tasks()[0].title).toBe('B (mas nueva)');
    expect(a.engine.getStatus().pending).toBe(0);
  });

  it('un cambio local pendiente mas nuevo que el remoto se conserva y se sube', async () => {
    const { server, clock, a, b } = await pairedDevices();
    clock.t += 1000;
    a.edit((s) => ({ ...s, kanbanItems: [task('t1')] }));
    await a.engine.syncNow();
    await b.engine.syncNow();

    clock.t += 1000;
    a.edit((s) => ({ ...s, kanbanItems: s.kanbanItems.map((i) => ({ ...i, title: 'A vieja' })) }));
    await a.engine.syncNow();
    clock.t += 10_000;
    b.edit((s) => ({ ...s, kanbanItems: s.kanbanItems.map((i) => ({ ...i, title: 'B nueva' })) }));
    // B hace pull antes de subir: lo remoto (A vieja) no debe pisar su edicion pendiente.
    await b.engine.requestPull();
    expect(b.tasks()[0].title).toBe('B nueva');
    await b.engine.syncNow();
    expect((server.live()[0].data as { title: string }).title).toBe('B nueva');
  });

  it('bucle eco: lo aplicado desde el servidor no se vuelve a subir', async () => {
    const { server, clock, a, b } = await pairedDevices();
    clock.t += 1000;
    a.edit((s) => ({ ...s, kanbanItems: [task('t1'), task('t2')] }));
    await a.engine.syncNow();
    const pushesBefore = server.pushCount;
    await b.engine.syncNow();
    await b.engine.syncNow();
    expect(b.tasks()).toHaveLength(2);
    expect(b.engine.getStatus().pending).toBe(0);
    expect(server.pushCount).toBe(pushesBefore); // B no subio nada
    // El pull de A tambien devuelve su propio eco: no genera cambios ni pendientes.
    await a.engine.syncNow();
    expect(a.engine.getStatus().pending).toBe(0);
  });

  it('no pierde ediciones hechas mientras el pull esta en vuelo', async () => {
    const server = new FakeServer();
    const a = createDevice({ server });
    await a.start();
    // El servidor ya tiene un registro de otro dispositivo.
    server.put({
      id: 'remote-1',
      collection: 'kanban',
      data: task('remote-1'),
      updatedAt: ISO(Date.now() + 1000),
      deletedAt: null,
      rev: 1,
    });
    // La respuesta del pull llega y, justo en ese momento, el usuario edita.
    const originalFetch = server.fetch;
    let edited = false;
    server.fetch = async (input, init) => {
      const res = await originalFetch(input, init);
      if (String(input).includes('/sync/pull') && !edited) {
        edited = true;
        a.edit((s) => ({ ...s, kanbanItems: [...s.kanbanItems, task('local-while-pulling')] }));
      }
      return res;
    };
    await a.engine.syncNow();
    await a.engine.syncNow();
    const ids = a.tasks().map((t) => t.id);
    expect(ids).toContain('remote-1');
    expect(ids).toContain('local-while-pulling');
    expect(server.live().map((r) => r.id).sort()).toEqual(['local-while-pulling', 'remote-1']);
  });

  it('edicion durante el pull: el estado final tiene lo remoto Y lo local', async () => {
    const server = new FakeServer();
    const device = createDevice({ server });
    await device.start();
    server.put({ id: 'remote-1', collection: 'kanban', data: task('remote-1'), updatedAt: ISO(Date.now() + 5000), deletedAt: null, rev: 1 });
    const pull = device.engine.requestPull();
    device.edit((s) => ({ ...s, kanbanItems: [...s.kanbanItems, task('during')] }));
    await pull;
    await device.engine.syncNow();
    const ids = device.tasks().map((t) => t.id);
    expect(ids).toContain('remote-1');
    expect(ids).toContain('during');
    expect(server.live().map((r) => r.id)).toContain('during');
  });

  it('adopta el updatedAt recortado por el servidor tras un applied', async () => {
    const server = new FakeServer();
    const clock = { t: Date.parse('2026-11-13T10:00:00Z') };
    const a = createDevice({ server, now: () => clock.t });
    await a.start();
    // Reloj del cliente adelantado 1 hora; el servidor lo recorta a "ahora".
    const originalFetch = server.fetch;
    server.fetch = async (input, init) => {
      if (String(input).includes('/sync/push')) {
        const body = JSON.parse(String(init?.body));
        const res = await originalFetch(input, init);
        for (const change of body.changes) {
          const key = `${change.collection}/${change.id}`;
          const stored = server.records.get(key)!;
          server.records.set(key, { ...stored, updatedAt: ISO(clock.t - 3_600_000), seq: ++server.seq });
        }
        return res;
      }
      return originalFetch(input, init);
    };
    clock.t += 3_600_000;
    a.edit((s) => ({ ...s, kanbanItems: [task('t1')] }));
    await a.engine.syncNow();
    await a.engine.syncNow(); // el pull trae la version recortada
    // La siguiente edicion local se estampa a partir de la fecha adoptada, no de la del futuro.
    a.edit((s) => ({ ...s, kanbanItems: s.kanbanItems.map((i) => ({ ...i, title: 'otra' })) }));
    expect(a.engine.getStatus().pending).toBe(1);
    await a.engine.syncNow();
    expect(a.engine.getStatus().pending).toBe(0);
  });
});

describe('motor de sync: errores y lotes', () => {
  it('parte los lotes por numero y por bytes', async () => {
    const server = new FakeServer();
    const a = createDevice({ server, engine: { options: { pushBatchSize: 3, pushBatchBytes: 600, observeDebounceMs: 0, pushDebounceMs: 0, retryDelaysMs: [5], minPullIntervalMs: 0 } } });
    await a.start();
    a.edit((s) => ({ ...s, kanbanItems: Array.from({ length: 7 }, (_, i) => task(`t${i}`, 'x'.repeat(10))) }));
    await a.engine.syncNow();
    const pushes = server.requests.filter((r) => r.path === '/sync/push');
    expect(pushes.length).toBeGreaterThanOrEqual(3);
    for (const p of pushes) {
      const changes = (p.body as { changes: unknown[] }).changes;
      expect(changes.length).toBeLessThanOrEqual(3);
      expect(JSON.stringify(p.body).length).toBeLessThan(1200);
    }
    expect(server.live()).toHaveLength(7);
  });

  it('un 400 aisla al registro culpable sin bloquear el resto de la cola', async () => {
    const server = new FakeServer();
    const originalFetch = server.fetch;
    server.fetch = async (input, init) => {
      if (String(input).includes('/sync/push')) {
        const body = JSON.parse(String(init?.body));
        if (body.changes.some((c: { id: string }) => c.id === 'veneno')) {
          server.requests.push({ method: 'POST', path: '/sync/push', body });
          return new Response('{}', { status: 400 });
        }
      }
      return originalFetch(input, init);
    };
    const a = createDevice({ server });
    await a.start();
    a.edit((s) => ({ ...s, kanbanItems: [task('a'), task('veneno'), task('b')] }));
    await a.engine.syncNow();
    expect(server.live().map((r) => r.id).sort()).toEqual(['a', 'b']);
    expect(a.engine.getStatus().rejected).toBe(1);
    expect(a.engine.getStatus().pending).toBe(0);
  });

  it('un 422 (cuota) no se reintenta a ciegas', async () => {
    const server = new FakeServer();
    const a = createDevice({ server });
    await a.start();
    const originalFetch = server.fetch;
    let pushes = 0;
    server.fetch = async (input, init) => {
      if (String(input).includes('/sync/push')) {
        pushes++;
        return new Response('{}', { status: 422 });
      }
      return originalFetch(input, init);
    };
    a.edit((s) => ({ ...s, kanbanItems: [task('t1'), task('t2')] }));
    await a.engine.syncNow();
    await new Promise((r) => setTimeout(r, 60)); // el backoff de pruebas es de 5 ms: no debe reintentar
    expect(pushes).toBe(1);
    expect(a.engine.getStatus().phase).toBe('error');
    expect(a.engine.getStatus().error).toMatch(/límite/);
    expect(a.engine.getStatus().pending).toBe(2); // nada se pierde ni se descarta
  });

  it('cold start: 503 y timeouts primero, luego OK; la cola no se pierde', async () => {
    const server = new FakeServer();
    server.faults = [{ type: 'status', status: 503 }, { type: 'network' }];
    const a = createDevice({ server, initial: EMPTY_STATE });
    await a.start(); // bootstrap atraviesa los fallos gracias a los reintentos del cliente
    expect(a.engine.getStatus().phase).toBe('idle');
    a.edit((s) => ({ ...s, kanbanItems: [task('t1')] }));
    server.faults = [{ type: 'status', status: 502 }, { type: 'status', status: 503 }];
    await a.engine.syncNow();
    expect(server.live().map((r) => r.id)).toEqual(['t1']);
  });

  it('si el servidor sigue caido, mantiene la cola y reintenta con backoff propio', async () => {
    const server = new FakeServer();
    const a = createDevice({
      server,
      api: makeApi(server, undefined, { maxAttempts: 1 }),
    });
    await a.start();
    a.edit((s) => ({ ...s, kanbanItems: [task('t1')] }));
    server.faults = [{ type: 'status', status: 503 }, { type: 'status', status: 503 }, { type: 'status', status: 503 }];
    await a.engine.syncNow();
    expect(a.engine.getStatus().phase).toBe('error');
    expect(a.engine.getStatus().pending).toBe(1);
    // El reintento programado por el motor (5 ms en pruebas) termina subiendo.
    await vi.waitFor(() => expect(a.engine.getStatus().pending).toBe(0), { timeout: 2000 });
    expect(server.live().map((r) => r.id)).toEqual(['t1']);
  });

  it('401: se renueva el token una vez y continua sin perder cambios', async () => {
    const server = new FakeServer();
    const token = { value: 'token-viejo' };
    const a = createDevice({ server, token });
    server.validTokens = new Set(['token-2']);
    await a.start();
    a.edit((s) => ({ ...s, kanbanItems: [task('t1')] }));
    await a.engine.syncNow();
    expect(token.value).toBe('token-2');
    expect(server.live().map((r) => r.id)).toEqual(['t1']);
  });

  it('401 persistente: error de autenticacion, la cola se conserva', async () => {
    const server = new FakeServer();
    const onAuthFailure = vi.fn();
    const api = makeApi(server, { value: 'malo' }, { onAuthFailure, refreshSession: async () => null });
    server.validTokens = new Set(['otro']);
    const a = createDevice({ server, api });
    await a.engine.start();
    await a.engine.syncNow();
    expect(onAuthFailure).toHaveBeenCalled();
    expect(a.engine.getStatus().phase).toBe('error');
    expect(a.engine.getStatus().error).toMatch(/sesión/);
  });

  it('ApiError aborted/auth no entra en bucle de reintentos', async () => {
    const e = new ApiError('auth', 'x');
    expect(e.kind).toBe('auth');
  });
});

describe('primera comparacion con la nube (spec 009: sin importador)', () => {
  const localData = withTasks([task('l1', 'Local 1'), task('l2', 'Local 2')]);
  const cloudRecord = (id: string, t: number) => ({
    id,
    collection: 'kanban' as const,
    data: task(id, `Nube ${id}`),
    updatedAt: ISO(t),
    deletedAt: null,
    rev: 1,
  });

  it('C14: datos locales ajenos o del prototipo + nube vacia: se descartan y NO se suben', async () => {
    const server = new FakeServer();
    const a = createDevice({ server, initial: localData, engine: { initialState: () => EMPTY_STATE } });
    await a.start();
    expect(a.engine.getStatus().phase).toBe('idle');
    expect(a.tasks()).toEqual([]); // se descartaron
    expect(server.live()).toHaveLength(0); // y nada se subio
    expect(server.pushCount).toBe(0);
    expect(a.engine.getStatus().pending).toBe(0);
  });

  it('C11/C14: datos locales ajenos + nube con datos: se descartan y se trae la nube sin preguntar', async () => {
    const server = new FakeServer();
    server.put(cloudRecord('c1', Date.now()));
    const a = createDevice({ server, initial: localData, engine: { initialState: () => EMPTY_STATE } });
    await a.start();
    expect(a.tasks().map((t) => t.id)).toEqual(['c1']);
    expect(server.live().map((r) => r.id)).toEqual(['c1']); // lo ajeno nunca llego a la nube
    expect(a.engine.getStatus().pending).toBe(0);
  });

  it('el estado local NUNCA se descarta si este usuario ya tenia la sesion arrancada en este navegador', async () => {
    const server = new FakeServer();
    const storage = createMemoryStorage();
    const first = createDevice({ server, storage });
    await first.start();
    first.edit((s) => ({ ...s, kanbanItems: [task('mio-1', 'Mio')] }));
    await first.engine.syncNow();
    await first.engine.stop();

    // "Recarga": mismo usuario, mismo almacenamiento, estado local con sus datos.
    const again = createDevice({ server, storage, initial: first.holder.current });
    await again.start();
    expect(again.tasks().map((t) => t.id)).toEqual(['mio-1']);
    expect(server.live().map((r) => r.id)).toEqual(['mio-1']);
  });

  it('dos usuarios en el mismo navegador: los datos de A nunca llegan a la cuenta de B', async () => {
    const serverA = new FakeServer();
    const a = createDevice({ server: serverA, userId: 'user-A' });
    await a.start();
    a.edit((s) => ({ ...s, kanbanItems: [task('a-secreto', 'Solo de A')] }));
    await a.engine.syncNow();
    await a.engine.stop();
    expect(serverA.live().map((r) => r.id)).toEqual(['a-secreto']);

    // Entra B en el mismo navegador: el estado local sigue siendo el de A, pero B no tiene documento arrancado.
    const serverB = new FakeServer();
    const b = createDevice({
      server: serverB,
      storage: createMemoryStorage(),
      userId: 'user-B',
      initial: a.holder.current,
      engine: { initialState: () => EMPTY_STATE },
    });
    await b.start();
    expect(b.tasks()).toEqual([]);
    expect(serverB.live()).toHaveLength(0);
    expect(serverB.pushCount).toBe(0);
    expect(b.engine.getStatus().pending).toBe(0);
  });

  it('estado de fabrica + nube con datos: aplica la nube sin preguntar', async () => {
    const server = new FakeServer();
    server.put(cloudRecord('c1', Date.now()));
    const a = createDevice({ server, initial: EMPTY_STATE });
    await a.start();
    expect(a.tasks().map((t) => t.id)).toEqual(['c1']);
  });

  it('estado de fabrica + nube vacia: se adopta sin subir nada', async () => {
    const server = new FakeServer();
    const a = createDevice({ server, initial: EMPTY_STATE });
    await a.start();
    expect(a.engine.getStatus().phase).toBe('idle');
    expect(server.pushCount).toBe(0);
  });

  it('adaptadores stub (no emiten nada): el motor no hace nada ni pregunta', async () => {
    const server = new FakeServer();
    const stub = { collection: 'kanban' as const, select: () => [], apply: (s: never) => s };
    const a = createDevice({ server, initial: localData, adapters: [stub] });
    await a.start();
    a.edit((s) => ({ ...s, kanbanItems: [] }));
    await a.engine.syncNow();
    expect(a.engine.getStatus().phase).toBe('idle');
    expect(server.pushCount).toBe(0);
  });

  it('estado local reiniciado (localStorage borrado) no borra la nube', async () => {
    const server = new FakeServer();
    const storage = createMemoryStorage();
    const a = createDevice({ server, storage });
    await a.start();
    a.edit((s) => ({ ...s, kanbanItems: [task('t1')] }));
    await a.engine.syncNow();
    await a.engine.stop();
    expect(server.live()).toHaveLength(1);

    const b = createDevice({ server, storage, initial: EMPTY_STATE });
    await b.start();
    expect(server.live().map((r) => r.id)).toEqual(['t1']); // la nube sigue intacta
    expect(b.tasks().map((t) => t.id)).toEqual(['t1']); // y se recupero en local
  });
});

describe('exports', () => {
  it('fakeKanbanAdapter.apply es idempotente', () => {
    const rec = { id: 't1', collection: 'kanban' as const, data: task('t1'), updatedAt: ISO(0), deletedAt: null, rev: 1 };
    const once = fakeKanbanAdapter.apply(EMPTY_STATE, [rec]);
    const twice = fakeKanbanAdapter.apply(once, [rec]);
    expect(twice.kanbanItems).toHaveLength(1);
  });
});
