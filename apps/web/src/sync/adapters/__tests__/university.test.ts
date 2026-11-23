import { describe, expect, it, vi } from 'vitest';
import type { AppState, UniversityAssignment } from '../../../types';
import { calculateOverallGpa, getAssignmentUrgency } from '../../../utils/academicStats';
import { compareUniversityAssignments, universityAdapter } from '../university';
import { blankState, deepFreeze, expectValidAgainstContract, freshInitial, record, toRecords } from './testUtils';

const assignment = (id: string, extra: Partial<UniversityAssignment> = {}): UniversityAssignment => ({
  id,
  title: `Entrega ${id}`,
  course: 'Sistemas Operativos',
  week: 5,
  dueDate: '2026-11-20',
  status: 'pendiente',
  type: 'tarea',
  ...extra,
});
const rec = (data: unknown, id: string, opts: Parameters<typeof record>[3] = {}) => record('university', id, data, opts);
const ids = (s: AppState) => s.universityAssignments.map((a) => a.id);

describe('adaptador university: select', () => {
  it('proyecta el estado inicial real a registros validos contra el contrato', () => {
    const state = freshInitial();
    const selected = universityAdapter.select(state);
    expect(selected.map((r) => r.id)).toEqual(state.universityAssignments.map((a) => a.id));
    expectValidAgainstContract(toRecords(universityAdapter, state));
    expect(selected[0].data).toEqual(state.universityAssignments[0]);
  });

  it('conserva notas, calificaciones, enlace y rubrica', () => {
    const full = assignment('u1', {
      gradeObtained: 17,
      maxGrade: 20,
      weightPercentage: 25,
      notes: 'n',
      submissionUrl: 'https://x.test/entrega',
      rubricCriteria: [{ id: 'c1', label: 'Criterio', done: true }],
    });
    const [only] = universityAdapter.select({ ...blankState(), universityAssignments: [full] });
    expect(only.data).toEqual(full);
    expectValidAgainstContract(toRecords(universityAdapter, { ...blankState(), universityAssignments: [full] }));
  });

  it('ignora duplicados y no envia campos solo-locales', () => {
    const state = {
      ...blankState(),
      universityAssignments: [assignment('a'), assignment('a'), { ...assignment('b'), draft: true } as UniversityAssignment],
    };
    const selected = universityAdapter.select(state);
    expect(selected.map((r) => r.id)).toEqual(['a', 'b']);
    expect(selected[1].data).not.toHaveProperty('draft');
  });
});

describe('adaptador university: round-trip y apply', () => {
  it('round-trip: el estado inicial real se reproduce en un dispositivo vacio', () => {
    const source = freshInitial();
    const target = deepFreeze(blankState());
    const result = universityAdapter.apply(target, toRecords(universityAdapter, source));
    const norm = (list: UniversityAssignment[]) => [...list].sort((a, b) => a.id.localeCompare(b.id));
    expect(norm(result.universityAssignments)).toEqual(norm(source.universityAssignments));
    expect(target.universityAssignments).toEqual([]);
    expect(result.kanbanItems).toBe(target.kanbanItems);
  });

  it('anade, edita (nota, estado, rubrica) y borra', () => {
    let state = deepFreeze({ ...blankState(), universityAssignments: [assignment('u1'), assignment('u2')] });
    state = universityAdapter.apply(state, [rec(assignment('u3', { week: 6 }), 'u3')]);
    expect(ids(state)).toContain('u3');

    state = universityAdapter.apply(state, [
      rec(
        assignment('u1', { status: 'entregado', gradeObtained: 18, maxGrade: 20, rubricCriteria: [{ id: 'c1', label: 'x', done: true }] }),
        'u1',
        { updatedAt: '2026-11-13T11:00:00.000Z' },
      ),
    ]);
    expect(state.universityAssignments.find((a) => a.id === 'u1')).toMatchObject({ status: 'entregado', gradeObtained: 18 });

    state = universityAdapter.apply(state, [rec(null, 'u2', { deleted: true })]);
    expect(ids(state).sort()).toEqual(['u1', 'u3']);
  });

  it('idempotente: misma referencia al repetir lo ya aplicado', () => {
    const records = toRecords(universityAdapter, freshInitial());
    const once = universityAdapter.apply(blankState(), records);
    expect(universityAdapter.apply(once, records)).toBe(once);
  });

  it('tombstone de entidad inexistente: no-op', () => {
    const state = deepFreeze(freshInitial());
    expect(universityAdapter.apply(state, [rec(null, 'nope', { deleted: true })])).toBe(state);
  });

  it('datos invalidos del servidor no rompen ni tocan el estado', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const state = deepFreeze(freshInitial());
    const result = universityAdapter.apply(state, [
      rec({ ...assignment('uni-1'), status: 'abandonado' }, 'uni-1'),
      rec({ ...assignment('uni-2'), week: 'cinco' }, 'uni-2'),
      rec(null, 'uni-3'),
      rec(assignment('otro'), 'uni-4'),
      rec(42, 'uni-5'),
    ]);
    expect(result).toBe(state);
    expect(warn).toHaveBeenCalled();
  });

  it('conserva campos locales que no viajan', () => {
    const local = { ...assignment('u1'), localFlag: 1 } as UniversityAssignment;
    const result = universityAdapter.apply({ ...blankState(), universityAssignments: [local] }, [rec(assignment('u1', { title: 'Remoto' }), 'u1')]);
    expect(result.universityAssignments[0]).toMatchObject({ title: 'Remoto', localFlag: 1 });
  });

  it('tolera un estado sin universityAssignments', () => {
    const state = { ...blankState() } as AppState;
    delete (state as { universityAssignments?: UniversityAssignment[] }).universityAssignments;
    expect(universityAdapter.select(state)).toEqual([]);
    expect(universityAdapter.apply(state, [])).toBe(state);
    expect(ids(universityAdapter.apply(state, [rec(assignment('x'), 'x')]))).toEqual(['x']);
  });
});

