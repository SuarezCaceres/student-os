import { describe, expect, it } from 'vitest';
import {
  COLLECTIONS,
  COLLECTION_DATA_SCHEMA,
  DAILY_HABITS_RECORD_ID,
  GYM_PROFILE_RECORD_ID,
  MAX_PUSH_CHANGES,
  PROFILE_RECORD_ID,
  SyncPullQuerySchema,
  SyncPullResponseSchema,
  SyncPushRequestSchema,
  SyncPushResponseSchema,
  SyncRecordSchema,
  WORK_SHIFT_RECORD_ID,
  dismissedAlertRecordId,
  validateRecordData,
  weeklyReflectionRecordId,
  weightEntryRecordId,
} from '../src';
import type { Collection, SyncRecord } from '../src';
import { initialData } from './fixtures/initialData.fixture';

const NOW = '2026-11-13T12:00:00.000Z';

function record(collection: Collection, id: string, data: unknown, extra: Partial<SyncRecord> = {}): SyncRecord {
  return { id, collection, data, updatedAt: NOW, deletedAt: null, rev: 1, ...extra };
}

/** Un registro válido por colección, construido a partir de initialData real. */
const samples: Record<Collection, SyncRecord[]> = {
  profile: [
    record('profile', PROFILE_RECORD_ID, {
      studentName: initialData.studentName,
      career: initialData.career,
      currentAcademicWeek: initialData.currentAcademicWeek,
      streak: initialData.streak,
      theme: initialData.theme,
    }),
  ],
  kanban: initialData.kanbanItems.map((k) => record('kanban', k.id, k)),
  university: initialData.universityAssignments.map((u) => record('university', u.id, u)),
  learning: Object.values(initialData.weeklyReflections!).map((r) =>
    record('learning', weeklyReflectionRecordId(r.week), r),
  ),
  gym: [
    ...initialData.gymRoutines.map((r) => record('gym', r.id, { kind: 'routine', value: r })),
    record('gym', GYM_PROFILE_RECORD_ID, {
      kind: 'profile',
      value: {
        gymType: 'casa',
        trainingDaysCount: 3,
        selectedDays: ['Lunes', 'Miércoles', 'Viernes'],
        goal: 'salud',
        experience: 'principiante',
        heightCm: 170,
        weightKg: 68,
        bmi: 23.5,
        bmiCategory: 'normal',
        configuredAt: NOW,
      },
    }),
    record('gym', weightEntryRecordId('2026-11-13'), {
      kind: 'weightEntry',
      value: { date: '2026-11-13', weightKg: 68, bmi: 23.5 },
    }),
    record('gym', 'log-1', {
      kind: 'attendanceLog',
      value: {
        id: 'log-1',
        date: '2026-11-13',
        dayOfWeek: 'Viernes',
        routineId: 'gym-fri',
        routineName: 'Torso',
        status: 'completed',
      },
    }),
    record('gym', dismissedAlertRecordId('2026-11-10'), { kind: 'dismissedAlert', value: '2026-11-10' }),
  ],
  calendar: [
    ...initialData.calendarBlocks.map((b) => record('calendar', b.id, { kind: 'block', value: b })),
    record('calendar', WORK_SHIFT_RECORD_ID, {
      kind: 'workShift',
      value: { enabled: true, title: 'Turno', startTime: '22:00', endTime: '06:00', restDay: null },
    }),
    record('calendar', DAILY_HABITS_RECORD_ID, {
      kind: 'dailyHabits',
      value: {
        waterMl: 0,
        targetWaterMl: 2500,
        sleepHours: 0,
        targetSleepHours: 8,
        pomodorosDone: 0,
        targetPomodoros: 6,
      },
    }),
  ],
};

describe('SyncRecord: round-trip por colección', () => {
  it('COLLECTIONS y COLLECTION_DATA_SCHEMA cubren las mismas colecciones', () => {
    expect(Object.keys(COLLECTION_DATA_SCHEMA).sort()).toEqual([...COLLECTIONS].sort());
  });

  for (const collection of COLLECTIONS) {
    it(`${collection}: parse + JSON + parse conserva todos los registros`, () => {
      expect(samples[collection].length).toBeGreaterThan(0);
      for (const rec of samples[collection]) {
        const parsed = SyncRecordSchema.parse(rec);
        const wire = JSON.parse(JSON.stringify(parsed));
        const again = SyncRecordSchema.parse(wire);
        expect(again).toEqual(rec);
        expect(validateRecordData(collection, rec.data).success).toBe(true);
      }
    });
  }

  it('acepta ids legacy no-UUID (cb-1) y UUID', () => {
    const uuid = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
    const block = initialData.calendarBlocks[0]!;
    expect(SyncRecordSchema.safeParse(record('calendar', 'cb-1', { kind: 'block', value: block })).success).toBe(true);
    expect(SyncRecordSchema.safeParse(record('calendar', uuid, { kind: 'block', value: block })).success).toBe(true);
  });

  it('acepta offsets horarios en updatedAt', () => {
    const rec = { ...samples.profile[0]!, updatedAt: '2026-11-13T07:00:00-05:00' };
    expect(SyncRecordSchema.safeParse(rec).success).toBe(true);
  });

  it('un tombstone (deletedAt) admite data null sin validarla', () => {
    const tomb = record('kanban', 'k1', null, { deletedAt: NOW, rev: 2 });
    expect(SyncRecordSchema.safeParse(tomb).success).toBe(true);
  });
});

