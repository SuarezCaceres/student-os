import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { AppState, KanbanItem, UniversityAssignment, WeeklyReflection } from '../../../types';
import { stableStringify } from '../../hash';
import { FakeServer, createDevice } from '../../__tests__/helpers';
import { kanbanAdapter } from '../kanban';
import { learningAdapter } from '../learning';
import { universityAdapter } from '../university';
import { blankState } from './testUtils';

/** Motor REAL + servidor simulado + los tres adaptadores reales (kanban, universidad, aprendizaje). */
const adapters = [kanbanAdapter, universityAdapter, learningAdapter];
const BLANK = blankState();
const isPristine = (s: AppState) => stableStringify(s) === stableStringify(BLANK);

const task = (id: string, extra: Partial<KanbanItem> = {}): KanbanItem => ({
  id,
  title: `Tarea ${id}`,
  status: 'todo',
  category: 'personal',
  priority: 'media',
  createdAt: '2026-11-13',
  ...extra,
});
const entrega = (id: string, extra: Partial<UniversityAssignment> = {}): UniversityAssignment => ({
  id,
  title: `Entrega ${id}`,
  course: 'Sistemas Operativos',
  week: 5,
  dueDate: '2026-11-20',
  status: 'pendiente',
  type: 'tarea',
  ...extra,
});
const reflexion = (week: number, learnings: string): WeeklyReflection => ({
  week,
  learnings,
  keyConcepts: [],
  resources: [],
  updatedAt: '2026-11-13',
});

async function pair() {
  const server = new FakeServer();
  const clock = { t: Date.parse('2026-11-13T10:00:00Z') };
  const make = () =>
    createDevice({ server, now: () => clock.t, initial: blankState(), adapters, engine: { isPristine } });
  const a = make();
  const b = make();
  await a.start();
  await b.start();
  return { server, clock, a, b };
}

