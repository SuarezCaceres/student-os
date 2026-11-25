// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initialData } from '../data/initialData';
import type { AppState } from '../types';
import { useChores } from './useChores';

const BLANK: AppState = { ...initialData, chores: undefined, choreDays: undefined, choreSettings: undefined };

/** Equivale a lo que hace App: estado en un `useState` + `useChores` encima. */
function setup(initial: AppState = BLANK, syncReady = true) {
  return renderHook(
    ({ ready }: { ready: boolean }) => {
      const [state, setState] = useState<AppState>(initial);
      const chores = useChores(state, setState, { syncReady: ready });
      return { state, chores };
    },
    { initialProps: { ready: syncReady } },
  );
}

describe('useChores', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 23, 10, 0, 0)); // lunes 23-nov-2026, 10:00 local
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  describe('siembra de la lista base (C1)', () => {
    it('siembra los cinco quehaceres y los niveles 5 y 10 cuando la sync ya termino', () => {
      const { result } = setup();
      expect(result.current.chores.chores.map((c) => c.id)).toEqual([
        'chore-base-1',
        'chore-base-2',
        'chore-base-3',
        'chore-base-4',
        'chore-base-5',
      ]);
      expect(result.current.chores.ready).toBe(true);
      expect(result.current.chores.levels.map((l) => l.min)).toEqual([5, 10]);
      expect(result.current.chores.summary.items.every((i) => !i.done)).toBe(true);
      expect(result.current.chores.summary.applicableCount).toBe(5);
      expect(result.current.state.choreSettings?.seeded).toBe(true);
    });

    it('no siembra mientras la primera sincronizacion no termino, y siembra al terminar', () => {
      const { result, rerender } = setup(BLANK, false);
      expect(result.current.chores.ready).toBe(false);
      expect(result.current.state.chores).toBeUndefined();
      rerender({ ready: true });
      expect(result.current.chores.ready).toBe(true);
      expect(result.current.state.chores).toHaveLength(5);
    });

    it('no siembra si la cuenta ya trae ajustes (p. ej. de otro dispositivo)', () => {
      const existing: AppState = {
        ...BLANK,
        chores: [{ id: 'c-otro', name: 'Solo este', days: ['Lunes'], order: 0 }],
        choreSettings: { seeded: true, levels: [{ min: 2, message: 'Hola' }] },
      };
      const { result } = setup(existing);
      expect(result.current.state.chores).toEqual(existing.chores);
      expect(result.current.chores.levels).toEqual([{ min: 2, message: 'Hola' }]);
    });

    it('si el usuario borra todos los quehaceres no se vuelve a sembrar', () => {
      const { result } = setup();
      for (const chore of [...result.current.chores.chores]) act(() => void result.current.chores.remove(chore.id));
      expect(result.current.state.chores).toEqual([]);
      expect(result.current.chores.summary.status).toBe('none');
      expect(result.current.chores.stats.hasEnoughData).toBe(false);
    });
  });

  describe('marcar, dia dificil y niveles', () => {
    it('marca y desmarca sin duplicar y actualiza el contador (C4)', () => {
      const { result } = setup();
      act(() => result.current.chores.setDone('chore-base-1', true));
      act(() => result.current.chores.setDone('chore-base-1', true));
      expect(result.current.chores.summary.completedCount).toBe(1);
      expect(result.current.state.choreDays?.[0].completed).toEqual([{ choreId: 'chore-base-1', name: 'Tender la cama' }]);
      act(() => result.current.chores.toggle('chore-base-1'));
      expect(result.current.chores.summary.completedCount).toBe(0);
      act(() => result.current.chores.toggle('chore-base-2'));
      expect(result.current.chores.summary.items[1].done).toBe(true);
    });

    it('ignora marcar un quehacer que no existe', () => {
      const { result } = setup();
      const before = result.current.state;
      act(() => result.current.chores.setDone('no-existe', true));
      expect(result.current.state).toBe(before);
    });

    it('con 5 completados muestra «¡Eres lo máximo!» (C5)', () => {
      const { result } = setup();
      for (const chore of result.current.chores.chores) act(() => result.current.chores.setDone(chore.id, true));
      expect(result.current.chores.summary.message).toBe('¡Eres lo máximo!');
    });

    it('«hoy no puedo» y deshacer conservan lo ya marcado (C8, C9)', () => {
      const { result } = setup();
      act(() => result.current.chores.setDone('chore-base-1', true));
      act(() => result.current.chores.markHardDay('cansado'));
      expect(result.current.chores.summary).toMatchObject({ hard: true, status: 'hard', reason: 'cansado', completedCount: 1 });
      act(() => result.current.chores.undoHardDay());
      expect(result.current.chores.summary).toMatchObject({ hard: false, completedCount: 1 });
      expect(result.current.state.choreDays?.[0].reason).toBeUndefined();
    });

    it('cambiar umbrales y mensajes los guarda y los aplica (C6) y rechaza los invalidos', () => {
      const { result } = setup();
      let outcome: ReturnType<typeof result.current.chores.setLevels> | undefined;
      act(() => {
        outcome = result.current.chores.setLevels([
          { min: 2, message: 'Dos y vamos' },
          { min: 1, message: 'Primero' },
        ]);
      });
      expect(outcome).toEqual({
        ok: true,
        value: [
          { min: 1, message: 'Primero' },
          { min: 2, message: 'Dos y vamos' },
        ],
      });
      act(() => result.current.chores.setDone('chore-base-1', true));
      expect(result.current.chores.summary.message).toBe('Primero');
      act(() => result.current.chores.setDone('chore-base-2', true));
      expect(result.current.chores.summary.message).toBe('Dos y vamos');

      const before = result.current.state;
      act(() => {
        outcome = result.current.chores.setLevels([{ min: 0, message: 'x' }]);
      });
      expect(outcome).toEqual({ ok: false, error: 'invalid-levels' });
      expect(result.current.state).toBe(before);
    });
  });

  describe('editar la lista (C2, C3, C11)', () => {
    it('anade, renombra, cambia dias y elimina; el historial conserva el nombre', () => {
      const { result } = setup();
      let added: ReturnType<typeof result.current.chores.add> | undefined;
      act(() => {
        added = result.current.chores.add('  Ir al mercado ', ['Sábado']);
      });
      expect(added?.ok).toBe(true);
      const id = added?.ok ? added.value.id : '';
      expect(result.current.state.chores?.find((c) => c.id === id)).toMatchObject({ name: 'Ir al mercado', days: ['Sábado'], order: 5 });
      // hoy es lunes: no aplica ni cuenta
      expect(result.current.chores.summary.applicableCount).toBe(5);

      act(() => void result.current.chores.setDays(id, ['Lunes']));
      expect(result.current.chores.summary.applicableCount).toBe(6);
      act(() => result.current.chores.setDone(id, true));
      act(() => void result.current.chores.rename(id, 'Mercado'));
      expect(result.current.state.chores?.find((c) => c.id === id)?.name).toBe('Mercado');
      expect(result.current.state.choreDays?.[0].completed[0]).toEqual({ choreId: id, name: 'Ir al mercado' });

      act(() => void result.current.chores.remove(id));
      expect(result.current.state.chores?.some((c) => c.id === id)).toBe(false);
      expect(result.current.chores.summary.completedCount).toBe(1); // lo completado hoy no se pierde
      expect(result.current.state.choreDays?.[0].completed[0].name).toBe('Ir al mercado');
    });

    it('devuelve errores de validacion sin tocar el estado', () => {
      const { result } = setup();
      const before = result.current.state;
      let outcomes: unknown[] = [];
      act(() => {
        outcomes = [
          result.current.chores.add('   '),
          result.current.chores.add('x'.repeat(81)),
          result.current.chores.rename('chore-base-1', ''),
          result.current.chores.setDays('chore-base-1', []),
          result.current.chores.rename('no-existe', 'A'),
          result.current.chores.remove('no-existe'),
        ];
      });
      expect(outcomes).toEqual([
        { ok: false, error: 'empty' },
        { ok: false, error: 'too-long' },
        { ok: false, error: 'empty' },
        { ok: false, error: 'no-days' },
        { ok: false, error: 'not-found' },
        { ok: false, error: 'not-found' },
      ]);
      expect(result.current.state).toBe(before);
    });

    it('respeta el maximo de 30 quehaceres', () => {
      const { result } = setup();
      for (let i = 0; i < 25; i += 1) act(() => void result.current.chores.add(`Extra ${i}`));
      expect(result.current.state.chores).toHaveLength(30);
      expect(result.current.chores.canAdd).toBe(false);
      let outcome: ReturnType<typeof result.current.chores.add> | undefined;
      act(() => {
        outcome = result.current.chores.add('Uno mas');
      });
      expect(outcome).toEqual({ ok: false, error: 'limit' });
      expect(result.current.state.chores).toHaveLength(30);
    });
  });

  describe('cambio de dia (C10)', () => {
    it('a medianoche local la tarjeta pasa al dia nuevo sin recargar y el anterior queda guardado', () => {
      vi.setSystemTime(new Date(2026, 10, 23, 23, 59, 30));
      const { result } = setup();
      expect(result.current.chores.today).toBe('2026-11-23');
      act(() => result.current.chores.setDone('chore-base-1', true));
      act(() => result.current.chores.setDone('chore-base-2', true));
      expect(result.current.chores.summary.completedCount).toBe(2);

      act(() => {
        vi.advanceTimersByTime(31_000);
      });
      expect(result.current.chores.today).toBe('2026-11-24');
      expect(result.current.chores.summary.completedCount).toBe(0);
      expect(result.current.chores.summary.items.every((i) => !i.done)).toBe(true);
      expect(result.current.chores.history).toEqual([
        {
          date: '2026-11-23',
          completed: [
            { choreId: 'chore-base-1', name: 'Tender la cama' },
            { choreId: 'chore-base-2', name: 'Pasear al perro' },
          ],
          hard: false,
        },
      ]);

      // lo que se marca despues es del dia nuevo
      act(() => result.current.chores.setDone('chore-base-3', true));
      expect(result.current.state.choreDays?.map((d) => d.date).sort()).toEqual(['2026-11-23', '2026-11-24']);
    });

    it('al volver a la pestana tras dormir el equipo, detecta el dia nuevo', () => {
      const { result } = setup();
      expect(result.current.chores.today).toBe('2026-11-23');
      vi.setSystemTime(new Date(2026, 10, 25, 8, 0, 0)); // el reloj salta sin que dispare el temporizador
      act(() => {
        window.dispatchEvent(new Event('focus'));
      });
      expect(result.current.chores.today).toBe('2026-11-25');
    });

    it('limpia el temporizador y los listeners al desmontar', () => {
      const { unmount } = setup();
      expect(vi.getTimerCount()).toBeGreaterThan(0);
      unmount();
      expect(vi.getTimerCount()).toBe(0);
    });
  });
  describe('datos dañados (R3)', () => {
    const corrupt = (extra: Record<string, unknown> = {}): AppState =>
      ({
        ...initialData,
        chores: [{ id: 'x' }, { id: 'ok', name: 'Regar plantas', days: ['Lunes'], order: 0 }, null, 'basura'],
        choreDays: [{ date: '2026-11-23' }, { date: '2026-11-22', hard: false, completed: [{ choreId: 'ok', name: 'Regar plantas' }] }, 42],
        choreSettings: { seeded: true, levels: [{ min: 'cinco' }, { min: 3, message: 'Bien' }] },
        ...extra,
      }) as unknown as AppState;

    it('no lanza y descarta las entradas inválidas al leer', () => {
      const { result } = setup(corrupt());
      const c = result.current.chores;
      expect(c.chores.map((chore) => chore.id)).toEqual(['ok']);
      expect(c.history.map((day) => day.date)).toEqual(['2026-11-22']);
      expect(c.levels.map((level) => level.min)).toEqual([3]);
      expect(c.summary.applicableCount).toBe(1);
      expect(c.summary.completedCount).toBe(0);
    });

    it('un registro dañado de hoy no rompe el marcado ni el día difícil', () => {
      const { result } = setup(corrupt());
      act(() => result.current.chores.setDone('ok', true));
      expect(result.current.chores.summary.completedCount).toBe(1);
      act(() => result.current.chores.markHardDay('cansado'));
      expect(result.current.chores.summary.hard).toBe(true);
    });

    it('tolera listas que no son arreglos', () => {
      const { result } = setup(corrupt({ chores: 'roto', choreDays: { a: 1 }, choreSettings: { seeded: true, levels: 'x' } }));
      expect(result.current.chores.chores).toEqual([]);
      expect(result.current.chores.history).toEqual([]);
      expect(result.current.chores.levels).toEqual([]);
    });
  });
});
