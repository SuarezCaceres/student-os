import 'fake-indexeddb/auto';
import {
  GYM_PROFILE_RECORD_ID,
  SyncRecordSchema,
  dismissedAlertRecordId,
  weightEntryRecordId,
  type SyncRecord,
} from '@student-os/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { initialData } from '../../../data/initialData';
import type {
  AppState,
  ExerciseHistoryEntry,
  GymAttendanceLog,
  GymExercise,
  GymRoutine,
  UserGymProfile,
} from '../../../types';
import { generateAdaptiveRoutines } from '../../../utils/routineGenerator';
import { EMPTY_STATE, FakeServer, createDevice } from '../../__tests__/helpers';
import { gymAdapter } from '../gym';

// --- Fixtures ---------------------------------------------------------------------

const exercise = (id: string, extra: Partial<GymExercise> = {}): GymExercise => ({
  id,
  name: `Ejercicio ${id}`,
  sets: 3,
  reps: '8-10 reps',
  weightKg: 60,
  completedSets: [false, false, false],
  personalRecordKg: 70,
  restSeconds: 90,
  ...extra,
});

const BENCH_HISTORY: ExerciseHistoryEntry[] = [
  { date: '2026-10-20', weightKg: 62.5, reps: '8 reps' },
  { date: '2026-11-03', weightKg: 70, reps: '6 reps' },
];

const routine = (id: string, day: GymRoutine['dayOfWeek'], exercises: GymExercise[]): GymRoutine => ({
  id,
  name: `Rutina ${id}`,
  dayOfWeek: day,
  tag: 'Empuje',
  exercises,
});

const PROFILE: UserGymProfile = {
  gymType: 'smart_fit',
  trainingDaysCount: 3,
  selectedDays: ['Lunes', 'Miércoles', 'Viernes'],
  goal: 'hipertrofia',
  experience: 'intermedio',
  heightCm: 174,
  weightKg: 72.5,
  targetWeightKg: 75,
  bmi: 23.9,
  bmiCategory: 'normal',
  reminderMinutesBefore: [30, 10],
  defaultSessionMinutes: 90,
  configuredAt: '2026-11-01T10:00:00.000Z',
};

const LOG_DONE: GymAttendanceLog = {
  id: 'att-2026-11-10-gym-lunes',
  date: '2026-11-10',
  dayOfWeek: 'Lunes',
  routineId: 'gym-lunes',
  routineName: 'Empuje',
  status: 'completed',
  startedAt: '2026-11-10T22:00:00.000Z',
  finishedAt: '2026-11-10T23:15:00.000Z',
  durationMinutes: 75,
  streakProtected: true,
};
const LOG_MISSED: GymAttendanceLog = {
  id: 'att-2026-11-12-gym-miercoles',
  date: '2026-11-12',
  dayOfWeek: 'Miércoles',
  routineId: 'gym-miercoles',
  routineName: 'Pierna',
  status: 'missed',
  missReason: 'estudios_examenes',
  missNote: 'Parcial de redes',
  encouragementMessage: 'Mañana retomas.',
  streakProtected: true,
};
const LOG_RESCHEDULED: GymAttendanceLog = {
  id: 'att-2026-11-07-gym-viernes',
  date: '2026-11-07',
  dayOfWeek: 'Viernes',
  routineId: 'gym-viernes',
  routineName: 'Tiron',
  status: 'rescheduled',
  rescheduledToDay: 'Sábado',
  rescheduledToDate: '2026-11-08',
  rescheduledSlotStart: '10:00',
  rescheduledSlotEnd: '11:30',
  rescheduledCalendarBlockId: 'cb-9',
  googleEventId: 'g-123',
  reminderMinutes: [30],
};

/** Estado de gym COMPLETO (`initialData` no trae perfil, pesos, asistencia ni alertas). */
function fullGymState(): AppState {
  return {
    ...EMPTY_STATE,
    gymProfile: PROFILE,
    gymRoutines: [
      routine('gym-lunes', 'Lunes', [
        exercise('ex-bench', {
          name: 'Press banca',
          weightKg: 70,
          personalRecordKg: 72.5,
          completedSets: [true, true, false],
          history: BENCH_HISTORY,
          notes: 'Retraer escápulas',
          technique: {
            muscleGroups: ['pecho'],
            setupCues: ['Pies firmes'],
            executionCues: ['Baja controlado'],
            breathingCues: 'Inhala al bajar',
            commonMistakes: ['Rebotar la barra'],
            videoUrl: 'https://example.com/v.mp4',
          },
          thumbnailUrl: 'https://example.com/t.png',
        }),
        exercise('ex-fly'),
      ]),
      routine('gym-miercoles', 'Miércoles', [exercise('ex-squat', { weightKg: undefined })]),
      routine('gym-viernes', 'Viernes', []),
    ],
    weightHistory: [
      { date: '2026-11-01', weightKg: 72, bmi: 23.8 },
      { date: '2026-11-08', weightKg: 72.5, bmi: 23.9 },
    ],
    gymAttendanceLogs: [LOG_RESCHEDULED, LOG_DONE, LOG_MISSED],
    dismissedGymScheduleAlerts: ['2026-11-05', '2026-11-09'],
  };
}

