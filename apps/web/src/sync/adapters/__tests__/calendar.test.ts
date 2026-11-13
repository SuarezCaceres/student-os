import {
  CalendarRecordDataSchema,
  DAILY_HABITS_RECORD_ID,
  SyncRecordSchema,
  WORK_SHIFT_RECORD_ID,
  type SyncRecord,
} from '@student-os/shared';
import { describe, expect, it } from 'vitest';
import { initialData } from '../../../data/initialData';
import type { AppState, CalendarBlock, DailyHabits, WorkShiftConfig } from '../../../types';
import { stableStringify } from '../../hash';
import { calendarAdapter, isSyncableCalendarBlock } from '../calendar';
import { createDevice, FakeServer, EMPTY_STATE } from '../../__tests__/helpers';

const BASE: AppState = { ...initialData, calendarBlocks: [], kanbanItems: [] };
const T = '2026-11-13T10:00:00.000Z';

const block = (id: string, extra: Partial<CalendarBlock> = {}): CalendarBlock => ({
  id,
  day: 'Lunes',
  startTime: '10:00',
  endTime: '11:00',
  title: `Bloque ${id}`,
  category: 'personal',
  ...extra,
});

const NIGHT_SHIFT: WorkShiftConfig = {
  enabled: true,
  title: 'Trabajo nocturno',
  startTime: '22:00',
  endTime: '06:00',
  restDay: 'Jueves',
  location: 'Turno madrugada',
  reminderMinutes: [30],
  syncWithGoogle: true,
};

const HABITS: DailyHabits = {
  waterMl: 500,
  targetWaterMl: 2500,
  sleepHours: 7,
  targetSleepHours: 8,
  pomodorosDone: 2,
  targetPomodoros: 6,
  lastUpdatedDate: '2026-11-13',
};

const live = (id: string, data: unknown): SyncRecord => ({
  id,
  collection: 'calendar',
  data,
  updatedAt: T,
  deletedAt: null,
  rev: 1,
});
const tombstone = (id: string): SyncRecord => ({ ...live(id, null), deletedAt: T });
const blockRec = (b: CalendarBlock) => live(b.id, { kind: 'block', value: b });
const shiftRec = (v: WorkShiftConfig) => live(WORK_SHIFT_RECORD_ID, { kind: 'workShift', value: v });
const habitsRec = (v: DailyHabits) => live(DAILY_HABITS_RECORD_ID, { kind: 'dailyHabits', value: v });

function deepFreeze<R>(value: R): R {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
}

describe('calendarAdapter.select', () => {
  it('emite registros {kind, value} que cumplen el contrato de shared (y como SyncRecord completo)', () => {
    const state: AppState = {
      ...BASE,
      calendarBlocks: [block('b1'), block('b2', { googleEventId: 'g1', googleHtmlLink: 'https://x', reminderMinutes: [10, 60] })],
      workShift: NIGHT_SHIFT,
      dailyHabits: HABITS,
    };
    const records = calendarAdapter.select(state);
    expect(records.map((r) => r.id)).toEqual(['b1', 'b2', WORK_SHIFT_RECORD_ID, DAILY_HABITS_RECORD_ID]);
    for (const r of records) {
      expect(CalendarRecordDataSchema.safeParse(r.data).success).toBe(true);
      expect(SyncRecordSchema.safeParse({ ...r, collection: 'calendar', updatedAt: T, deletedAt: null, rev: 0 }).success).toBe(true);
    }
  });

  it('el estado inicial de la app (bloques de ejemplo incluidos) es valido', () => {
    const records = calendarAdapter.select(initialData);
    expect(records.length).toBeGreaterThan(0);
    for (const r of records) expect(CalendarRecordDataSchema.safeParse(r.data).success).toBe(true);
  });

  it('sin turno ni habitos no emite singletons', () => {
    const records = calendarAdapter.select({ ...BASE, calendarBlocks: [block('b1')] });
    expect(records.map((r) => r.id)).toEqual(['b1']);
  });

  it('NO sube bloques espejo de Google (gcal-*) ni de gym (por categoria, id o titulo)', () => {
    const state: AppState = {
      ...BASE,
      calendarBlocks: [
        block('gcal-abc-2026-11-16'),
        block('gym-cat', { category: 'gym' }),
        block('cal-gym-lunes-0700-1', { category: 'personal' }),
        block('gym-title', { title: 'Gym: Pecho' }),
        block('gym-linked', { category: 'gym', googleEventId: 'g-gym' }),
        block('local-ok'),
      ],
    };
    expect(calendarAdapter.select(state).map((r) => r.id)).toEqual(['local-ok']);
  });

  it('un bloque local vinculado a Google (googleEventId) SI viaja: es un vinculo, no un origen', () => {
    const linked = block('b-linked', { googleEventId: 'g1', syncWithGoogle: true });
    expect(isSyncableCalendarBlock(linked)).toBe(true);
    expect(calendarAdapter.select({ ...BASE, calendarBlocks: [linked] })).toHaveLength(1);
  });

  it('ids reservados de singletons y duplicados no producen registros ambiguos', () => {
    const state: AppState = {
      ...BASE,
      calendarBlocks: [block(WORK_SHIFT_RECORD_ID), block(DAILY_HABITS_RECORD_ID), block('dup'), block('dup', { title: 'otro' })],
    };
    const ids = calendarAdapter.select(state).map((r) => r.id);
    expect(ids).toEqual(['dup']);
  });
});

