import { PROFILE_RECORD_ID, ProfileSchema, SyncRecordSchema, type SyncRecord } from '@student-os/shared';
import { describe, expect, it } from 'vitest';
import { initialData } from '../../../data/initialData';
import type { AppState } from '../../../types';
import { createDevice, FakeServer, EMPTY_STATE } from '../../__tests__/helpers';
import { profileAdapter, PROFILE_SYNC_THEME } from '../profile';

const T = '2026-11-13T10:00:00.000Z';
const BASE: AppState = { ...initialData, studentName: 'Ana', career: 'Derecho', currentAcademicWeek: 3, streak: 4, theme: 'light' };

const rec = (data: unknown, deletedAt: string | null = null): SyncRecord => ({
  id: PROFILE_RECORD_ID,
  collection: 'profile',
  data,
  updatedAt: T,
  deletedAt,
  rev: 1,
});

describe('profileAdapter.select', () => {
  it('emite un unico singleton que cumple el contrato', () => {
    const records = profileAdapter.select(BASE);
    expect(records).toHaveLength(1);
    expect(records[0].id).toBe(PROFILE_RECORD_ID);
    expect(ProfileSchema.safeParse(records[0].data).success).toBe(true);
    expect(SyncRecordSchema.safeParse({ ...records[0], collection: 'profile', updatedAt: T, deletedAt: null, rev: 0 }).success).toBe(true);
    expect(records[0].data).toMatchObject({ studentName: 'Ana', career: 'Derecho', currentAcademicWeek: 3, streak: 4 });
  });

  it('theme es por dispositivo: alternarlo NO cambia el registro (sin push ni eco)', () => {
    const dark = profileAdapter.select({ ...BASE, theme: 'dark' });
    const light = profileAdapter.select({ ...BASE, theme: 'light' });
    expect(dark).toEqual(light);
    expect((dark[0].data as { theme: string }).theme).toBe(PROFILE_SYNC_THEME);
  });
});

describe('profileAdapter.apply', () => {
  const remote = { studentName: 'Luis', career: 'Medicina', currentAcademicWeek: 9, streak: 20, theme: 'dark' };

  it('round-trip: aplica los 4 escalares y CONSERVA el theme local', () => {
    const source: AppState = { ...BASE, studentName: 'Luis', career: 'Medicina', currentAcademicWeek: 9, streak: 20, theme: 'dark' };
    const [r] = profileAdapter.select(source);
    const next = profileAdapter.apply({ ...BASE, theme: 'light' }, [rec(r.data)]);
    expect(next).toMatchObject({ studentName: 'Luis', career: 'Medicina', currentAcademicWeek: 9, streak: 20, theme: 'light' });
  });

  it('un theme remoto distinto nunca cambia el local', () => {
    const next = profileAdapter.apply({ ...BASE, theme: 'light' }, [rec({ ...remote, theme: 'dark' })]);
    expect(next.theme).toBe('light');
  });

  it('es inmutable e idempotente; misma referencia sin cambios', () => {
    const state = Object.freeze({ ...BASE });
    const once = profileAdapter.apply(state, [rec(remote)]);
    expect(once).not.toBe(state);
    expect(state.studentName).toBe('Ana');
    const twice = profileAdapter.apply(once, [rec(remote)]);
    expect(twice).toBe(once);
    expect(profileAdapter.apply(state, [])).toBe(state);
  });

  it('un tombstone no vacia el perfil', () => {
    const state: AppState = { ...BASE };
    expect(profileAdapter.apply(state, [rec(null, T)])).toBe(state);
  });

  it('datos invalidos no rompen el estado', () => {
    const state: AppState = { ...BASE };
    const bad: SyncRecord[] = [
      rec(null),
      rec('x'),
      rec({ studentName: 'Luis' }),
      rec({ ...remote, streak: -1 }),
      rec({ ...remote, currentAcademicWeek: 2.5 }),
      rec({ ...remote, currentAcademicWeek: Number.NaN }),
      rec({ ...remote, theme: 'rojo' }),
      { ...rec(remote), id: 'otro' },
      { ...rec(remote), collection: 'kanban' as const },
    ];
    let next = state;
    expect(() => {
      next = profileAdapter.apply(state, bad);
    }).not.toThrow();
    expect(next).toBe(state);
  });
});

describe('profileAdapter con el motor de sync', () => {
  it('el perfil converge entre dispositivos y cambiar el tema no produce push ni parpadeo en el otro', async () => {
    const server = new FakeServer();
    const clock = { t: Date.parse('2026-11-13T10:00:00Z') };
    const now = () => clock.t;
    const a = createDevice({ server, now, initial: EMPTY_STATE, adapters: [profileAdapter] });
    const b = createDevice({ server, now, initial: EMPTY_STATE, adapters: [profileAdapter] });
    await a.start();
    await b.start();

    clock.t += 1000;
    a.edit((s) => ({ ...s, studentName: 'Marta', streak: 13 }));
    await a.engine.syncNow();
    await b.engine.syncNow();
    expect(b.holder.current.studentName).toBe('Marta');
    expect(b.holder.current.streak).toBe(13);

    const pushes = server.pushCount;
    clock.t += 1000;
    a.edit((s) => ({ ...s, theme: s.theme === 'dark' ? 'light' : 'dark' }));
    await a.engine.syncNow();
    await b.engine.syncNow();
    expect(server.pushCount).toBe(pushes);
    expect(b.holder.current.theme).toBe(EMPTY_STATE.theme);
    expect(a.holder.current.theme).not.toBe(EMPTY_STATE.theme);

    // sin eco tras converger
    await a.engine.syncNow();
    await b.engine.syncNow();
    expect(server.pushCount).toBe(pushes);
  });
});