/** Estado con la parte de gym vacia: lo que veria un dispositivo nuevo. */
function blankGymState(): AppState {
  const blank: AppState = { ...EMPTY_STATE, gymRoutines: [] };
  delete blank.gymProfile;
  delete blank.weightHistory;
  delete blank.gymAttendanceLogs;
  delete blank.dismissedGymScheduleAlerts;
  return blank;
}

const T0 = Date.parse('2026-11-13T10:00:00.000Z');
const iso = (offsetMs = 0) => new Date(T0 + offsetMs).toISOString();

function live(id: string, kind: string, value: unknown, offsetMs = 0, rev = 1): SyncRecord {
  return { id, collection: 'gym', data: { kind, value }, updatedAt: iso(offsetMs), deletedAt: null, rev };
}
function tomb(id: string, offsetMs = 0, rev = 2): SyncRecord {
  return { id, collection: 'gym', data: null, updatedAt: iso(offsetMs), deletedAt: iso(offsetMs), rev };
}
const routineRec = (r: GymRoutine, offsetMs = 0) => live(r.id, 'routine', r, offsetMs);

/** Convierte lo que emite `select` en registros de sync completos (como hace el motor). */
function toRecords(state: AppState): SyncRecord[] {
  return gymAdapter.select(state).map((r) => ({
    id: r.id,
    collection: 'gym' as const,
    data: JSON.parse(JSON.stringify(r.data)),
    updatedAt: iso(),
    deletedAt: null,
    rev: 1,
  }));
}

/** Normaliza el orden de las listas para comparar contenido. */
function normalized(state: AppState) {
  const sortBy = <T,>(list: T[] | undefined, key: (t: T) => string) =>
    [...(list ?? [])].sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
  return JSON.parse(
    JSON.stringify({
      gymProfile: state.gymProfile,
      gymRoutines: sortBy(state.gymRoutines, (r) => r.id),
      weightHistory: sortBy(state.weightHistory, (w) => w.date),
      gymAttendanceLogs: sortBy(state.gymAttendanceLogs, (l) => l.id),
      dismissedGymScheduleAlerts: sortBy(state.dismissedGymScheduleAlerts, (d) => d),
    }),
  );
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value as Record<string, unknown>).forEach(deepFreeze);
  }
  return value;
}

afterEach(() => {
  vi.restoreAllMocks();
});

// --- select -----------------------------------------------------------------------

describe('gymAdapter.select', () => {
  it('es la coleccion gym', () => {
    expect(gymAdapter.collection).toBe('gym');
  });

  it('un estado sin datos de gym no emite registros', () => {
    expect(gymAdapter.select(blankGymState())).toEqual([]);
  });

  it('proyecta cada entidad con id estable y {kind, value}', () => {
    const records = gymAdapter.select(fullGymState());
    const byId = new Map(records.map((r) => [r.id, r.data as { kind: string; value: unknown }]));

    expect(byId.get(GYM_PROFILE_RECORD_ID)).toEqual({ kind: 'profile', value: PROFILE });
    expect(byId.get('gym-lunes')?.kind).toBe('routine');
    expect(byId.get(weightEntryRecordId('2026-11-08'))).toEqual({
      kind: 'weightEntry',
      value: { date: '2026-11-08', weightKg: 72.5, bmi: 23.9 },
    });
    expect(byId.get(LOG_DONE.id)).toEqual({ kind: 'attendanceLog', value: LOG_DONE });
    expect(byId.get(dismissedAlertRecordId('2026-11-09'))).toEqual({ kind: 'dismissedAlert', value: '2026-11-09' });
    // 1 perfil + 3 rutinas + 2 pesos + 3 logs + 2 alertas
    expect(records).toHaveLength(11);
    expect(new Set(records.map((r) => r.id)).size).toBe(11);
  });

  it('un registro por rutina: tocar una serie solo cambia ese registro', () => {
    const before = gymAdapter.select(fullGymState());
    const state = fullGymState();
    state.gymRoutines = state.gymRoutines.map((r) =>
      r.id === 'gym-lunes'
        ? { ...r, exercises: r.exercises.map((e) => (e.id === 'ex-fly' ? { ...e, completedSets: [true, false, false] } : e)) }
        : r,
    );
    const after = gymAdapter.select(state);
    const changed = after.filter((r, i) => JSON.stringify(r) !== JSON.stringify(before[i])).map((r) => r.id);
    expect(changed).toEqual(['gym-lunes']);
  });

  it('colapsa duplicados: 1 peso por fecha (gana el ultimo) y 1 alerta por fecha', () => {
    const state: AppState = {
      ...blankGymState(),
      weightHistory: [
        { date: '2026-11-08', weightKg: 70, bmi: 23 },
        { date: '2026-11-08', weightKg: 71, bmi: 23.5 },
      ],
      dismissedGymScheduleAlerts: ['2026-11-05', '2026-11-05'],
    };
    const records = gymAdapter.select(state);
    expect(records).toHaveLength(2);
    expect((records.find((r) => r.id === 'weight-2026-11-08')!.data as { value: { weightKg: number } }).value.weightKg).toBe(71);
  });

  it('no lanza con datos corruptos y omite ids reservados', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const state = {
      ...blankGymState(),
      gymRoutines: [null, 'x', routine('gym-profile', 'Lunes', []), routine('weight-2026-01-01', 'Martes', []), routine('ok', 'Jueves', [])],
      weightHistory: [null, { weightKg: 1 }, { date: '2026-11-01', weightKg: 70, bmi: 22 }],
      gymAttendanceLogs: 'no-es-lista',
      dismissedGymScheduleAlerts: [null, '', 5, '2026-11-02'],
    } as unknown as AppState;
    const ids = gymAdapter.select(state).map((r) => r.id).sort();
    expect(ids).toEqual(['dismissed-2026-11-02', 'ok', 'weight-2026-11-01']);
    expect(warn).toHaveBeenCalled();
  });

  it('no emite NaN ni rompe con campos undefined (el motor los normaliza)', () => {
    const state: AppState = { ...blankGymState(), gymRoutines: [routine('r', 'Lunes', [exercise('e', { weightKg: undefined })])] };
    const [rec] = gymAdapter.select(state);
    expect(() => JSON.stringify(rec.data)).not.toThrow();
  });
});

