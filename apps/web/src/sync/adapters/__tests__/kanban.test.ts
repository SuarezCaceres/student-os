import { describe, expect, it, vi } from 'vitest';
import type { AppState, KanbanItem } from '../../../types';
import { compareKanbanItems, kanbanAdapter, naturalCompare } from '../kanban';
import { blankState, deepFreeze, expectValidAgainstContract, freshInitial, record, toRecords } from './testUtils';

const item = (id: string, extra: Partial<KanbanItem> = {}): KanbanItem => ({
  id,
  title: `Tarea ${id}`,
  status: 'todo',
  category: 'personal',
  priority: 'media',
  createdAt: '2026-11-01',
  ...extra,
});
const rec = (data: unknown, id: string, opts: Parameters<typeof record>[3] = {}) => record('kanban', id, data, opts);
const ids = (s: AppState) => s.kanbanItems.map((i) => i.id);

describe('adaptador kanban: select', () => {
  it('proyecta el estado inicial real a registros {id, data} validos contra el contrato', () => {
    const state = freshInitial();
    const selected = kanbanAdapter.select(state);
    expect(selected.map((r) => r.id)).toEqual(state.kanbanItems.map((i) => i.id));
    expect(new Set(selected.map((r) => r.id)).size).toBe(selected.length);
    expectValidAgainstContract(toRecords(kanbanAdapter, state));
    expect(selected[0].data).toEqual(state.kanbanItems[0]);
  });

  it('es estable: dos llamadas dan lo mismo y no depende del orden de la lista', () => {
    const state = freshInitial();
    expect(kanbanAdapter.select(state)).toEqual(kanbanAdapter.select(state));
    const reversed = { ...state, kanbanItems: [...state.kanbanItems].reverse() };
    const byId = (s: AppState) => Object.fromEntries(kanbanAdapter.select(s).map((r) => [r.id, r.data]));
    expect(byId(reversed)).toEqual(byId(state));
  });

  it('ignora duplicados y entidades sin id; no envia campos solo-locales', () => {
    const state = { ...blankState(), kanbanItems: [item('a'), item('a', { title: 'dup' }), { ...item('b'), localOnly: 'x' } as KanbanItem] };
    const selected = kanbanAdapter.select(state);
    expect(selected.map((r) => r.id)).toEqual(['a', 'b']);
    expect(selected[1].data).not.toHaveProperty('localOnly');
  });
});

describe('adaptador kanban: round-trip select -> contrato -> apply', () => {
  it('reproduce exactamente el kanban del estado inicial real en un dispositivo vacio', () => {
    const source = freshInitial();
    const records = toRecords(kanbanAdapter, source);
    const target = deepFreeze(blankState());
    const result = kanbanAdapter.apply(target, records);
    const norm = (items: KanbanItem[]) => [...items].sort((a, b) => a.id.localeCompare(b.id));
    expect(norm(result.kanbanItems)).toEqual(norm(source.kanbanItems));
    // Inmutable: el estado de entrada no cambio y el resultado es otro objeto.
    expect(target.kanbanItems).toEqual([]);
    expect(result).not.toBe(target);
  });

  it('el resultado re-proyectado coincide con lo recibido (sin eco ni deriva)', () => {
    const records = toRecords(kanbanAdapter, freshInitial());
    const result = kanbanAdapter.apply(blankState(), records);
    const reprojected = kanbanAdapter.select(result);
    const expected = Object.fromEntries(records.map((r) => [r.id, r.data]));
    for (const r of reprojected) expect(r.data).toEqual(expected[r.id]);
    expect(reprojected).toHaveLength(records.length);
  });

  it('solo toca kanbanItems: el resto del estado conserva su referencia', () => {
    const base = deepFreeze(freshInitial());
    const result = kanbanAdapter.apply(base, [rec(item('nuevo'), 'nuevo')]);
    expect(result.universityAssignments).toBe(base.universityAssignments);
    expect(result.weeklyReflections).toBe(base.weeklyReflections);
    expect(result.gymRoutines).toBe(base.gymRoutines);
    expect(result.studentName).toBe(base.studentName);
  });
});