describe('kanban + universidad + aprendizaje con el motor real', () => {
  it('lo que se crea/edita/borra en A llega a B (celular -> PC) y converge en el mismo orden', async () => {
    const { server, clock, a, b } = await pair();

    clock.t += 1000;
    a.edit((s) => ({
      ...s,
      kanbanItems: [task('k-2'), task('k-1')],
      universityAssignments: [entrega('uni-1'), entrega('uni-2', { week: 3 })],
      weeklyReflections: { 5: reflexion(5, 'A') },
    }));
    await a.engine.syncNow();
    expect(server.live('kanban').map((r) => r.id).sort()).toEqual(['k-1', 'k-2']);
    expect(server.live('university')).toHaveLength(2);
    expect(server.live('learning').map((r) => r.id)).toEqual(['5']);

    await b.engine.syncNow();
    expect(b.holder.current.kanbanItems.map((i) => i.id)).toEqual(['k-2', 'k-1']);
    expect(b.holder.current.universityAssignments.map((x) => x.id)).toEqual(['uni-2', 'uni-1']);
    expect(b.holder.current.weeklyReflections).toEqual({ 5: reflexion(5, 'A') });

    clock.t += 1000;
    b.edit((s) => ({
      ...s,
      kanbanItems: s.kanbanItems.map((i) => (i.id === 'k-1' ? { ...i, status: 'done' } : i)),
      universityAssignments: s.universityAssignments.map((x) => (x.id === 'uni-1' ? { ...x, status: 'entregado', gradeObtained: 18, maxGrade: 20 } : x)),
      weeklyReflections: { 5: reflexion(5, 'Editada en B') },
    }));
    await b.engine.syncNow();
    await a.engine.syncNow();
    expect(a.holder.current.kanbanItems.find((i) => i.id === 'k-1')?.status).toBe('done');
    expect(a.holder.current.universityAssignments.find((x) => x.id === 'uni-1')).toMatchObject({ status: 'entregado', gradeObtained: 18 });
    expect(a.holder.current.weeklyReflections![5].learnings).toBe('Editada en B');

    clock.t += 1000;
    a.edit((s) => ({ ...s, kanbanItems: s.kanbanItems.filter((i) => i.id !== 'k-2'), weeklyReflections: {} }));
    await a.engine.syncNow();
    await b.engine.syncNow();
    expect(b.holder.current.kanbanItems.map((i) => i.id)).toEqual(['k-1']);
    expect(b.holder.current.weeklyReflections).toEqual({});

    // Orden identico en ambos dispositivos y sin cola pendiente.
    expect(a.holder.current.kanbanItems.map((i) => i.id)).toEqual(b.holder.current.kanbanItems.map((i) => i.id));
    expect(a.engine.getStatus().pending).toBe(0);
    expect(b.engine.getStatus().pending).toBe(0);
  });

  it('no hay eco: lo recibido no se vuelve a subir y el orden no oscila al sincronizar varias veces', async () => {
    const { server, clock, a, b } = await pair();
    // Altas como las hace la UI: anteponer (lo mas nuevo primero), con ids crecientes.
    for (const n of [2, 3, 10]) {
      clock.t += 1000;
      a.edit((s) => ({ ...s, kanbanItems: [task(`k-${n}`), ...s.kanbanItems], universityAssignments: [entrega(`uni-${n}`), ...s.universityAssignments] }));
    }
    await a.engine.syncNow();
    const pushes = server.pushCount;
    await b.engine.syncNow();
    const order = b.holder.current.kanbanItems.map((i) => i.id);
    for (let i = 0; i < 3; i++) {
      await b.engine.syncNow();
      await a.engine.syncNow();
    }
    expect(server.pushCount).toBe(pushes);
    expect(b.holder.current.kanbanItems.map((i) => i.id)).toEqual(order);
    expect(a.holder.current.kanbanItems.map((i) => i.id)).toEqual(order);
    expect(order).toEqual(['k-10', 'k-3', 'k-2']); // id natural desc: k-10 > k-3 > k-2
  });

  it('conflicto: gana la ultima edicion de una entrega, sin importar quien sincroniza primero', async () => {
    const { clock, a, b } = await pair();
    clock.t += 1000;
    a.edit((s) => ({ ...s, universityAssignments: [entrega('uni-1')] }));
    await a.engine.syncNow();
    await b.engine.syncNow();

    clock.t += 1000;
    a.edit((s) => ({ ...s, universityAssignments: s.universityAssignments.map((x) => ({ ...x, notes: 'A (vieja)' })) }));
    clock.t += 5000;
    b.edit((s) => ({ ...s, universityAssignments: s.universityAssignments.map((x) => ({ ...x, notes: 'B (nueva)' })) }));
    await b.engine.syncNow();
    await a.engine.syncNow();
    await b.engine.syncNow();
    expect(a.holder.current.universityAssignments[0].notes).toBe('B (nueva)');
    expect(b.holder.current.universityAssignments[0].notes).toBe('B (nueva)');
  });

  it('offline -> online: las ediciones sin red se suben sin perder nada', async () => {
    const server = new FakeServer();
    const online = { value: true };
    const a = createDevice({ server, online, initial: blankState(), adapters, engine: { isPristine } });
    await a.start();
    online.value = false;
    a.edit((s) => ({ ...s, kanbanItems: [task('k-1')], weeklyReflections: { 7: reflexion(7, 'sin red') } }));
    await a.engine.syncNow();
    expect(a.engine.getStatus().pending).toBe(2);
    online.value = true;
    await a.engine.syncNow();
    expect(a.engine.getStatus().pending).toBe(0);
    expect(server.live('kanban')).toHaveLength(1);
    expect(server.live('learning').map((r) => r.id)).toEqual(['7']);
  });

  it('un registro invalido del servidor no rompe el estado del dispositivo', async () => {
    const { server, a } = await pair();
    server.put({
      id: 'k-bad',
      collection: 'kanban',
      data: { id: 'k-bad', title: 'x', status: 'bogus', category: 'personal', priority: 'media', createdAt: '2026-11-13' },
      updatedAt: '2026-11-13T10:00:05.000Z',
      deletedAt: null,
      rev: 1,
    });
    server.put({ id: 'k-ok', collection: 'kanban', data: task('k-ok'), updatedAt: '2026-11-13T10:00:06.000Z', deletedAt: null, rev: 1 });
    await a.engine.syncNow();
    expect(a.holder.current.kanbanItems.map((i) => i.id)).toEqual(['k-ok']);
  });
});
