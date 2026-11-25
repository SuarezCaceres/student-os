import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Chore, ChoreDay, ChoreSettings } from '../types';
import {
  ALL_DONE_MESSAGE,
  BASE_CHORE_NAMES,
  HARD_DAY_MESSAGE,
  MIN_CHART_DAYS,
  NO_CHORES_MESSAGE,
  addChore,
  addDaysIso,
  buildChoreSeed,
  closeChoreDay,
  computeWeekdayStats,
  getChoresForDate,
  formatShortDateEs,
  getDayOfWeekForDate,
  getNextLevel,
  getReachedLevel,
  getTodayIso,
  hasDuplicateChoreName,
  msUntilNextLocalMidnight,
  needsChoreSeed,
  normalizeChoreLevels,
  removeChore,
  setChoreCompleted,
  setHardDay,
  summarizeChoreDay,
  updateChore,
} from './chores';

// 2026-11-23 es lunes (local).
const MONDAY = '2026-11-23';
const SATURDAY = '2026-11-28';

const chore = (id: string, extra: Partial<Chore> = {}): Chore => ({
  id,
  name: `Quehacer ${id}`,
  days: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'],
  order: 0,
  ...extra,
});

const choresOf = (count: number): Chore[] => Array.from({ length: count }, (_, i) => chore(`c${i + 1}`, { order: i }));

const SETTINGS: ChoreSettings = buildChoreSeed().choreSettings;

/** Marca los primeros `n` quehaceres de la lista en `date`. */
function markFirst(chores: Chore[], n: number, date: string): ChoreDay[] {
  let days: ChoreDay[] = [];
  for (const c of chores.slice(0, n)) days = setChoreCompleted(days, c, date, true);
  return days;
}

describe('fechas locales', () => {
  it('calcula el dia de la semana y suma dias sin desfases', () => {
    expect(getDayOfWeekForDate(MONDAY)).toBe('Lunes');
    expect(getDayOfWeekForDate('2026-11-29')).toBe('Domingo');
    expect(addDaysIso('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDaysIso('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDaysIso('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('formatShortDateEs da una fecha corta en espanol sin depender de la zona horaria', () => {
    expect(formatShortDateEs('2026-11-24')).toBe('mar 24 nov');
    expect(formatShortDateEs('2026-01-01')).toBe('jue 1 ene');
    expect(formatShortDateEs('2026-11-25')).toBe('mié 25 nov');
  });

  it('getTodayIso usa la fecha local del reloj (simulado), no UTC', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(2026, 10, 23, 23, 59, 30)); // lunes 23:59:30 local
      expect(getTodayIso()).toBe(MONDAY);
      vi.setSystemTime(new Date(2026, 10, 24, 0, 0, 1)); // pasada la medianoche local
      expect(getTodayIso()).toBe('2026-11-24');
    } finally {
      vi.useRealTimers();
    }
  });

  it('msUntilNextLocalMidnight cuenta hasta la proxima medianoche local', () => {
    expect(msUntilNextLocalMidnight(new Date(2026, 10, 23, 23, 59, 30))).toBe(30_000);
    expect(msUntilNextLocalMidnight(new Date(2026, 10, 23, 0, 0, 0))).toBe(24 * 60 * 60 * 1000);
  });
});

describe('lista base y siembra', () => {
  it('siembra los cinco quehaceres fijados, todos los dias, con ids deterministas y niveles 5 y 10', () => {
    const seed = buildChoreSeed();
    expect(seed.chores.map((c) => c.id)).toEqual(['chore-base-1', 'chore-base-2', 'chore-base-3', 'chore-base-4', 'chore-base-5']);
    expect(seed.chores.map((c) => c.name)).toEqual([...BASE_CHORE_NAMES]);
    expect(seed.chores.map((c) => c.name)).toEqual([
      'Tender la cama',
      'Pasear al perro',
      'Ducharme',
      'Limpiar mi cuarto',
      'Avanzar en mis proyectos personales de inteligencia artificial',
    ]);
    for (const c of seed.chores) expect(c.days).toHaveLength(7);
    expect(seed.choreSettings).toEqual({
      seeded: true,
      levels: [
        { min: 5, message: '¡Eres lo máximo!' },
        { min: 10, message: '¡Sigue así!' },
      ],
    });
    // es determinista: dos dispositivos generan lo mismo
    expect(buildChoreSeed()).toEqual(seed);
  });

  it('solo se siembra si nunca hubo ajustes (borrar todo no vuelve a sembrar)', () => {
    expect(needsChoreSeed({})).toBe(true);
    expect(needsChoreSeed({ choreSettings: { seeded: true, levels: [] } })).toBe(false);
  });
});