describe('calendarAdapter.apply', () => {
  it('round-trip: lo que sale de select se reconstruye identico en un estado vacio', () => {
    const source: AppState = {
      ...BASE,
      calendarBlocks: [block('b1', { reminderMinutes: [15], location: 'Aula 3' }), block('b2', { day: 'Viernes', googleEventId: 'g1' })],
      workShift: NIGHT_SHIFT,
      dailyHabits: HABITS,
    };
    const records = calendarAdapter.select(source).map((r) => live(r.id, r.data));
    const target = calendarAdapter.apply(BASE, records);
    expect(target.calendarBlocks).toEqual(source.calendarBlocks);
    expect(target.workShift).toEqual(NIGHT_SHIFT);
    expect(target.dailyHabits).toEqual(HABITS);
    // y no hay diferencia observable para el motor (anti-eco)
    expect(stableStringify(calendarAdapter.select(target))).toBe(stableStringify(calendarAdapter.select(source)));
  });

  it('turno nocturno cross-midnight (22:00 -> 06:00) y sus bloques viajan sin perdida ni normalizacion', () => {
    const shiftBlocks = ['Lunes', 'Martes', 'Miércoles', 'Viernes', 'Sábado', 'Domingo'].map((day) =>
      block(`work-shift-${day.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()}`, {
        day: day as CalendarBlock['day'],
        startTime: '22:00',
        endTime: '06:00',
        title: 'Trabajo nocturno',
        category: 'trabajo',
        isRecurringWorkShift: true,
        googleEventId: 'series-1',
        syncWithGoogle: true,
        reminderMinutes: [30],
      })
    );
    const source: AppState = { ...BASE, calendarBlocks: shiftBlocks, workShift: NIGHT_SHIFT };
    const records = calendarAdapter.select(source).map((r) => live(r.id, r.data));
    const target = calendarAdapter.apply(BASE, records);
    expect(target.workShift).toEqual(NIGHT_SHIFT);
    expect(target.workShift?.startTime).toBe('22:00');
    expect(target.workShift?.endTime).toBe('06:00');
    expect(target.calendarBlocks).toHaveLength(6); // misma googleEventId de serie, dias distintos: ninguno se descarta
    expect(target.calendarBlocks.every((b) => b.startTime === '22:00' && b.endTime === '06:00')).toBe(true);
    expect(target.calendarBlocks.map((b) => b.id).sort()).toEqual(shiftBlocks.map((b) => b.id).sort());
  });

  it('no duplica un bloque ya espejado con el mismo googleEventId y hueco bajo otro id', () => {
    const local = block('local-1', { googleEventId: 'g1' });
    const state: AppState = { ...BASE, calendarBlocks: [local] };
    const next = calendarAdapter.apply(state, [blockRec(block('remote-1', { googleEventId: 'g1' }))]);
    expect(next).toBe(state);
    expect(next.calendarBlocks).toHaveLength(1);
  });

  it('dos registros del mismo lote con el mismo evento de Google + hueco: entra uno solo (determinista por id)', () => {
    const a = block('a-id', { googleEventId: 'g1' });
    const b = block('b-id', { googleEventId: 'g1' });
    const forward = calendarAdapter.apply(BASE, [blockRec(a), blockRec(b)]);
    const backward = calendarAdapter.apply(BASE, [blockRec(b), blockRec(a)]);
    expect(forward.calendarBlocks.map((x) => x.id)).toEqual(['a-id']);
    expect(backward.calendarBlocks).toEqual(forward.calendarBlocks);
  });

  it('rechaza bloques de gym o espejo de Google aunque lleguen de la nube', () => {
    const state: AppState = { ...BASE };
    const next = calendarAdapter.apply(state, [
      blockRec(block('g1', { category: 'gym' })),
      blockRec(block('gcal-x-2026-11-16')),
      blockRec(block('cal-gym-lunes-0700-1')),
    ]);
    expect(next).toBe(state);
  });

  it('actualiza en sitio (conserva el orden) y anade los nuevos al final', () => {
    const state: AppState = { ...BASE, calendarBlocks: [block('b1'), block('b2')] };
    const next = calendarAdapter.apply(state, [blockRec(block('b1', { title: 'Editado' })), blockRec(block('b3'))]);
    expect(next.calendarBlocks.map((b) => b.id)).toEqual(['b1', 'b2', 'b3']);
    expect(next.calendarBlocks[0].title).toBe('Editado');
  });

  it('es idempotente y devuelve la misma referencia si no hay cambios', () => {
    const records = [blockRec(block('b1')), shiftRec(NIGHT_SHIFT), habitsRec(HABITS)];
    const once = calendarAdapter.apply(BASE, records);
    const twice = calendarAdapter.apply(once, records);
    expect(twice).toBe(once);
    expect(twice).toEqual(once);
    expect(calendarAdapter.apply(BASE, [])).toBe(BASE);
  });

  it('el orden de llegada no cambia el resultado', () => {
    const records = [blockRec(block('b2')), blockRec(block('b1')), shiftRec(NIGHT_SHIFT), habitsRec(HABITS), blockRec(block('b3'))];
    const forward = calendarAdapter.apply(BASE, records);
    const backward = calendarAdapter.apply(BASE, [...records].reverse());
    expect(backward).toEqual(forward);
    expect(forward.calendarBlocks.map((b) => b.id)).toEqual(['b1', 'b2', 'b3']);
  });

  it('es inmutable: no modifica el estado ni los registros de entrada', () => {
    const state = deepFreeze<AppState>({ ...BASE, calendarBlocks: [block('b1')], workShift: NIGHT_SHIFT, dailyHabits: HABITS });
    const records = deepFreeze([
      blockRec(block('b1', { title: 'Nuevo' })),
      blockRec(block('b9')),
      tombstone(WORK_SHIFT_RECORD_ID),
      habitsRec({ ...HABITS, waterMl: 750 }),
    ]);
    const next = calendarAdapter.apply(state, records);
    expect(next).not.toBe(state);
    expect(state.calendarBlocks).toHaveLength(1);
    expect(state.workShift).toEqual(NIGHT_SHIFT);
    expect(next.calendarBlocks.map((b) => b.id)).toEqual(['b1', 'b9']);
    expect('workShift' in next).toBe(false);
    expect(next.dailyHabits?.waterMl).toBe(750);
  });

  it('tombstones: borran el bloque, el turno y los habitos; un tombstone desconocido no hace nada', () => {
    const state: AppState = { ...BASE, calendarBlocks: [block('b1'), block('b2')], workShift: NIGHT_SHIFT, dailyHabits: HABITS };
    const next = calendarAdapter.apply(state, [tombstone('b1'), tombstone(WORK_SHIFT_RECORD_ID), tombstone(DAILY_HABITS_RECORD_ID), tombstone('nope')]);
    expect(next.calendarBlocks.map((b) => b.id)).toEqual(['b2']);
    expect(next.workShift).toBeUndefined();
    expect(next.dailyHabits).toBeUndefined();
    expect(calendarAdapter.apply(next, [tombstone('b1'), tombstone('nope')])).toBe(next);
  });

  it('un tombstone nunca borra un bloque de gym local (no es propiedad de esta coleccion)', () => {
    const gym = block('cal-gym-lunes-0700-1', { category: 'gym' });
    const state: AppState = { ...BASE, calendarBlocks: [gym] };
    expect(calendarAdapter.apply(state, [tombstone(gym.id)])).toBe(state);
  });

  it('datos remotos invalidos no rompen ni cambian el estado', () => {
    const state: AppState = { ...BASE, calendarBlocks: [block('b1')], workShift: NIGHT_SHIFT, dailyHabits: HABITS };
    const bad: SyncRecord[] = [
      live('x1', null),
      live('x2', 'texto'),
      live('x3', { kind: 'block', value: { id: 'x3' } }),
      live('x4', { kind: 'otro', value: {} }),
      live('x5', { kind: 'block', value: { ...block('x5'), day: 'Funday' } }),
      live('b1', { kind: 'block', value: block('otro-id') }), // id del registro != id del bloque
      live(WORK_SHIFT_RECORD_ID, { kind: 'workShift', value: { enabled: 'si' } }),
      live(WORK_SHIFT_RECORD_ID, { kind: 'block', value: block('z') }), // tipo cruzado con id de singleton
      live('no-es-singleton', { kind: 'workShift', value: NIGHT_SHIFT }),
      live('no-es-singleton-2', { kind: 'dailyHabits', value: HABITS }),
      live(DAILY_HABITS_RECORD_ID, { kind: 'dailyHabits', value: { waterMl: 'mucho' } }),
      { ...live('otra', {}), collection: 'kanban' },
    ];
    let next: AppState = state;
    expect(() => {
      next = calendarAdapter.apply(state, bad);
    }).not.toThrow();
    expect(next).toBe(state);
  });

  it('un registro invalido en un lote no impide aplicar los validos', () => {
    const next = calendarAdapter.apply(BASE, [live('bad', { kind: 'block', value: 1 }), blockRec(block('ok'))]);
    expect(next.calendarBlocks.map((b) => b.id)).toEqual(['ok']);
  });
});