// --- Contrato (round-trip con los esquemas de shared) ------------------------------

describe('contrato: round-trip con @student-os/shared', () => {
  it('select -> SyncRecord valido -> apply en un dispositivo nuevo reproduce el estado completo', () => {
    const source = fullGymState();
    const records = toRecords(source);
    for (const record of records) {
      const parsed = SyncRecordSchema.safeParse(record);
      expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
    }
    const target = gymAdapter.apply(blankGymState(), records);
    expect(normalized(target)).toEqual(normalized(source));
    // Y lo que no es de gym no se toca.
    expect(target.kanbanItems).toBe(blankGymState().kanbanItems);
    expect(target.streak).toBe(EMPTY_STATE.streak);
  });

  it('el orden de llegada no importa: cualquier permutacion da el mismo estado y el mismo orden de listas', () => {
    const records = toRecords(fullGymState());
    const reversed = [...records].reverse();
    const rotated = [...records.slice(4), ...records.slice(0, 4)];
    const a = gymAdapter.apply(blankGymState(), records);
    const b = gymAdapter.apply(blankGymState(), reversed);
    const c = gymAdapter.apply(blankGymState(), rotated);
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
    expect(JSON.stringify(c)).toBe(JSON.stringify(a));
    // Ordenes documentados
    expect(a.gymRoutines.map((r) => r.dayOfWeek)).toEqual(['Lunes', 'Miércoles', 'Viernes']);
    expect(a.weightHistory!.map((w) => w.date)).toEqual(['2026-11-01', '2026-11-08']);
    expect(a.gymAttendanceLogs!.map((l) => l.date)).toEqual(['2026-11-07', '2026-11-10', '2026-11-12']);
    expect(a.dismissedGymScheduleAlerts).toEqual(['2026-11-05', '2026-11-09']);
  });

  it('los registros ajenos a gym se ignoran', () => {
    const state = fullGymState();
    const foreign: SyncRecord = { id: 'k1', collection: 'kanban', data: { id: 'k1' }, updatedAt: iso(), deletedAt: null, rev: 1 };
    expect(gymAdapter.apply(state, [foreign])).toBe(state);
  });
});

// --- apply: altas, ediciones y borrados ---------------------------------------------