describe('adaptador kanban: apply', () => {
  it('anade, edita y borra', () => {
    let state = deepFreeze({ ...blankState(), kanbanItems: [item('t1'), item('t2')] });
    state = kanbanAdapter.apply(state, [rec(item('t3'), 't3')]);
    expect(ids(state).sort()).toEqual(['t1', 't2', 't3']);

    state = kanbanAdapter.apply(state, [rec(item('t2', { title: 'Editada', status: 'done' }), 't2', { updatedAt: '2026-11-13T11:00:00.000Z' })]);
    expect(state.kanbanItems.find((i) => i.id === 't2')).toMatchObject({ title: 'Editada', status: 'done' });

    state = kanbanAdapter.apply(state, [rec(null, 't1', { deleted: true })]);
    expect(ids(state).sort()).toEqual(['t2', 't3']);
  });

  it('un campo opcional que desaparece en el servidor desaparece tambien en local', () => {
    const state = { ...blankState(), kanbanItems: [item('t1', { dueDate: '2026-11-20', tags: ['a'] })] };
    const result = kanbanAdapter.apply(state, [rec(item('t1'), 't1')]);
    expect(result.kanbanItems[0]).not.toHaveProperty('dueDate');
    expect(result.kanbanItems[0]).not.toHaveProperty('tags');
  });

  it('es idempotente: aplicar dos veces da el mismo estado y repetir lo ya conocido devuelve la misma referencia', () => {
    const records = toRecords(kanbanAdapter, freshInitial());
    const once = kanbanAdapter.apply(blankState(), records);
    const twice = kanbanAdapter.apply(once, records);
    expect(twice).toBe(once);
    expect(twice).toEqual(once);
    const tomb = [rec(null, 'k1', { deleted: true })];
    const gone = kanbanAdapter.apply(once, tomb);
    expect(kanbanAdapter.apply(gone, tomb)).toBe(gone);
  });

  it('tombstone de una entidad inexistente es un no-op (misma referencia)', () => {
    const state = deepFreeze(freshInitial());
    expect(kanbanAdapter.apply(state, [rec(null, 'no-existe', { deleted: true })])).toBe(state);
  });

  it('tolera un estado sin kanbanItems', () => {
    const state = { ...blankState() } as AppState;
    delete (state as { kanbanItems?: KanbanItem[] }).kanbanItems;
    expect(kanbanAdapter.select(state)).toEqual([]);
    expect(kanbanAdapter.apply(state, [])).toBe(state);
    expect(kanbanAdapter.apply(state, [rec(null, 'x', { deleted: true })])).toBe(state);
    expect(ids(kanbanAdapter.apply(state, [rec(item('x'), 'x')]))).toEqual(['x']);
  });

  it('ignora datos invalidos del servidor sin romper ni tocar el estado', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const state = deepFreeze(freshInitial());
    const bad = [
      rec({ ...item('k1'), status: 'bogus' }, 'k1'),
      rec(null, 'k2'), // vivo pero sin datos
      rec('texto', 'k3'),
      rec({ title: 'sin id' }, 'k4'),
      rec(item('otro-id'), 'k5'), // el id del registro no coincide con el de los datos
      rec({ ...item('k1'), checklist: [{ id: 1 }] }, 'k1'),
    ];
    const result = kanbanAdapter.apply(state, bad);
    expect(result).toBe(state);
    expect(warn).toHaveBeenCalled();
  });

  it('un registro invalido no impide aplicar los validos del mismo lote', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const state = freshInitial();
    const result = kanbanAdapter.apply(state, [rec({ nope: true }, 'k1'), rec(item('ok'), 'ok')]);
    expect(ids(result)).toContain('ok');
    expect(result.kanbanItems.find((i) => i.id === 'k1')).toEqual(state.kanbanItems.find((i) => i.id === 'k1'));
  });

  it('con varias versiones del mismo id en un lote gana la de updatedAt mas reciente', () => {
    const records = [
      rec(item('t1', { title: 'nueva' }), 't1', { updatedAt: '2026-11-13T12:00:00.000Z' }),
      rec(item('t1', { title: 'vieja' }), 't1', { updatedAt: '2026-11-13T09:00:00.000Z' }),
    ];
    expect(kanbanAdapter.apply(blankState(), records).kanbanItems[0].title).toBe('nueva');
    // Un tombstone mas nuevo gana a una edicion anterior.
    const withDelete = [records[1], rec(null, 't1', { deleted: true, updatedAt: '2026-11-13T13:00:00.000Z' })];
    expect(kanbanAdapter.apply(blankState(), withDelete).kanbanItems).toEqual([]);
  });

  it('conserva los campos locales que no viajan al aplicar una edicion remota', () => {
    const local = { ...item('t1'), localNote: 'solo en este dispositivo' } as KanbanItem;
    const state = { ...blankState(), kanbanItems: [local] };
    const result = kanbanAdapter.apply(state, [rec(item('t1', { title: 'Remota' }), 't1')]);
    expect(result.kanbanItems[0]).toMatchObject({ title: 'Remota', localNote: 'solo en este dispositivo' });
    // y aplicar lo mismo otra vez no cambia nada
    expect(kanbanAdapter.apply(result, [rec(item('t1', { title: 'Remota' }), 't1')])).toBe(result);
  });

  it('descarta duplicados del mismo id al reemplazarlos', () => {
    const state = { ...blankState(), kanbanItems: [item('t1'), item('t2'), item('t1', { title: 'dup' })] };
    const result = kanbanAdapter.apply(state, [rec(item('t1', { title: 'Unica' }), 't1')]);
    expect(result.kanbanItems.filter((i) => i.id === 't1')).toHaveLength(1);
    expect(result.kanbanItems.find((i) => i.id === 't1')?.title).toBe('Unica');
  });
});

