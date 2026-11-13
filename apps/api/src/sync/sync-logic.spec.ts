import { NOW, at } from '../../test/helpers/sync-fixtures';
import {
  clampClientDate,
  decide,
  planPush,
  recordKey,
  sameContent,
  stableStringify,
  type NormalizedChange,
} from './sync-logic';
import type { StoredRecord } from './sync.types';

const change = (over: Partial<NormalizedChange> = {}): NormalizedChange => ({
  collection: 'kanban',
  id: 't1',
  data: { title: 'a' },
  updatedAt: new Date(at(-10)),
  deletedAt: null,
  ...over,
});

const stored = (over: Partial<StoredRecord> = {}): StoredRecord => ({
  collection: 'kanban',
  id: 't1',
  data: { title: 'a' },
  updatedAt: new Date(at(-10)),
  deletedAt: null,
  rev: 1,
  seq: 1n,
  serverUpdatedAt: NOW,
  ...over,
});

describe('clampClientDate', () => {
  it('respeta fechas pasadas y futuras dentro de la tolerancia', () => {
    expect(clampClientDate(new Date(at(-1000)), NOW).toISOString()).toBe(at(-1000));
    expect(clampClientDate(new Date(at(5)), NOW).toISOString()).toBe(at(5)); // justo en el limite
  });

  it('recorta a ahora lo que pase de ahora + 5 min', () => {
    expect(clampClientDate(new Date(NOW.getTime() + 5 * 60_000 + 1), NOW).toISOString()).toBe(NOW.toISOString());
    expect(clampClientDate(new Date(at(60 * 24 * 365)), NOW).toISOString()).toBe(NOW.toISOString());
  });
});

describe('stableStringify / sameContent', () => {
  it('ignora el orden de claves, incluso anidado, pero respeta el orden de arrays', () => {
    expect(stableStringify({ b: 1, a: { d: 1, c: [1, 2] } })).toBe(stableStringify({ a: { c: [1, 2], d: 1 }, b: 1 }));
    expect(stableStringify([1, 2])).not.toBe(stableStringify([2, 1]));
  });

  it('dos tombstones tienen el mismo contenido sin importar la fecha; vivo vs borrado no', () => {
    const dead = stored({ data: null, deletedAt: new Date(at(-5)) });
    expect(sameContent(dead, change({ data: null, deletedAt: new Date(at(-1)) }))).toBe(true);
    expect(sameContent(dead, change())).toBe(false);
    expect(sameContent(stored(), change({ data: null, deletedAt: new Date(at(-1)) }))).toBe(false);
  });
});

describe('decide', () => {
  it('insert si no existe', () => expect(decide(undefined, change())).toBe('insert'));
  it('noop si el contenido es igual (aunque el updatedAt sea mas nuevo)', () => {
    expect(decide(stored(), change({ updatedAt: new Date(at(-1)) }))).toBe('noop');
  });
  it('update si es mas nuevo y distinto', () => {
    expect(decide(stored(), change({ data: { title: 'b' }, updatedAt: new Date(at(-5)) }))).toBe('update');
  });
  it('conflict si es mas viejo o igual y distinto', () => {
    expect(decide(stored(), change({ data: { title: 'b' }, updatedAt: new Date(at(-20)) }))).toBe('conflict');
    expect(decide(stored(), change({ data: { title: 'b' }, updatedAt: new Date(at(-10)) }))).toBe('conflict');
  });
});

describe('planPush', () => {
  const existing = new Map([[recordKey('kanban', 't1'), stored()]]);

  it('asigna seq consecutivos a partir del contador y cuenta las filas nuevas', () => {
    const plan = planPush(
      new Map(),
      [change({ id: 'a' }), change({ id: 'b' }), change({ id: 'c', collection: 'profile' })],
      NOW,
      41n,
    );
    expect(plan.writes.map((w) => w.seq)).toEqual([42n, 43n, 44n]);
    expect(plan.newCounter).toBe(44n);
    expect(plan.newRows).toBe(3);
    expect(plan.writes.every((w) => w.rev === 1 && w.serverUpdatedAt === NOW)).toBe(true);
  });

  it('no escribe ni avanza el contador en reenvios idempotentes', () => {
    const plan = planPush(existing, [change()], NOW, 7n);
    expect(plan).toMatchObject({ applied: ['t1'], conflicts: [], writes: [], newCounter: 7n, newRows: 0 });
  });

  it('un update sube rev y no cuenta como fila nueva', () => {
    const plan = planPush(existing, [change({ data: { title: 'b' }, updatedAt: new Date(at(-1)) })], NOW, 1n);
    expect(plan.writes).toHaveLength(1);
    expect(plan.writes[0]).toMatchObject({ rev: 2, seq: 2n });
    expect(plan.newRows).toBe(0);
  });

  it('un conflicto devuelve la fila del servidor y no escribe', () => {
    const plan = planPush(existing, [change({ data: { title: 'b' }, updatedAt: new Date(at(-30)) })], NOW, 1n);
    expect(plan.applied).toEqual([]);
    expect(plan.conflicts).toEqual([stored()]);
    expect(plan.writes).toEqual([]);
  });

  it('recorta el updatedAt futuro antes de decidir', () => {
    const plan = planPush(new Map(), [change({ updatedAt: new Date(at(600)) })], NOW, 0n);
    expect(plan.writes[0].updatedAt.toISOString()).toBe(NOW.toISOString());
  });

  it('el tombstone guarda data null', () => {
    const plan = planPush(new Map(), [change({ deletedAt: new Date(at(-1)) })], NOW, 0n);
    expect(plan.writes[0].data).toBeNull();
    expect(plan.writes[0].deletedAt?.toISOString()).toBe(at(-1));
  });

  it('una clave repetida en el lote se escribe una sola vez (estado final) con un unico seq', () => {
    const plan = planPush(
      new Map(),
      [
        change({ data: { title: 'v1' }, updatedAt: new Date(at(-20)) }),
        change({ data: { title: 'v2' }, updatedAt: new Date(at(-10)) }),
      ],
      NOW,
      0n,
    );
    expect(plan.writes).toHaveLength(1);
    expect(plan.writes[0]).toMatchObject({ data: { title: 'v2' }, rev: 2, seq: 1n });
    expect(plan.newRows).toBe(1);
  });

  it('no muta el mapa de entrada', () => {
    const before = [...existing.entries()];
    planPush(existing, [change({ data: { title: 'z' }, updatedAt: new Date(at(-1)) })], NOW, 1n);
    expect([...existing.entries()]).toEqual(before);
  });
});