describe('adaptador university: orden estable', () => {
  it('semana asc y, dentro de la semana, lo mas nuevo (id natural) primero', () => {
    const list = [assignment('uni-1', { week: 6 }), assignment('uni-1731500000000', { week: 5 }), assignment('uni-2', { week: 5 })];
    expect([...list].sort(compareUniversityAssignments).map((a) => a.id)).toEqual(['uni-1731500000000', 'uni-2', 'uni-1']);
  });

  it('dos dispositivos con distinto orden local convergen al mismo orden', () => {
    const all = freshInitial().universityAssignments;
    const records = all.map((a) => rec(a, a.id));
    const a = universityAdapter.apply({ ...blankState(), universityAssignments: [all[5], all[0]] }, records);
    const b = universityAdapter.apply({ ...blankState(), universityAssignments: [] }, [...records].reverse());
    expect(ids(a)).toEqual(ids(b));
    const weeks = a.universityAssignments.map((x) => x.week);
    expect(weeks).toEqual([...weeks].sort((x, y) => x - y));
  });
});

describe('sin regresiones: semaforo y estadisticas', () => {
  it('semaforo de vencimiento y GPA son identicos tras el round-trip', () => {
    const source = freshInitial();
    const result = universityAdapter.apply(blankState(), toRecords(universityAdapter, source));
    const byId = (list: UniversityAssignment[]) => Object.fromEntries(list.map((a) => [a.id, a]));
    const before = byId(source.universityAssignments);
    const after = byId(result.universityAssignments);
    for (const id of Object.keys(before)) {
      for (const today of ['2026-11-01', '2026-11-09', '2026-11-13', '2026-12-25']) {
        expect(getAssignmentUrgency(after[id].dueDate, after[id].status, today)).toEqual(
          getAssignmentUrgency(before[id].dueDate, before[id].status, today),
        );
      }
    }
    expect(calculateOverallGpa(result.universityAssignments)).toBe(calculateOverallGpa(source.universityAssignments));
  });

  it('una calificacion remota se refleja en el GPA', () => {
    const state = freshInitial();
    const target = state.universityAssignments[0];
    expect(calculateOverallGpa(state.universityAssignments)).toBeNull();
    const result = universityAdapter.apply(state, [
      rec({ ...target, status: 'entregado', gradeObtained: 16, maxGrade: 20 }, target.id, { updatedAt: '2026-11-14T00:00:00.000Z' }),
    ]);
    expect(calculateOverallGpa(result.universityAssignments)).not.toBeNull();
  });
});