describe('adaptador kanban: orden estable y determinista', () => {
  it('naturalCompare ordena numeros como numeros', () => {
    expect(naturalCompare('k2', 'k10')).toBeLessThan(0);
    expect(naturalCompare('k10', 'k2')).toBeGreaterThan(0);
    expect(naturalCompare('k-1731500000000', 'k-1731500000001')).toBeLessThan(0);
    expect(naturalCompare('k5', 'k5')).toBe(0);
    expect(naturalCompare('a', 'b')).toBeLessThan(0);
  });

  it('createdAt desc y luego id natural desc (lo mas nuevo primero, como el prepend de la UI)', () => {
    const a = item('k-100', { createdAt: '2026-11-12' });
    const b = item('k-200', { createdAt: '2026-11-13' });
    const c = item('k-300', { createdAt: '2026-11-13' });
    expect([a, b, c].sort(compareKanbanItems).map((i) => i.id)).toEqual(['k-300', 'k-200', 'k-100']);
  });

  it('dos dispositivos con distinto orden local y el mismo conjunto convergen al mismo orden', () => {
    const all = [item('k1'), item('k2', { createdAt: '2026-11-02' }), item('k3', { createdAt: '2026-11-03' }), item('k-1731500000000', { createdAt: '2026-11-13' })];
    const records = all.map((i) => rec(i, i.id));
    const deviceA = kanbanAdapter.apply({ ...blankState(), kanbanItems: [all[0]] }, records.slice(1));
    const deviceB = kanbanAdapter.apply({ ...blankState(), kanbanItems: [all[3], all[2]] }, [...records].reverse());
    expect(ids(deviceA)).toEqual(ids(deviceB));
    expect(ids(deviceA)).toEqual(['k-1731500000000', 'k3', 'k2', 'k1']);
  });

  it('el orden no depende del orden de llegada de los registros (todas las permutaciones)', () => {
    const items = ['a', 'b', 'c', 'd'].map((id, n) => item(id, { createdAt: n % 2 ? '2026-11-02' : '2026-11-01' }));
    const permutations = (xs: KanbanItem[]): KanbanItem[][] =>
      xs.length <= 1 ? [xs] : xs.flatMap((x, i) => permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p]));
    const results = new Set(permutations(items).map((p) => ids(kanbanAdapter.apply(blankState(), p.map((i) => rec(i, i.id)))).join(',')));
    expect(results.size).toBe(1);
  });

  it('una edicion remota no cambia el orden relativo ya estable', () => {
    const base = kanbanAdapter.apply(blankState(), freshInitial().kanbanItems.map((i) => rec(i, i.id)));
    const edited = kanbanAdapter.apply(base, [rec({ ...base.kanbanItems[2], title: 'Cambio' }, base.kanbanItems[2].id, { updatedAt: '2026-11-14T00:00:00.000Z' })]);
    expect(ids(edited)).toEqual(ids(base));
  });
});