describe('gymAdapter.apply', () => {
  it('es inmutable: no muta el estado de entrada (congelado) y devuelve un estado nuevo', () => {
    const state = deepFreeze(fullGymState());
    const edited = { ...state.gymRoutines[0], name: 'Renombrada' };
    const next = gymAdapter.apply(state, [routineRec(edited, 1000), tomb(LOG_DONE.id, 1000), tomb(GYM_PROFILE_RECORD_ID, 1000)]);
    expect(next).not.toBe(state);
    expect(state.gymRoutines[0].name).not.toBe('Renombrada');
    expect(next.gymRoutines.find((r) => r.id === 'gym-lunes')!.name).toBe('Renombrada');
    expect(state.gymProfile).toBeDefined();
    expect('gymProfile' in next).toBe(false);
  });

  it('es idempotente: reaplicar los mismos registros devuelve la MISMA referencia', () => {
    const records = [
      routineRec(routine('gym-jueves', 'Jueves', [exercise('e1')])),
      live(weightEntryRecordId('2026-11-13'), 'weightEntry', { date: '2026-11-13', weightKg: 73, bmi: 24 }),
      live(dismissedAlertRecordId('2026-11-13'), 'dismissedAlert', '2026-11-13'),
      live(LOG_DONE.id, 'attendanceLog', LOG_DONE),
      live(GYM_PROFILE_RECORD_ID, 'profile', PROFILE),
      tomb('gym-viernes', 100),
      tomb(dismissedAlertRecordId('2026-11-05'), 100),
    ];
    const once = gymAdapter.apply(fullGymState(), records);
    const twice = gymAdapter.apply(once, records);
    expect(twice).toBe(once);
    expect(normalized(twice)).toEqual(normalized(once));
  });

  it('un lote vacio o sin cambios reales devuelve el mismo estado', () => {
    const state = fullGymState();
    expect(gymAdapter.apply(state, [])).toBe(state);
    expect(gymAdapter.apply(state, toRecords(state))).toBe(state);
  });

  it('alta: rutina nueva se inserta en su dia; ejercicio nuevo dentro de una rutina existente', () => {
    const state = fullGymState();
    const withNew = gymAdapter.apply(state, [routineRec(routine('gym-martes', 'Martes', [exercise('e9')]))]);
    expect(withNew.gymRoutines.map((r) => r.id)).toEqual(['gym-lunes', 'gym-martes', 'gym-miercoles', 'gym-viernes']);

    const lunes = state.gymRoutines[0];
    const added = gymAdapter.apply(state, [routineRec({ ...lunes, exercises: [...lunes.exercises, exercise('ex-nuevo')] }, 500)]);
    expect(added.gymRoutines.find((r) => r.id === 'gym-lunes')!.exercises.map((e) => e.id)).toEqual(['ex-bench', 'ex-fly', 'ex-nuevo']);
  });

  it('edicion: reemplaza rutina, perfil, peso y log; el resto no cambia de referencia', () => {
    const state = fullGymState();
    const newLog = { ...LOG_MISSED, status: 'completed' as const, finishedAt: iso() };
    const next = gymAdapter.apply(state, [
      live(GYM_PROFILE_RECORD_ID, 'profile', { ...PROFILE, goal: 'fuerza' }, 1000),
      live(weightEntryRecordId('2026-11-08'), 'weightEntry', { date: '2026-11-08', weightKg: 73.2, bmi: 24.1 }, 1000),
      live(LOG_MISSED.id, 'attendanceLog', newLog, 1000),
    ]);
    expect(next.gymProfile!.goal).toBe('fuerza');
    expect(next.weightHistory!.find((w) => w.date === '2026-11-08')!.weightKg).toBe(73.2);
    expect(next.gymAttendanceLogs!.find((l) => l.id === LOG_MISSED.id)!.status).toBe('completed');
    expect(next.weightHistory).toHaveLength(2);
    expect(next.gymRoutines).toBe(state.gymRoutines); // no hubo registros de rutinas
    expect(next.dismissedGymScheduleAlerts).toBe(state.dismissedGymScheduleAlerts);
  });

  it('borrado: tombstones eliminan rutina, peso, log, perfil y alerta; tombstone de algo inexistente es no-op', () => {
    const state = fullGymState();
    const next = gymAdapter.apply(state, [
      tomb('gym-viernes'),
      tomb(weightEntryRecordId('2026-11-01')),
      tomb(LOG_RESCHEDULED.id),
      tomb(GYM_PROFILE_RECORD_ID),
      tomb(dismissedAlertRecordId('2026-11-05')),
    ]);
    expect(next.gymRoutines.map((r) => r.id)).toEqual(['gym-lunes', 'gym-miercoles']);
    expect(next.weightHistory!.map((w) => w.date)).toEqual(['2026-11-08']);
    expect(next.gymAttendanceLogs!.map((l) => l.id).sort()).toEqual([LOG_MISSED.id, LOG_DONE.id].sort());
    expect(next.gymProfile).toBeUndefined();
    expect(next.dismissedGymScheduleAlerts).toEqual(['2026-11-09']);

    expect(gymAdapter.apply(next, [tomb('no-existe'), tomb('weight-1999-01-01'), tomb('dismissed-1999-01-01')])).toBe(next);
  });

  it('en un mismo lote gana la version mas reciente de cada id (tombstone posterior borra; alta posterior revive)', () => {
    const state = fullGymState();
    const lunes = state.gymRoutines[0];
    const deletedThenEdited = gymAdapter.apply(state, [tomb('gym-lunes', 1000), routineRec({ ...lunes, name: 'Revivida' }, 2000)]);
    expect(deletedThenEdited.gymRoutines.find((r) => r.id === 'gym-lunes')!.name).toBe('Revivida');
    const editedThenDeleted = gymAdapter.apply(state, [routineRec({ ...lunes, name: 'X' }, 1000), tomb('gym-lunes', 2000)]);
    expect(editedThenDeleted.gymRoutines.find((r) => r.id === 'gym-lunes')).toBeUndefined();
  });

  it('alertas descartadas: se descartan y se des-descartan como conjunto, sin duplicados y ordenadas', () => {
    let state = blankGymState();
    state = gymAdapter.apply(state, [
      live(dismissedAlertRecordId('2026-11-09'), 'dismissedAlert', '2026-11-09'),
      live(dismissedAlertRecordId('2026-11-02'), 'dismissedAlert', '2026-11-02'),
    ]);
    expect(state.dismissedGymScheduleAlerts).toEqual(['2026-11-02', '2026-11-09']);
    const again = gymAdapter.apply(state, [live(dismissedAlertRecordId('2026-11-09'), 'dismissedAlert', '2026-11-09', 5000)]);
    expect(again).toBe(state);
    const cleared = gymAdapter.apply(state, [tomb(dismissedAlertRecordId('2026-11-09')), tomb(dismissedAlertRecordId('2026-11-02'))]);
    expect(cleared.dismissedGymScheduleAlerts).toEqual([]);
  });

  it('dos logs de la misma fecha con ids distintos: queda uno solo, el mas avanzado (determinista)', () => {
    const inProgress: GymAttendanceLog = {
      id: 'att-2026-11-10-otra',
      date: '2026-11-10',
      dayOfWeek: 'Lunes',
      routineId: 'otra',
      routineName: 'Otra',
      status: 'in_progress',
      startedAt: '2026-11-10T20:00:00.000Z',
    };
    const forward = gymAdapter.apply(blankGymState(), [live(LOG_DONE.id, 'attendanceLog', LOG_DONE), live(inProgress.id, 'attendanceLog', inProgress)]);
    const backward = gymAdapter.apply(blankGymState(), [live(inProgress.id, 'attendanceLog', inProgress), live(LOG_DONE.id, 'attendanceLog', LOG_DONE)]);
    expect(forward.gymAttendanceLogs).toEqual([LOG_DONE]);
    expect(backward.gymAttendanceLogs).toEqual([LOG_DONE]);
  });
});