describe('quehaceres aplicables a un dia (C3)', () => {
  it('solo aparecen los que aplican al dia de la semana, ordenados por `order`', () => {
    const list = [
      chore('b', { order: 2 }),
      chore('sab', { order: 1, days: ['Sábado'] }),
      chore('lun', { order: 0, days: ['Lunes'] }),
    ];
    expect(getChoresForDate(list, MONDAY).map((c) => c.id)).toEqual(['lun', 'b']);
    expect(getChoresForDate(list, SATURDAY).map((c) => c.id)).toEqual(['sab', 'b']);
  });

  it('un quehacer sin dias no aplica nunca y una lista indefinida da vacio', () => {
    expect(getChoresForDate([chore('x', { days: [] })], MONDAY)).toEqual([]);
    expect(getChoresForDate(undefined, MONDAY)).toEqual([]);
  });

  it('los no aplicables no cuentan para la meta ni salen en el resumen', () => {
    const list = [chore('lun', { days: ['Lunes'] }), chore('sab', { days: ['Sábado'] })];
    const summary = summarizeChoreDay({ chores: list, choreSettings: SETTINGS }, SATURDAY);
    expect(summary.items.map((i) => i.chore.id)).toEqual(['sab']);
    expect(summary.applicableCount).toBe(1);
  });
});

describe('marcar y desmarcar (C4)', () => {
  it('marca, no duplica al marcar dos veces y desmarca', () => {
    const c = chore('c1');
    const once = setChoreCompleted([], c, MONDAY, true);
    expect(once).toEqual([{ date: MONDAY, completed: [{ choreId: 'c1', name: 'Quehacer c1' }], hard: false }]);
    expect(setChoreCompleted(once, c, MONDAY, true)).toBe(once);
    const state = { chores: [c], choreDays: once, choreSettings: SETTINGS };
    expect(summarizeChoreDay(state, MONDAY).completedCount).toBe(1);

    const off = setChoreCompleted(once, c, MONDAY, false);
    expect(summarizeChoreDay({ ...state, choreDays: off }, MONDAY).completedCount).toBe(0);
    expect(setChoreCompleted(off, c, MONDAY, false)).toBe(off);
  });

  it('el contador sube y baja con cada marca', () => {
    const list = choresOf(4);
    let days: ChoreDay[] = [];
    const counts: number[] = [];
    for (const c of list) {
      days = setChoreCompleted(days, c, MONDAY, true);
      counts.push(summarizeChoreDay({ chores: list, choreDays: days, choreSettings: SETTINGS }, MONDAY).completedCount);
    }
    days = setChoreCompleted(days, list[0], MONDAY, false);
    counts.push(summarizeChoreDay({ chores: list, choreDays: days, choreSettings: SETTINGS }, MONDAY).completedCount);
    expect(counts).toEqual([1, 2, 3, 4, 3]);
  });

  it('un dia sin marcas ni dia dificil no deja registro (los dias vacios no existen)', () => {
    const c = chore('c1');
    const on = setChoreCompleted([], c, MONDAY, true);
    expect(setChoreCompleted(on, c, MONDAY, false)).toEqual([]);
  });

  it('no muta el arreglo de entrada ni los dias de otras fechas', () => {
    const other: ChoreDay = { date: '2026-11-20', completed: [{ choreId: 'c9', name: 'Viejo' }], hard: false };
    const input = Object.freeze([Object.freeze(other)]);
    const next = setChoreCompleted(input, chore('c1'), MONDAY, true);
    expect(next).toHaveLength(2);
    expect(next.find((d) => d.date === '2026-11-20')).toBe(other);
  });
});