describe('calendarAdapter: habitos diarios (reinicio diario)', () => {
  const day = (d: string, water = 100): DailyHabits => ({ ...HABITS, waterMl: water, lastUpdatedDate: d });

  it('un dia ANTERIOR de otro dispositivo no sobrescribe el dia actual local', () => {
    const state: AppState = { ...BASE, dailyHabits: day('2026-11-13', 900) };
    const next = calendarAdapter.apply(state, [habitsRec(day('2026-11-12', 2400))]);
    expect(next).toBe(state);
    expect(next.dailyHabits?.waterMl).toBe(900);
  });

  it('un dia posterior o el mismo dia remoto SI se aplica', () => {
    const state: AppState = { ...BASE, dailyHabits: day('2026-11-13', 900) };
    expect(calendarAdapter.apply(state, [habitsRec(day('2026-11-14', 0))]).dailyHabits?.lastUpdatedDate).toBe('2026-11-14');
    const same = calendarAdapter.apply(state, [habitsRec(day('2026-11-13', 1200))]);
    expect(same.dailyHabits?.waterMl).toBe(1200);
  });

  it('sin habitos locales se adopta el remoto; remoto sin fecha (legacy) no pisa un local con fecha', () => {
    expect(calendarAdapter.apply(BASE, [habitsRec(day('2026-11-12'))]).dailyHabits).toEqual(day('2026-11-12'));
    const { lastUpdatedDate: _omit, ...legacy } = day('2026-11-12', 50);
    const state: AppState = { ...BASE, dailyHabits: day('2026-11-13', 900) };
    expect(calendarAdapter.apply(state, [habitsRec(legacy as DailyHabits)])).toBe(state);
    const localLegacy: AppState = { ...BASE, dailyHabits: legacy as DailyHabits };
    expect(calendarAdapter.apply(localLegacy, [habitsRec(day('2026-11-13', 300))]).dailyHabits?.waterMl).toBe(300);
  });
});