// --- Datos remotos invalidos --------------------------------------------------------

describe('datos remotos invalidos', () => {
  it('se ignoran sin lanzar ni tocar el estado; los validos del mismo lote si se aplican', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const state = fullGymState();
    const good = routineRec(routine('gym-sabado', 'Sábado', [exercise('e1')]));
    const bad: SyncRecord[] = [
      live('x1', 'routine', { id: 'x1', name: 1 }), // forma invalida
      live('x2', 'desconocido', {}), // kind desconocido
      { ...live('x3', 'routine', null), data: null }, // vivo sin data
      live('id-distinto', 'routine', routine('otro-id', 'Lunes', [])), // id incoherente con el valor
      live('gym-profile', 'routine', routine('gym-profile', 'Lunes', [])), // id reservado
      live('weight-2026-11-01', 'weightEntry', { date: '2026-12-31', weightKg: 70, bmi: 22 }), // id != fecha
      live('dismissed-2026-11-01', 'dismissedAlert', '2026-11-02'),
      live('dismissed-', 'dismissedAlert', ''),
      live('gym-profile', 'profile', { ...PROFILE, goal: 'inexistente' }),
      live('mal-perfil', 'profile', PROFILE),
      live('log-x', 'attendanceLog', { ...LOG_DONE, id: 'log-x', status: 'volando' }),
    ];
    const next = gymAdapter.apply(state, [...bad, good]);
    expect(next.gymRoutines.map((r) => r.id)).toEqual(['gym-lunes', 'gym-miercoles', 'gym-viernes', 'gym-sabado']);
    expect(next.gymProfile).toBe(state.gymProfile);
    expect(next.weightHistory).toBe(state.weightHistory);
    expect(next.gymAttendanceLogs).toBe(state.gymAttendanceLogs);
    expect(next.dismissedGymScheduleAlerts).toBe(state.dismissedGymScheduleAlerts);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('invalidos'));
  });

  it('solo registros invalidos: devuelve el mismo estado', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const state = fullGymState();
    expect(gymAdapter.apply(state, [live('x', 'routine', 'basura')])).toBe(state);
  });

  it('un estado local corrupto no rompe apply', () => {
    const corrupted = { ...fullGymState(), gymRoutines: null, weightHistory: 'x', gymAttendanceLogs: [null, 3], dismissedGymScheduleAlerts: 7 } as unknown as AppState;
    const next = gymAdapter.apply(corrupted, [
      routineRec(routine('gym-lunes', 'Lunes', [])),
      live(weightEntryRecordId('2026-11-01'), 'weightEntry', { date: '2026-11-01', weightKg: 70, bmi: 22 }),
      live(LOG_DONE.id, 'attendanceLog', LOG_DONE),
      live(dismissedAlertRecordId('2026-11-01'), 'dismissedAlert', '2026-11-01'),
    ]);
    expect(next.gymRoutines.map((r) => r.id)).toEqual(['gym-lunes']);
    expect(next.weightHistory).toHaveLength(1);
    expect(next.gymAttendanceLogs).toEqual([LOG_DONE]);
    expect(next.dismissedGymScheduleAlerts).toEqual(['2026-11-01']);
  });
});

// --- PRs, historial y "ultima edicion gana" sobre la rutina -------------------------