describe('niveles y mensajes (C5, C6, C7)', () => {
  const state = (n: number, applicable = 12) => {
    const list = choresOf(applicable);
    return { chores: list, choreDays: markFirst(list, n, MONDAY), choreSettings: SETTINGS };
  };

  it('con los umbrales por defecto: 5 -> «¡Eres lo máximo!», 10 -> «¡Sigue así!»', () => {
    expect(summarizeChoreDay(state(5), MONDAY)).toMatchObject({ status: 'level', message: '¡Eres lo máximo!' });
    expect(summarizeChoreDay(state(7), MONDAY).message).toBe('¡Eres lo máximo!');
    expect(summarizeChoreDay(state(10), MONDAY)).toMatchObject({ status: 'level', message: '¡Sigue así!' });
  });

  it('con menos de 5 muestra su progreso hacia la primera meta', () => {
    const summary = summarizeChoreDay(state(2), MONDAY);
    expect(summary).toMatchObject({ status: 'progress', level: null, goal: 5, remaining: 3, message: 'Llevas 2 de 5' });
    expect(summary.nextLevel).toEqual({ min: 5, message: '¡Eres lo máximo!' });
  });

  it('tras alcanzar el primer nivel apunta al siguiente', () => {
    const summary = summarizeChoreDay(state(6), MONDAY);
    expect(summary.nextLevel?.min).toBe(10);
    expect(summary.goal).toBe(10);
    expect(summary.remaining).toBe(4);
  });

  it('getReachedLevel y getNextLevel respetan umbrales desordenados', () => {
    const levels = [
      { min: 10, message: 'B' },
      { min: 3, message: 'A' },
    ];
    expect(getReachedLevel(levels, 2)).toBeNull();
    expect(getReachedLevel(levels, 3)?.message).toBe('A');
    expect(getReachedLevel(levels, 99)?.message).toBe('B');
    expect(getNextLevel(levels, 3)?.min).toBe(10);
    expect(getNextLevel(levels, 10)).toBeNull();
  });

  it('con umbrales y mensajes editados se ven los nuevos (C6)', () => {
    const list = choresOf(6);
    const custom: ChoreSettings = {
      seeded: true,
      levels: [
        { min: 2, message: 'Buen comienzo' },
        { min: 4, message: 'A tope' },
      ],
    };
    const at = (n: number) => summarizeChoreDay({ chores: list, choreDays: markFirst(list, n, MONDAY), choreSettings: custom }, MONDAY);
    expect(at(1).message).toBe('Llevas 1 de 2');
    expect(at(2).message).toBe('Buen comienzo');
    expect(at(4).message).toBe('A tope');
  });

  it('con menos quehaceres aplicables que la meta, completar todos da «completaste todos los de hoy» (C7)', () => {
    const list = choresOf(3);
    const days = markFirst(list, 3, MONDAY);
    const summary = summarizeChoreDay({ chores: list, choreDays: days, choreSettings: SETTINGS }, MONDAY);
    expect(summary).toMatchObject({ status: 'all-done', allDone: true, message: ALL_DONE_MESSAGE });

    // a medias, la meta alcanzable es completar los 3 (no los 5 que no existen hoy)
    const partial = summarizeChoreDay({ chores: list, choreDays: markFirst(list, 1, MONDAY), choreSettings: SETTINGS }, MONDAY);
    expect(partial).toMatchObject({ status: 'progress', goal: 3, remaining: 2, message: 'Llevas 1 de 3' });
  });

  it('sin niveles definidos no rompe: progreso simple y «todos hechos»', () => {
    const list = choresOf(2);
    const none: ChoreSettings = { seeded: true, levels: [] };
    expect(summarizeChoreDay({ chores: list, choreSettings: none }, MONDAY)).toMatchObject({ status: 'progress', goal: null, message: 'Llevas 0' });
    expect(summarizeChoreDay({ chores: list, choreDays: markFirst(list, 2, MONDAY), choreSettings: none }, MONDAY).status).toBe('all-done');
  });

  it('ningun quehacer aplicable: lo dice sin dividir entre cero', () => {
    const summary = summarizeChoreDay({ chores: [], choreSettings: SETTINGS }, MONDAY);
    expect(summary).toMatchObject({ status: 'none', applicableCount: 0, completedCount: 0, allDone: false, message: NO_CHORES_MESSAGE });
    const onlySaturday = [chore('sab', { days: ['Sábado'] })];
    expect(summarizeChoreDay({ chores: onlySaturday, choreSettings: SETTINGS }, MONDAY).status).toBe('none');
  });

  it('un quehacer borrado a mitad del dia conserva lo ya completado en el contador', () => {
    const list = choresOf(3);
    const days = markFirst(list, 2, MONDAY);
    const afterDelete = removeChore(list, 'c1');
    expect(afterDelete.ok).toBe(true);
    const remaining = afterDelete.ok ? afterDelete.value : [];
    const summary = summarizeChoreDay({ chores: remaining, choreDays: days, choreSettings: SETTINGS }, MONDAY);
    expect(summary.completedCount).toBe(2);
    expect(summary.applicableCount).toBe(2);
  });
});

