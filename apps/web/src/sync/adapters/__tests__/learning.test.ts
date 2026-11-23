import { describe, expect, it, vi } from 'vitest';
import type { AppState, WeeklyReflection } from '../../../types';
import { learningAdapter } from '../learning';
import { blankState, deepFreeze, expectValidAgainstContract, freshInitial, record, toRecords } from './testUtils';

const reflection = (week: number, extra: Partial<WeeklyReflection> = {}): WeeklyReflection => ({
  week,
  learnings: `Aprendi algo en la semana ${week}`,
  keyConcepts: ['a', 'b'],
  resources: [{ id: `res-${week}`, title: 'Recurso', type: 'youtube' }],
  updatedAt: '2026-11-13',
  ...extra,
});
const rec = (data: unknown, id: string, opts: Parameters<typeof record>[3] = {}) => record('learning', id, data, opts);
const withReflections = (map: Record<number, WeeklyReflection>): AppState => ({ ...blankState(), weeklyReflections: map });

describe('adaptador learning: select', () => {
  it('usa la semana como id y proyecta el estado inicial real', () => {
    const state = freshInitial();
    const selected = learningAdapter.select(state);
    expect(selected.map((r) => r.id)).toEqual(['5']);
    expect(selected[0].data).toEqual(state.weeklyReflections![5]);
    expectValidAgainstContract(toRecords(learningAdapter, state));
  });

  it('sin reflexiones (undefined o vacio) no emite nada', () => {
    const state = blankState();
    expect(learningAdapter.select({ ...state, weeklyReflections: undefined })).toEqual([]);
    expect(learningAdapter.select(state)).toEqual([]);
  });

  it('si la clave y reflection.week discrepan manda la clave; claves no numericas se ignoran', () => {
    const state = {
      ...blankState(),
      weeklyReflections: { 3: reflection(9), x: reflection(1) } as unknown as AppState['weeklyReflections'],
    };
    const selected = learningAdapter.select(state);
    expect(selected).toHaveLength(1);
    expect(selected[0]).toMatchObject({ id: '3', data: { week: 3 } });
  });

  it('el orden de salida es siempre por semana ascendente', () => {
    const state = withReflections({ 10: reflection(10), 2: reflection(2), 16: reflection(16) });
    expect(learningAdapter.select(state).map((r) => r.id)).toEqual(['2', '10', '16']);
  });
});

describe('adaptador learning: round-trip y apply', () => {
  it('round-trip sobre el estado inicial real', () => {
    const source = freshInitial();
    const target = deepFreeze(blankState());
    const result = learningAdapter.apply(target, toRecords(learningAdapter, source));
    expect(result.weeklyReflections).toEqual(source.weeklyReflections);
    expect(target.weeklyReflections).toEqual({});
    expect(result.kanbanItems).toBe(target.kanbanItems);
  });

  it('crea el mapa si el estado no lo tenia', () => {
    const state = { ...blankState(), weeklyReflections: undefined };
    const result = learningAdapter.apply(state, [rec(reflection(4), '4')]);
    expect(result.weeklyReflections).toEqual({ 4: reflection(4) });
  });

  it('anade, edita y borra', () => {
    let state = deepFreeze(withReflections({ 5: reflection(5) }));
    state = learningAdapter.apply(state, [rec(reflection(6), '6')]);
    expect(Object.keys(state.weeklyReflections!)).toEqual(['5', '6']);

    state = learningAdapter.apply(state, [rec(reflection(5, { learnings: 'Editado', mood: 'productivo' }), '5', { updatedAt: '2026-11-13T11:00:00.000Z' })]);
    expect(state.weeklyReflections![5]).toMatchObject({ learnings: 'Editado', mood: 'productivo' });

    state = learningAdapter.apply(state, [rec(null, '5', { deleted: true })]);
    expect(Object.keys(state.weeklyReflections!)).toEqual(['6']);

    state = learningAdapter.apply(state, [rec(null, '6', { deleted: true })]);
    expect(state.weeklyReflections).toEqual({});
  });

  it('idempotente: repetir lo ya aplicado devuelve la misma referencia', () => {
    const records = toRecords(learningAdapter, freshInitial());
    const once = learningAdapter.apply(blankState(), records);
    expect(learningAdapter.apply(once, records)).toBe(once);
    const tomb = [rec(null, '5', { deleted: true })];
    const gone = learningAdapter.apply(once, tomb);
    expect(learningAdapter.apply(gone, tomb)).toBe(gone);
  });

  it('tombstone de una semana inexistente: no-op', () => {
    const state = deepFreeze(freshInitial());
    expect(learningAdapter.apply(state, [rec(null, '12', { deleted: true })])).toBe(state);
  });

  it('datos invalidos del servidor no rompen ni tocan el estado', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const state = deepFreeze(freshInitial());
    const result = learningAdapter.apply(state, [
      rec({ ...reflection(5), mood: 'eufórico' }, '5'),
      rec({ ...reflection(5), keyConcepts: 'no es lista' }, '5'),
      rec(null, '6'),
      rec(reflection(7), '8'), // week distinto del id
      rec(reflection(9), 'abc'), // id no numerico
      rec(reflection(10), '010'), // id no canonico
    ]);
    expect(result).toBe(state);
    expect(warn).toHaveBeenCalled();
  });

  it('conserva campos locales que no viajan', () => {
    const local = { ...reflection(5), draftText: 'borrador' } as WeeklyReflection;
    const result = learningAdapter.apply(withReflections({ 5: local }), [rec(reflection(5, { learnings: 'Remoto' }), '5')]);
    expect(result.weeklyReflections![5]).toMatchObject({ learnings: 'Remoto', draftText: 'borrador' });
  });

  it('el orden de las claves no depende del orden de llegada', () => {
    const records = [8, 2, 16, 5].map((w) => rec(reflection(w), String(w)));
    const a = learningAdapter.apply(blankState(), records);
    const b = learningAdapter.apply(blankState(), [...records].reverse());
    expect(Object.keys(a.weeklyReflections!)).toEqual(['2', '5', '8', '16']);
    expect(Object.keys(b.weeklyReflections!)).toEqual(Object.keys(a.weeklyReflections!));
  });
});