describe('SyncRecord: rechazo de datos inválidos', () => {
  const kanban = samples.kanban[0]!;

  it('rechaza id vacío', () => {
    expect(SyncRecordSchema.safeParse({ ...kanban, id: '' }).success).toBe(false);
  });

  it('rechaza colección desconocida', () => {
    expect(SyncRecordSchema.safeParse({ ...kanban, collection: 'finanzas' }).success).toBe(false);
  });

  it('rechaza updatedAt / deletedAt que no son ISO', () => {
    expect(SyncRecordSchema.safeParse({ ...kanban, updatedAt: 'ayer' }).success).toBe(false);
    expect(SyncRecordSchema.safeParse({ ...kanban, deletedAt: '2026-11-13' }).success).toBe(false);
  });

  it('rechaza rev negativo, decimal o ausente', () => {
    expect(SyncRecordSchema.safeParse({ ...kanban, rev: -1 }).success).toBe(false);
    expect(SyncRecordSchema.safeParse({ ...kanban, rev: 1.5 }).success).toBe(false);
    const { rev: _rev, ...withoutRev } = kanban;
    expect(SyncRecordSchema.safeParse(withoutRev).success).toBe(false);
  });

  it('rechaza data que no corresponde a la colección', () => {
    // data de university en colección kanban
    const wrong = record('kanban', 'uni-1', samples.university[0]!.data);
    expect(SyncRecordSchema.safeParse(wrong).success).toBe(false);
  });

  it('rechaza enums/uniones literales inválidos con ruta bajo data', () => {
    const bad = record('kanban', 'k1', { ...(kanban.data as object), status: 'blocked' });
    const result = SyncRecordSchema.safeParse(bad);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'data' && i.path[1] === 'status')).toBe(true);
    }
  });

  it('rechaza `kind` desconocido y falta de `kind` en gym/calendar', () => {
    expect(SyncRecordSchema.safeParse(record('gym', 'x', { kind: 'unknown', value: {} })).success).toBe(false);
    expect(SyncRecordSchema.safeParse(record('calendar', 'x', initialData.calendarBlocks[0])).success).toBe(false);
  });

  it('rechaza duración de sesión de gym fuera de 60|90|120', () => {
    const profile = (samples.gym.find((r) => (r.data as { kind: string }).kind === 'profile')!.data as {
      value: object;
    }).value;
    const bad = record('gym', GYM_PROFILE_RECORD_ID, { kind: 'profile', value: { ...profile, defaultSessionMinutes: 75 } });
    expect(SyncRecordSchema.safeParse(bad).success).toBe(false);
  });

  it('rechaza data indefinida / de tipo primitivo en registros vivos', () => {
    expect(SyncRecordSchema.safeParse(record('profile', 'profile', undefined)).success).toBe(false);
    expect(SyncRecordSchema.safeParse(record('profile', 'profile', 'hola')).success).toBe(false);
  });

  it('rechaza un perfil con theme inválido', () => {
    const bad = record('profile', PROFILE_RECORD_ID, { ...(samples.profile[0]!.data as object), theme: 'azul' });
    expect(SyncRecordSchema.safeParse(bad).success).toBe(false);
  });
});

describe('mensajes del protocolo', () => {
  it('SyncPullQuery: since opcional, cursor no vacío, limit coaccionado', () => {
    expect(SyncPullQuerySchema.parse({})).toEqual({});
    expect(SyncPullQuerySchema.parse({ since: 'abc', limit: '50' })).toEqual({ since: 'abc', limit: 50 });
    expect(SyncPullQuerySchema.safeParse({ since: '' }).success).toBe(false);
    expect(SyncPullQuerySchema.safeParse({ limit: '0' }).success).toBe(false);
  });

  it('SyncPullResponse: round-trip y hasMore por defecto false', () => {
    const res = SyncPullResponseSchema.parse({ records: samples.kanban, cursor: 'c1' });
    expect(res.hasMore).toBe(false);
    expect(res.records).toEqual(samples.kanban);
    expect(SyncPullResponseSchema.safeParse({ records: [{ nope: 1 }], cursor: 'c1' }).success).toBe(false);
  });

  it('SyncPushRequest: round-trip con todas las colecciones y límite de tamaño', () => {
    const changes = COLLECTIONS.flatMap((c) => samples[c]);
    const req = SyncPushRequestSchema.parse(JSON.parse(JSON.stringify({ changes })));
    expect(req.changes).toEqual(changes);

    const tooMany = Array.from({ length: MAX_PUSH_CHANGES + 1 }, () => samples.profile[0]!);
    expect(SyncPushRequestSchema.safeParse({ changes: tooMany }).success).toBe(false);
  });

  it('SyncPushResponse: applied (ids) y conflicts (registros del servidor)', () => {
    const res = SyncPushResponseSchema.parse({ applied: ['k1', 'k2'], conflicts: [samples.kanban[2]] });
    expect(res.applied).toEqual(['k1', 'k2']);
    expect(res.conflicts).toEqual([samples.kanban[2]]);
    expect(SyncPushResponseSchema.safeParse({ applied: [''], conflicts: [] }).success).toBe(false);
  });
});