describe('PRs e historial frente a "ultima edicion gana"', () => {
  const localRoutine = (): GymRoutine =>
    routine('gym-lunes', 'Lunes', [
      exercise('ex-bench', {
        personalRecordKg: 80,
        weightKg: 80,
        history: [...BENCH_HISTORY, { date: '2026-11-12', weightKg: 80, reps: '5 reps' }],
        completedSets: [true, true, true],
      }),
    ]);
  const remoteRoutine = (): GymRoutine =>
    routine('gym-lunes', 'Lunes', [
      exercise('ex-bench', {
        personalRecordKg: 72.5,
        weightKg: 72.5,
        history: BENCH_HISTORY,
        completedSets: [false, false, false],
        notes: 'Nota remota',
      }),
    ]);

  it('una version remota mas vieja en historial no borra el PR ni los levantamientos locales', () => {
    const state: AppState = { ...blankGymState(), gymRoutines: [localRoutine()] };
    const next = gymAdapter.apply(state, [routineRec(remoteRoutine(), 5000)]);
    const bench = next.gymRoutines[0].exercises[0];
    expect(bench.personalRecordKg).toBe(80);
    expect(bench.history).toEqual([...BENCH_HISTORY, { date: '2026-11-12', weightKg: 80, reps: '5 reps' }]);
    // El resto de campos si son de la version remota ("ultima edicion gana")
    expect(bench.notes).toBe('Nota remota');
    expect(bench.weightKg).toBe(72.5);
    expect(bench.completedSets).toEqual([false, false, false]);
  });

  it('un PR remoto mas alto se respeta y la fusion es idempotente', () => {
    const remote = remoteRoutine();
    remote.exercises[0].personalRecordKg = 90;
    const state: AppState = { ...blankGymState(), gymRoutines: [localRoutine()] };
    const once = gymAdapter.apply(state, [routineRec(remote, 5000)]);
    expect(once.gymRoutines[0].exercises[0].personalRecordKg).toBe(90);
    expect(gymAdapter.apply(once, [routineRec(remote, 5000)])).toBe(once);
  });

  it('sin historial propio distinto, la rutina remota gana tal cual (un PR bajado a proposito se respeta)', () => {
    const local = localRoutine();
    local.exercises[0].history = BENCH_HISTORY;
    local.exercises[0].personalRecordKg = 100;
    const remote = remoteRoutine();
    remote.exercises[0].personalRecordKg = 75;
    const next = gymAdapter.apply({ ...blankGymState(), gymRoutines: [local] }, [routineRec(remote, 5000)]);
    expect(next.gymRoutines[0].exercises[0].personalRecordKg).toBe(75);
  });

  it('no se fusionan las series: las completadas locales no resucitan sobre un reinicio remoto', () => {
    const next = gymAdapter.apply({ ...blankGymState(), gymRoutines: [localRoutine()] }, [routineRec(remoteRoutine(), 5000)]);
    expect(next.gymRoutines[0].exercises[0].completedSets).toEqual([false, false, false]);
  });

  it('un ejercicio borrado en la rutina remota desaparece (la estructura la manda el servidor)', () => {
    const local = localRoutine();
    local.exercises.push(exercise('ex-local-extra'));
    const next = gymAdapter.apply({ ...blankGymState(), gymRoutines: [local] }, [routineRec(remoteRoutine(), 5000)]);
    expect(next.gymRoutines[0].exercises.map((e) => e.id)).toEqual(['ex-bench']);
  });

  it('el historial se une sin duplicados y queda ordenado por fecha de forma estable', () => {
    const local = routine('r', 'Lunes', [
      exercise('e', { history: [{ date: '2026-11-05', weightKg: 50, reps: '10' }, { date: '2026-11-09', weightKg: 55, reps: '8' }] }),
    ]);
    const remote = routine('r', 'Lunes', [
      exercise('e', { history: [{ date: '2026-11-05', weightKg: 50, reps: '10' }, { date: '2026-11-07', weightKg: 52, reps: '9' }] }),
    ]);
    const next = gymAdapter.apply({ ...blankGymState(), gymRoutines: [local] }, [routineRec(remote, 1)]);
    expect(next.gymRoutines[0].exercises[0].history!.map((h) => h.date)).toEqual(['2026-11-05', '2026-11-07', '2026-11-09']);
  });

  it('recorte defensivo: una rutina con historial gigante cabe en 64 KB y conserva el PR y las entradas recientes', () => {
    const history: ExerciseHistoryEntry[] = Array.from({ length: 3000 }, (_, i) => ({
      date: `2026-01-${String((i % 28) + 1).padStart(2, '0')}`,
      weightKg: 40 + (i % 50),
      reps: `${8 + (i % 4)} reps ${'x'.repeat(10)}`,
    }));
    history.push({ date: '2026-11-13', weightKg: 123, reps: 'ultima' });
    const state: AppState = {
      ...blankGymState(),
      gymRoutines: [routine('big', 'Lunes', [exercise('e', { personalRecordKg: 123, history })])],
    };
    expect(new TextEncoder().encode(JSON.stringify(state.gymRoutines[0])).length).toBeGreaterThan(64 * 1024);
    const [rec] = gymAdapter.select(state);
    const value = (rec.data as { value: GymRoutine }).value;
    expect(new TextEncoder().encode(JSON.stringify(rec.data)).length).toBeLessThan(64 * 1024);
    expect(value.exercises[0].personalRecordKg).toBe(123);
    expect(value.exercises[0].history!.at(-1)).toEqual({ date: '2026-11-13', weightKg: 123, reps: 'ultima' });
    // El estado local no se toca (select no muta)
    expect(state.gymRoutines[0].exercises[0].history).toHaveLength(3001);
  });

  it('tamano real: las rutinas demo y las generadas caben con holgura en el limite de 64 KB por registro', () => {
    const generated = generateAdaptiveRoutines({
      gymType: 'smart_fit',
      trainingDaysCount: 6,
      selectedDays: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
      goal: 'perdida_grasa',
      experience: 'avanzado',
      weightKg: 80,
    });
    const sizes = [...initialData.gymRoutines, ...generated].map((r) => new TextEncoder().encode(JSON.stringify(r)).length);
    expect(sizes.length).toBeGreaterThan(6);
    expect(Math.max(...sizes)).toBeLessThan(16 * 1024);
  });
});

// --- Motor de sync completo (servidor simulado que valida el contrato) ---------------