describe('«hoy no puedo» (C8, C9)', () => {
  it('marca el dia como dificil con mensaje amable, sin meta incumplida', () => {
    const list = choresOf(8);
    const days = setHardDay([], MONDAY, true, 'agobiado');
    expect(days).toEqual([{ date: MONDAY, completed: [], hard: true, reason: 'agobiado' }]);
    const summary = summarizeChoreDay({ chores: list, choreDays: days, choreSettings: SETTINGS }, MONDAY);
    expect(summary).toMatchObject({ status: 'hard', hard: true, reason: 'agobiado', message: HARD_DAY_MESSAGE });
    expect(summary.message).not.toMatch(/meta|falta|fallaste/i);
  });

  it('el motivo es opcional y se puede cambiar', () => {
    const noReason = setHardDay([], MONDAY, true);
    expect(noReason[0]).toEqual({ date: MONDAY, completed: [], hard: true });
    expect('reason' in noReason[0]).toBe(false);
    expect(setHardDay(noReason, MONDAY, true)).toBe(noReason);
    expect(setHardDay(noReason, MONDAY, true, 'enfermo')[0].reason).toBe('enfermo');
  });

  it('marcar «hoy no puedo» y deshacerlo conserva lo ya completado', () => {
    const list = choresOf(4);
    const marked = markFirst(list, 3, MONDAY);
    const hard = setHardDay(marked, MONDAY, true, 'cansado');
    expect(hard[0].completed).toHaveLength(3);
    const undone = setHardDay(hard, MONDAY, false);
    expect(undone[0]).toEqual({ date: MONDAY, completed: marked[0].completed, hard: false });
    expect(summarizeChoreDay({ chores: list, choreDays: undone, choreSettings: SETTINGS }, MONDAY).status).toBe('progress');
  });

  it('deshacer un dia dificil sin marcas elimina el registro; deshacer sin dia dificil no hace nada', () => {
    const hard = setHardDay([], MONDAY, true, 'otro');
    expect(setHardDay(hard, MONDAY, false)).toEqual([]);
    const none: ChoreDay[] = [];
    expect(setHardDay(none, MONDAY, false)).toBe(none);
  });

  it('se puede marcar un quehacer en un dia dificil sin quitarle la dificultad', () => {
    const hard = setHardDay([], MONDAY, true);
    const next = setChoreCompleted(hard, chore('c1'), MONDAY, true);
    expect(next[0]).toMatchObject({ hard: true });
    expect(next[0].completed).toHaveLength(1);
  });
});

