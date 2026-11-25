import { describe, expect, it } from 'vitest';
import { AppStateSchema, APP_STATE_FIELDS, APP_STATE_TO_COLLECTION, COLLECTIONS } from '../src';
import type { AppState } from '../src';
import { initialData } from './fixtures/initialData.fixture';
import type { AppState as LegacyAppState } from './fixtures/legacyTypes.fixture';

describe('AppStateSchema vs initialData real', () => {
  it('valida el estado inicial completo sin pérdida', () => {
    const parsed = AppStateSchema.parse(initialData);
    // Sin pérdida: ninguna clave/valor se descarta ni se modifica.
    expect(parsed).toEqual(initialData);
    expect(JSON.parse(JSON.stringify(parsed))).toEqual(JSON.parse(JSON.stringify(initialData)));
  });

  it('el estado inicial sobrevive a un ciclo JSON (localStorage)', () => {
    const roundTripped = JSON.parse(JSON.stringify(initialData));
    expect(AppStateSchema.parse(roundTripped)).toEqual(initialData);
  });

  it('weeklyReflections acepta claves numéricas en texto y rechaza otras', () => {
    const base = AppStateSchema.parse(initialData);
    const bad = { ...base, weeklyReflections: { semana5: base.weeklyReflections!['5'] } };
    expect(AppStateSchema.safeParse(bad).success).toBe(false);
  });

  it('acepta un estado mínimo (todos los opcionales ausentes)', () => {
    const minimal = {
      studentName: 'A',
      career: 'B',
      currentAcademicWeek: 1,
      streak: 0,
      theme: 'light',
      kanbanItems: [],
      gymRoutines: [],
      calendarBlocks: [],
      universityAssignments: [],
    };
    expect(AppStateSchema.parse(minimal)).toEqual(minimal);
  });

  it('acepta un estado con todos los campos opcionales presentes', () => {
    const full: AppState = {
      ...AppStateSchema.parse(initialData),
      dailyHabits: {
        waterMl: 500,
        targetWaterMl: 2500,
        sleepHours: 7,
        targetSleepHours: 8,
        pomodorosDone: 2,
        targetPomodoros: 6,
        lastUpdatedDate: '2026-11-13',
      },
      workShift: {
        enabled: true,
        title: 'Turno',
        startTime: '22:00',
        endTime: '06:00',
        restDay: 'Jueves',
        location: 'Oficina',
        reminderMinutes: [30],
        syncWithGoogle: true,
      },
      gymProfile: {
        gymType: 'smart_fit',
        trainingDaysCount: 4,
        selectedDays: ['Lunes', 'Martes'],
        goal: 'hipertrofia',
        experience: 'intermedio',
        heightCm: 175,
        weightKg: 70,
        targetWeightKg: 75,
        bmi: 22.9,
        bmiCategory: 'normal',
        reminderMinutesBefore: [60],
        defaultSessionMinutes: 90,
        configuredAt: '2026-11-13T10:00:00.000Z',
      },
      weightHistory: [{ date: '2026-11-13', weightKg: 70, bmi: 22.9 }],
      gymAttendanceLogs: [
        {
          id: 'log-1',
          date: '2026-11-13',
          dayOfWeek: 'Viernes',
          routineId: 'gym-fri',
          routineName: 'Torso',
          status: 'rescheduled',
          missReason: 'otro',
          rescheduledToDay: 'Sábado',
          streakProtected: true,
        },
      ],
      dismissedGymScheduleAlerts: ['2026-11-10'],
      chores: [{ id: 'chore-base-1', name: 'Tender la cama', days: ['Lunes', 'Martes'], order: 0 }],
      choreDays: [
        {
          date: '2026-11-13',
          completed: [{ choreId: 'chore-base-1', name: 'Tender la cama' }],
          hard: true,
          reason: 'cansado',
        },
      ],
      choreSettings: { seeded: true, levels: [{ min: 5, message: '¡Eres lo máximo!' }] },
    };
    expect(AppStateSchema.parse(full)).toEqual(full);
  });
});

describe('compatibilidad de tipos con src/types/index.ts', () => {
  it('tipos inferidos y legacy son mutuamente asignables (verificado por tsc)', () => {
    type Shared = AppState;
    // Inferido -> legacy
    const toLegacy = (s: Shared): LegacyAppState => s;
    // Legacy -> inferido (weeklyReflections usa índice number en legacy, ver CONTRACT.md)
    const fromLegacy = (l: Omit<LegacyAppState, 'weeklyReflections'>): Omit<Shared, 'weeklyReflections'> => l;
    expect(typeof toLegacy).toBe('function');
    expect(typeof fromLegacy).toBe('function');
  });

  it('APP_STATE_FIELDS coincide con las claves de AppState legacy', () => {
    const legacyKeys: Array<keyof LegacyAppState> = [
      'studentName',
      'career',
      'currentAcademicWeek',
      'streak',
      'theme',
      'dailyHabits',
      'workShift',
      'gymProfile',
      'weightHistory',
      'gymAttendanceLogs',
      'dismissedGymScheduleAlerts',
      'weeklyReflections',
      'kanbanItems',
      'gymRoutines',
      'calendarBlocks',
      'universityAssignments',
    ];
    // Campos que nacieron despues del tipo legacy (solo aditivos, opcionales).
    const addedSinceLegacy = ['gymDisabled', 'chores', 'choreDays', 'choreSettings'];
    expect([...APP_STATE_FIELDS].sort()).toEqual([...legacyKeys, ...addedSinceLegacy].sort());
  });
});

describe('APP_STATE_TO_COLLECTION', () => {
  it('asigna cada campo de AppState a una colección válida (exhaustivo)', () => {
    for (const field of APP_STATE_FIELDS) {
      const collection = APP_STATE_TO_COLLECTION[field];
      expect(collection, `falta mapeo para "${field}"`).toBeDefined();
      expect(COLLECTIONS).toContain(collection);
    }
  });

  it('no tiene entradas sobrantes que no existan en AppState', () => {
    expect(Object.keys(APP_STATE_TO_COLLECTION).sort()).toEqual([...APP_STATE_FIELDS].sort());
  });

  it('reproduce el mapa pactado en PLAN_BACKEND.md', () => {
    expect(APP_STATE_TO_COLLECTION).toEqual({
      studentName: 'profile',
      career: 'profile',
      currentAcademicWeek: 'profile',
      streak: 'profile',
      theme: 'profile',
      kanbanItems: 'kanban',
      universityAssignments: 'university',
      weeklyReflections: 'learning',
      gymRoutines: 'gym',
      gymProfile: 'gym',
      weightHistory: 'gym',
      gymAttendanceLogs: 'gym',
      dismissedGymScheduleAlerts: 'gym',
      gymDisabled: 'gym',
      calendarBlocks: 'calendar',
      workShift: 'calendar',
      dailyHabits: 'calendar',
      chores: 'calendar',
      choreDays: 'calendar',
      choreSettings: 'calendar',
    });
  });

  it('toda colección tiene al menos un campo de AppState', () => {
    const used = new Set(Object.values(APP_STATE_TO_COLLECTION));
    for (const c of COLLECTIONS) expect(used.has(c)).toBe(true);
  });
});