describe('calendarAdapter con el motor de sync (dos dispositivos)', () => {
  it('un bloque local y el turno nocturno viajan de A a B; lo de Google/gym no se sube', async () => {
    const server = new FakeServer();
    const clock = { t: Date.parse('2026-11-13T10:00:00Z') };
    const now = () => clock.t;
    const start: AppState = { ...EMPTY_STATE, calendarBlocks: [] };
    const a = createDevice({ server, now, initial: start, adapters: [calendarAdapter] });
    const b = createDevice({ server, now, initial: start, adapters: [calendarAdapter] });
    await a.start();
    await b.start();

    clock.t += 1000;
    a.edit((s) => ({
      ...s,
      calendarBlocks: [block('b1'), block('gcal-ev-2026-11-16'), block('g', { category: 'gym', googleEventId: 'gg' })],
      workShift: NIGHT_SHIFT,
    }));
    await a.engine.syncNow();
    await b.engine.syncNow();

    expect(b.holder.current.calendarBlocks.map((x) => x.id)).toEqual(['b1']);
    expect(b.holder.current.workShift).toEqual(NIGHT_SHIFT);
    expect(server.live('calendar').map((r) => r.id).sort()).toEqual(['b1', WORK_SHIFT_RECORD_ID]);

    // sin eco: tras converger no hay mas pushes
    const pushes = server.pushCount;
    await a.engine.syncNow();
    await b.engine.syncNow();
    expect(server.pushCount).toBe(pushes);

    clock.t += 1000;
    b.edit((s) => ({ ...s, calendarBlocks: [] }));
    await b.engine.syncNow();
    await a.engine.syncNow();
    expect(a.holder.current.calendarBlocks.map((x) => x.id)).toEqual(['gcal-ev-2026-11-16', 'g']); // lo no sincronizable queda intacto
  });
});