describe('cierre de dia y cambio de medianoche (C10, C11)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('al pasar la medianoche el dia anterior queda tal cual y hoy empieza sin nada marcado', () => {
    const list = choresOf(3);
    vi.setSystemTime(new Date(2026, 10, 23, 23, 59, 0));
    const today1 = getTodayIso();
    const days = markFirst(list, 2, today1);

    vi.setSystemTime(new Date(2026, 10, 24, 0, 0, 5));
    const today2 = getTodayIso();
    expect(today2).toBe('2026-11-24');
    const closed = closeChoreDay(days, today1);

    expect(closed).toBe(days); // nada que normalizar: el pasado no se reescribe
    const summaryYesterday = summarizeChoreDay({ chores: list, choreDays: closed, choreSettings: SETTINGS }, today1);
    const summaryToday = summarizeChoreDay({ chores: list, choreDays: closed, choreSettings: SETTINGS }, today2);
    expect(summaryYesterday.completedCount).toBe(2);
    expect(summaryToday.completedCount).toBe(0);
    expect(summaryToday.items.every((i) => !i.done)).toBe(true);
  });

  it('closeChoreDay solo limpia duplicados o registros vacios, sin inventar marcas', () => {
    const dup: ChoreDay[] = [
      {
        date: MONDAY,
        completed: [
          { choreId: 'c1', name: 'A' },
          { choreId: 'c1', name: 'A' },
        ],
        hard: false,
      },
    ];
    expect(closeChoreDay(dup, MONDAY)[0].completed).toEqual([{ choreId: 'c1', name: 'A' }]);
    expect(closeChoreDay([{ date: MONDAY, completed: [], hard: false }], MONDAY)).toEqual([]);
    expect(closeChoreDay([], MONDAY)).toEqual([]);
  });

  it('renombrar o borrar un quehacer no cambia el nombre con el que se completo (C11)', () => {
    const list = [chore('c1', { name: 'Pasear al perro' })];
    const days = setChoreCompleted([], list[0], '2026-11-20', true);

    const renamed = updateChore(list, 'c1', { name: 'Sacar a Rocky' });
    expect(renamed.ok && renamed.value[0].name).toBe('Sacar a Rocky');
    const removed = removeChore(list, 'c1');
    expect(removed.ok && removed.value).toEqual([]);

    expect(days[0].completed).toEqual([{ choreId: 'c1', name: 'Pasear al perro' }]);
    // y el dia ya cerrado sigue igual aunque el quehacer ya no exista
    expect(closeChoreDay(days, '2026-11-20')).toBe(days);
  });
});