describe('motor de sync con el adaptador real de gym', () => {
  async function pair() {
    const server = new FakeServer();
    const clock = { t: Date.parse('2026-11-13T10:00:00Z') };
    const now = () => clock.t;
    const a = createDevice({ server, now, adapters: [gymAdapter] });
    const b = createDevice({ server, now, adapters: [gymAdapter] });
    await a.start();
    await b.start();
    return { server, clock, a, b };
  }

  const toggleSet = (routineId: string, exerciseId: string, idx: number) => (s: AppState): AppState => ({
    ...s,
    gymRoutines: s.gymRoutines.map((r) =>
      r.id !== routineId
        ? r
        : {
            ...r,
            exercises: r.exercises.map((e) => {
              if (e.id !== exerciseId) return e;
              const sets = [...e.completedSets];
              sets[idx] = !sets[idx];
              return { ...e, completedSets: sets };
            }),
          },
    ),
  });

  it('el estado completo de gym viaja A -> servidor -> B y converge (el servidor valida cada registro)', async () => {
    const { server, clock, a, b } = await pair();
    clock.t += 1000;
    a.edit((s) => ({ ...fullGymState(), kanbanItems: s.kanbanItems, calendarBlocks: s.calendarBlocks }));
    await a.engine.syncNow();
    await b.engine.syncNow();

    expect(normalized(b.holder.current)).toEqual(normalized(a.holder.current));
    const ids = server.live('gym').map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length); // sin duplicados
    expect(ids).toContain(GYM_PROFILE_RECORD_ID);
    expect(ids).toContain(dismissedAlertRecordId('2026-11-09'));
    expect(a.engine.getStatus().pending).toBe(0);
    expect(b.engine.getStatus().pending).toBe(0);
  });

  it('completar series offline y reconectar: sube solo lo tocado, sin duplicar ni perder PR/historial', async () => {
    const server = new FakeServer();
    const clock = { t: Date.parse('2026-11-13T10:00:00Z') };
    const now = () => clock.t;
    const bOnline = { value: true };
    const a = createDevice({ server, now, adapters: [gymAdapter] });
    const b = createDevice({ server, now, adapters: [gymAdapter], online: bOnline });
    await a.start();
    await b.start();

    clock.t += 1000;
    a.edit(() => fullGymState());
    await a.engine.syncNow();
    await b.engine.syncNow();
    const liveBefore = server.live('gym').length;
    const serverLunes = server.live('gym').find((r) => r.id === 'gym-lunes')!.data as { value: GymRoutine };
    const serverBench = serverLunes.value.exercises[0];

    // B pierde la red: marca series y registra la asistencia del dia.
    bOnline.value = false;
    clock.t += 1000;
    b.edit(toggleSet('gym-lunes', 'ex-fly', 0));
    b.edit(toggleSet('gym-lunes', 'ex-fly', 1));
    b.edit((s) => ({
      ...s,
      gymAttendanceLogs: [...(s.gymAttendanceLogs ?? []), { ...LOG_DONE, id: 'att-2026-11-13-gym-lunes', date: '2026-11-13' }],
    }));
    await b.engine.syncNow();
    expect(b.engine.getStatus().pending).toBe(2); // 1 rutina (2 toques agrupados) + 1 log
    expect(server.live('gym')).toHaveLength(liveBefore);

    // Vuelve la red: se sube todo y A lo recibe.
    bOnline.value = true;
    await b.engine.syncNow();
    expect(b.engine.getStatus().pending).toBe(0);
    await a.engine.syncNow();

    expect(server.live('gym')).toHaveLength(liveBefore + 1); // solo el log nuevo; ninguna rutina duplicada
    const aLunes = a.holder.current.gymRoutines.find((r) => r.id === 'gym-lunes')!;
    expect(aLunes.exercises.find((e) => e.id === 'ex-fly')!.completedSets).toEqual([true, true, false]);
    const bench = aLunes.exercises.find((e) => e.id === 'ex-bench')!;
    expect(bench).toEqual(serverBench); // PR (72.5), historial y tecnica intactos
    expect(bench.personalRecordKg).toBe(72.5);
    expect(bench.history).toEqual(BENCH_HISTORY);
    expect(a.holder.current.gymAttendanceLogs!.map((l) => l.date)).toContain('2026-11-13');
    expect(normalized(a.holder.current)).toEqual(normalized(b.holder.current));
  });

  it('alertas descartadas y re-activadas se replican entre dispositivos', async () => {
    const { clock, a, b } = await pair();
    clock.t += 1000;
    a.edit((s) => ({ ...s, dismissedGymScheduleAlerts: ['2026-11-05', '2026-11-09'] }));
    await a.engine.syncNow();
    await b.engine.syncNow();
    expect(b.holder.current.dismissedGymScheduleAlerts).toEqual(['2026-11-05', '2026-11-09']);

    clock.t += 1000;
    b.edit((s) => ({ ...s, dismissedGymScheduleAlerts: (s.dismissedGymScheduleAlerts ?? []).filter((d) => d !== '2026-11-05') }));
    await b.engine.syncNow();
    await a.engine.syncNow();
    expect(a.holder.current.dismissedGymScheduleAlerts).toEqual(['2026-11-09']);

    clock.t += 1000;
    a.edit((s) => ({ ...s, dismissedGymScheduleAlerts: [] })); // p. ej. reconfigurar el horario las limpia todas
    await a.engine.syncNow();
    await b.engine.syncNow();
    expect(b.holder.current.dismissedGymScheduleAlerts ?? []).toEqual([]);
  });

  it('borrar rutinas y perfil en un dispositivo los borra en el otro; el eco no resucita nada', async () => {
    const { server, clock, a, b } = await pair();
    clock.t += 1000;
    a.edit(() => fullGymState());
    await a.engine.syncNow();
    await b.engine.syncNow();

    clock.t += 1000;
    a.edit((s) => {
      const next: AppState = { ...s, gymRoutines: s.gymRoutines.filter((r) => r.id !== 'gym-viernes') };
      delete next.gymProfile;
      return next;
    });
    await a.engine.syncNow();
    await b.engine.syncNow();
    expect(b.holder.current.gymRoutines.map((r) => r.id)).toEqual(['gym-lunes', 'gym-miercoles']);
    expect(b.holder.current.gymProfile).toBeUndefined();
    expect(b.engine.getStatus().pending).toBe(0);
    await a.engine.syncNow();
    expect(a.engine.getStatus().pending).toBe(0);
    expect(server.live('gym').map((r) => r.id)).not.toContain('gym-viernes');
  });

  it('conflicto sobre la misma rutina: gana la ultima edicion y ambos convergen', async () => {
    const { clock, a, b } = await pair();
    clock.t += 1000;
    a.edit(() => fullGymState());
    await a.engine.syncNow();
    await b.engine.syncNow();

    clock.t += 1000;
    a.edit(toggleSet('gym-lunes', 'ex-fly', 0)); // A, mas vieja
    clock.t += 5000;
    b.edit(toggleSet('gym-lunes', 'ex-fly', 2)); // B, mas nueva
    await b.engine.syncNow();
    await a.engine.syncNow();
    await b.engine.syncNow();

    const sets = (d: typeof a) => d.holder.current.gymRoutines.find((r) => r.id === 'gym-lunes')!.exercises.find((e) => e.id === 'ex-fly')!.completedSets;
    expect(sets(a)).toEqual([false, false, true]);
    expect(sets(b)).toEqual([false, false, true]);
  });

  it('PR registrado offline mientras otro dispositivo edita la misma rutina: no se pierde localmente y se recupera al volver a editar', async () => {
    const server = new FakeServer();
    const clock = { t: Date.parse('2026-11-13T10:00:00Z') };
    const now = () => clock.t;
    const aOnline = { value: true };
    const a = createDevice({ server, now, adapters: [gymAdapter], online: aOnline });
    const b = createDevice({ server, now, adapters: [gymAdapter] });
    await a.start();
    await b.start();
    clock.t += 1000;
    a.edit(() => fullGymState());
    await a.engine.syncNow();
    await b.engine.syncNow();

    const newLift: ExerciseHistoryEntry = { date: '2026-11-13', weightKg: 80, reps: '5 reps' };
    const withPr = (s: AppState): AppState => ({
      ...s,
      gymRoutines: s.gymRoutines.map((r) =>
        r.id !== 'gym-lunes'
          ? r
          : {
              ...r,
              exercises: r.exercises.map((e) =>
                e.id === 'ex-bench' ? { ...e, weightKg: 80, personalRecordKg: 80, history: [...(e.history ?? []), newLift] } : e,
              ),
            },
      ),
    });

    aOnline.value = false;
    clock.t += 1000;
    a.edit(withPr); // A: nuevo PR sin red
    clock.t += 5000;
    b.edit(toggleSet('gym-lunes', 'ex-fly', 0)); // B: edicion MAS NUEVA de la misma rutina
    await b.engine.syncNow();

    aOnline.value = true;
    await a.engine.syncNow();

    const benchOf = (d: typeof a) => d.holder.current.gymRoutines.find((r) => r.id === 'gym-lunes')!.exercises.find((e) => e.id === 'ex-bench')!;
    // En A no se pierde el PR ni el levantamiento, y B conserva su serie marcada.
    expect(benchOf(a).personalRecordKg).toBe(80);
    expect(benchOf(a).history).toContainEqual(newLift);
    expect(a.holder.current.gymRoutines.find((r) => r.id === 'gym-lunes')!.exercises.find((e) => e.id === 'ex-fly')!.completedSets[0]).toBe(true);

    // LIMITACION CONOCIDA: lo fusionado no se re-sube solo (el motor reconstruye su snapshot tras aplicar), asi que
    // B aun no lo ve. En cuanto A edita esa rutina otra vez, la union llega al servidor y a B.
    await b.engine.syncNow();
    expect(benchOf(b).personalRecordKg).toBe(72.5);
    clock.t += 1000;
    a.edit(toggleSet('gym-lunes', 'ex-fly', 1));
    await a.engine.syncNow();
    await b.engine.syncNow();
    expect(benchOf(b).personalRecordKg).toBe(80);
    expect(benchOf(b).history).toContainEqual(newLift);
  });

  it('registros remotos invalidos en el servidor no rompen el estado del dispositivo', async () => {
    const { server, a } = await pair();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    // Pasan el envoltorio pero no el contrato: el cliente los descarta antes de llegar al adaptador.
    server.put({ id: 'roto', collection: 'gym', data: { kind: 'routine', value: { id: 'roto' } }, updatedAt: iso(1000), deletedAt: null, rev: 1 });
    server.put({ ...routineRec(routine('gym-jueves', 'Jueves', [exercise('ok')]), 2000) });
    await a.engine.syncNow();
    const ids = a.holder.current.gymRoutines.map((r) => r.id);
    expect(ids).not.toContain('roto');
    expect(ids).toContain('gym-jueves');
    expect(a.engine.getStatus().pending).toBe(0);
  });
});