describe('promedio por dia de la semana (C12, C13)', () => {
  // "Hoy" es el lunes 23-nov-2026; las ultimas 8 semanas son del 28-sep al 22-nov.
  const TODAY = MONDAY;
  const list = choresOf(10);

  /** Registro con `n` completados en `date`. */
  const day = (date: string, n: number, hard = false): ChoreDay => ({
    date,
    completed: Array.from({ length: n }, (_, i) => ({ choreId: `c${i + 1}`, name: `Q${i + 1}` })),
    hard,
  });

  it('sin historial es estado vacio, sin barras en cero', () => {
    const stats = computeWeekdayStats({ chores: list, choreDays: [] }, TODAY);
    expect(stats).toMatchObject({ hasEnoughData: false, bestDay: null, countedDays: 0 });
    expect(stats.averages.map((a) => a.day)).toEqual(['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']);
  });

  it('con pocos dias sigue en estado vacio y con suficientes ya hay grafica', () => {
    const few = [day('2026-11-22', 4), day('2026-11-21', 6)];
    expect(computeWeekdayStats({ chores: list, choreDays: few }, TODAY).hasEnoughData).toBe(false);
    const enough = [...few, day('2026-11-20', 2)];
    const stats = computeWeekdayStats({ chores: list, choreDays: enough }, TODAY);
    expect(stats.countedDays).toBe(MIN_CHART_DAYS);
    expect(stats.hasEnoughData).toBe(true);
  });

  it('promedia por dia de la semana y resalta el mejor dia', () => {
    // sabados 21-nov, 14-nov, 7-nov: 6, 4, 2 -> promedio 4; domingos 22 y 15: 1 y 3 (y el 8 sin registro = 0)
    const history = [
      day('2026-11-21', 6),
      day('2026-11-14', 4),
      day('2026-11-07', 2),
      day('2026-11-22', 1),
      day('2026-11-15', 3),
    ];
    const stats = computeWeekdayStats({ chores: list, choreDays: history }, TODAY);
    const byDay = Object.fromEntries(stats.averages.map((a) => [a.day, a]));
    expect(byDay['Sábado']).toMatchObject({ average: 4, samples: 3 });
    expect(byDay['Domingo']).toMatchObject({ samples: 3 }); // el domingo 8 no tiene registro: cuenta como 0
    expect(byDay['Domingo'].average).toBeCloseTo(4 / 3);
    expect(stats.bestDay).toBe('Sábado');
  });

  it('excluye los dias dificiles del promedio (no castiga el dia que te agobiaste)', () => {
    const history = [day('2026-11-21', 6), day('2026-11-14', 9, true), day('2026-11-07', 4), day('2026-11-20', 1)];
    const stats = computeWeekdayStats({ chores: list, choreDays: history }, TODAY);
    const saturday = stats.averages.find((a) => a.day === 'Sábado')!;
    expect(saturday).toMatchObject({ average: 5, samples: 2 });
  });

  it('un dia sin registro entre el primer dia y ayer cuenta como cero si ese dia tenia quehaceres', () => {
    const history = [day('2026-11-20', 4)]; // viernes; luego sabado y domingo sin registro
    const stats = computeWeekdayStats({ chores: list, choreDays: history }, TODAY);
    expect(stats.countedDays).toBe(3); // viernes 20, sabado 21, domingo 22
    expect(stats.averages.find((a) => a.day === 'Sábado')).toMatchObject({ average: 0, samples: 1 });
  });

  it('un dia sin registro en un dia de la semana sin quehaceres no cuenta', () => {
    const onlyFri = [chore('v', { days: ['Viernes'] })];
    const stats = computeWeekdayStats({ chores: onlyFri, choreDays: [day('2026-11-13', 1)] }, TODAY);
    expect(stats.averages.find((a) => a.day === 'Sábado')!.samples).toBe(0);
    expect(stats.averages.find((a) => a.day === 'Viernes')!.samples).toBe(2); // 13 (registro) y 20 (sin registro = 0)
  });

  it('solo mira las ultimas 8 semanas y no cuenta hoy ni antes del primer registro', () => {
    const old = day('2026-09-26', 9); // sabado, fuera de la ventana de 56 dias
    const inside = day('2026-10-03', 3); // sabado dentro (51 dias atras)
    const todayRecord = day(TODAY, 8);
    const stats = computeWeekdayStats({ chores: list, choreDays: [old, inside, todayRecord] }, TODAY);
    const saturday = stats.averages.find((a) => a.day === 'Sábado')!;
    expect(saturday.samples).toBe(8);
    expect(saturday.average).toBeCloseTo(3 / 8);
    expect(stats.averages.find((a) => a.day === 'Lunes')!.samples).toBe(8); // el lunes de hoy no entra
  });

  it('todos los promedios en cero no dibujan grafica ni resaltan ningun dia (C13)', () => {
    const history = [day('2026-11-20', 0), day('2026-11-21', 0), day('2026-11-22', 0)];
    // dias vacios no existen como registro: se simulan con registros "a mano"
    const stats = computeWeekdayStats({ chores: list, choreDays: history }, TODAY);
    expect(stats.countedDays).toBe(3);
    expect(stats.hasEnoughData).toBe(false);
    expect(stats.bestDay).toBeNull();
  });

  it('C13: un unico «Hoy no puedo» de hace 6 dias sin marcas no muestra grafica', () => {
    const stats = computeWeekdayStats({ chores: list, choreDays: [day('2026-11-17', 0, true)] }, TODAY);
    expect(stats.countedDays).toBeGreaterThanOrEqual(MIN_CHART_DAYS);
    expect(stats.hasEnoughData).toBe(false);
    expect(stats.bestDay).toBeNull();
  });

  it('con un solo quehacer completado en la ventana y dias suficientes ya hay grafica', () => {
    const history = [day('2026-11-17', 1), day('2026-11-19', 0)];
    expect(computeWeekdayStats({ chores: list, choreDays: history }, TODAY).hasEnoughData).toBe(true);
  });
});

describe('edicion de la lista (C2)', () => {
  it('anade con id propio, orden al final, todos los dias por defecto y nombre recortado', () => {
    const base = buildChoreSeed().chores;
    const result = addChore(base, '  Regar plantas  ', undefined, 'chore-x');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(6);
    expect(result.value[5]).toEqual({ id: 'chore-x', name: 'Regar plantas', days: base[0].days, order: 5 });
  });

  it('genera ids unicos cuando no se pasa uno', () => {
    const a = addChore([], 'A');
    const b = addChore([], 'A');
    expect(a.ok && b.ok && a.value[0].id !== b.value[0].id).toBe(true);
    expect(a.ok && a.value[0].id.startsWith('chore-')).toBe(true);
  });

  it('rechaza nombres vacios o demasiado largos y respeta el maximo de 30', () => {
    expect(addChore([], '   ')).toEqual({ ok: false, error: 'empty' });
    expect(addChore([], 'x'.repeat(81))).toEqual({ ok: false, error: 'too-long' });
    expect(addChore([], 'x'.repeat(80)).ok).toBe(true);
    const full = Array.from({ length: 30 }, (_, i) => chore(`c${i}`, { order: i }));
    expect(addChore(full, 'uno mas')).toEqual({ ok: false, error: 'limit' });
    expect(addChore([], 'A', [])).toEqual({ ok: false, error: 'no-days' });
  });

  it('ordena y deduplica los dias elegidos', () => {
    const result = addChore([], 'Sabados', ['Sábado', 'Lunes', 'Sábado']);
    expect(result.ok && result.value[0].days).toEqual(['Lunes', 'Sábado']);
  });

  it('renombra y cambia dias; valida y avisa si no existe', () => {
    const list = [chore('c1'), chore('c2', { order: 1 })];
    const renamed = updateChore(list, 'c2', { name: ' Nuevo ', days: ['Sábado'] });
    expect(renamed.ok && renamed.value[1]).toMatchObject({ name: 'Nuevo', days: ['Sábado'], order: 1 });
    expect(updateChore(list, 'c2', { name: '' })).toEqual({ ok: false, error: 'empty' });
    expect(updateChore(list, 'c2', { days: [] })).toEqual({ ok: false, error: 'no-days' });
    expect(updateChore(list, 'zzz', { name: 'x' })).toEqual({ ok: false, error: 'not-found' });
  });

  it('elimina y falla si no existe', () => {
    const list = [chore('c1'), chore('c2')];
    const removed = removeChore(list, 'c1');
    expect(removed.ok && removed.value.map((c) => c.id)).toEqual(['c2']);
    expect(removeChore(list, 'nope')).toEqual({ ok: false, error: 'not-found' });
  });

  it('detecta nombres repetidos sin distinguir mayusculas (para avisar, no bloquear)', () => {
    const list = [chore('c1', { name: 'Pasear al perro' })];
    expect(hasDuplicateChoreName(list, ' pasear AL perro ')).toBe(true);
    expect(hasDuplicateChoreName(list, 'pasear al perro', 'c1')).toBe(false);
    expect(addChore(list, 'Pasear al perro').ok).toBe(true);
  });
});

describe('edicion de niveles (C6)', () => {
  it('ordena, recorta mensajes y acepta niveles validos', () => {
    const result = normalizeChoreLevels([
      { min: 10, message: ' B ' },
      { min: 3, message: 'A' },
    ]);
    expect(result).toEqual({
      ok: true,
      value: [
        { min: 3, message: 'A' },
        { min: 10, message: 'B' },
      ],
    });
  });

  it('rechaza umbrales repetidos, fuera de rango, no enteros, mensajes vacios o demasiados niveles', () => {
    const bad = { ok: false, error: 'invalid-levels' } as const;
    expect(normalizeChoreLevels([{ min: 3, message: 'A' }, { min: 3, message: 'B' }])).toEqual(bad);
    expect(normalizeChoreLevels([{ min: 0, message: 'A' }])).toEqual(bad);
    expect(normalizeChoreLevels([{ min: 100, message: 'A' }])).toEqual(bad);
    expect(normalizeChoreLevels([{ min: 2.5, message: 'A' }])).toEqual(bad);
    expect(normalizeChoreLevels([{ min: 2, message: '   ' }])).toEqual(bad);
    expect(normalizeChoreLevels([{ min: 2, message: 'x'.repeat(121) }])).toEqual(bad);
    expect(normalizeChoreLevels(Array.from({ length: 11 }, (_, i) => ({ min: i + 1, message: 'm' })))).toEqual(bad);
  });

  it('permite no tener niveles', () => {
    expect(normalizeChoreLevels([])).toEqual({ ok: true, value: [] });
  });
});
