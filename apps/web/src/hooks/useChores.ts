import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { AppState, Chore, ChoreDay, ChoreHardReason, ChoreLevel, DayOfWeek } from '../types';
import {
  addChore,
  buildChoreSeed,
  closeChoreDay,
  computeWeekdayStats,
  getTodayIso,
  isChoreCompletedOn,
  msUntilNextLocalMidnight,
  needsChoreSeed,
  normalizeChoreLevels,
  removeChore,
  sanitizeChoreDays,
  sanitizeChoreLevels,
  sanitizeChores,
  setChoreCompleted,
  setHardDay,
  sortChores,
  sortLevels,
  summarizeChoreDay,
  updateChore,
  MAX_CHORES,
  type ChoreDaySummary,
  type ChoreEditResult,
  type WeekdayStats,
} from '../utils/chores';

/**
 * Estado y acciones de los quehaceres diarios (spec 012). Es la API que consume la UI (`ChoresCard`, editor y grafica):
 * la logica vive en `utils/chores.ts` y aqui solo se conecta con `AppState`, la siembra y el cambio de dia.
 *
 * - Siembra: si nunca se creo `choreSettings`, siembra la lista base. Espera a `syncReady` (primera sincronizacion con la
 *   nube terminada) para no sembrar encima de lo que ya tiene la cuenta en otro dispositivo.
 * - Solo se edita HOY (`today`): el historial anterior es de solo lectura.
 * - Cambio de dia: un temporizador a la proxima medianoche local (y al volver a la pestana) actualiza `today` sin recargar y
 *   cierra el dia anterior.
 */

export interface UseChoresOptions {
  /** `true` cuando ya se puede sembrar la lista base (sync desactivada o primera sincronizacion terminada). */
  syncReady: boolean;
}

export interface UseChoresResult {
  /** `true` cuando la lista base ya existe (hay ajustes). Antes de eso la tarjeta debe mostrar un estado de carga. */
  ready: boolean;
  /** Fecha local de hoy `AAAA-MM-DD`; cambia sola a medianoche. */
  today: string;
  /** Resumen de hoy: aplicables, contador, nivel, meta, mensaje y dia dificil (C1, C3-C9). */
  summary: ChoreDaySummary;
  /** Todos los quehaceres (cualquier dia), ordenados, para el editor (C2, C3). */
  chores: Chore[];
  /** Niveles de motivacion ordenados por cantidad (C5, C6). */
  levels: ChoreLevel[];
  /** Historial guardado (solo lectura), del mas reciente al mas antiguo. */
  history: ChoreDay[];
  /** Promedio por dia de la semana de las ultimas 8 semanas, sin dias dificiles (C12, C13). */
  stats: WeekdayStats;
  /** Aun se pueden anadir quehaceres (maximo 30). */
  canAdd: boolean;
  /** Marca o desmarca un quehacer de hoy. Idempotente. */
  setDone: (choreId: string, done: boolean) => void;
  /** Invierte el estado de hoy de un quehacer. */
  toggle: (choreId: string) => void;
  /** «Hoy no puedo»: marca el dia dificil (motivo opcional) sin tocar lo ya marcado. */
  markHardDay: (reason?: ChoreHardReason) => void;
  /** Deshace «hoy no puedo» y conserva lo marcado. */
  undoHardDay: () => void;
  /** Anade un quehacer (todos los dias por defecto). Devuelve el error de validacion si lo hay. */
  add: (name: string, days?: ReadonlyArray<DayOfWeek>) => ChoreEditResult<Chore>;
  /** Renombra un quehacer; el historial conserva el nombre antiguo. */
  rename: (choreId: string, name: string) => ChoreEditResult<Chore>;
  /** Cambia los dias de la semana en que aplica un quehacer. */
  setDays: (choreId: string, days: ReadonlyArray<DayOfWeek>) => ChoreEditResult<Chore>;
  /** Elimina un quehacer; lo ya completado en el historial se conserva. */
  remove: (choreId: string) => ChoreEditResult<null>;
  /** Cambia los umbrales y mensajes de motivacion (se validan y ordenan). */
  setLevels: (levels: ReadonlyArray<ChoreLevel>) => ChoreEditResult<ChoreLevel[]>;
}

export function useChores(
  state: AppState,
  setState: Dispatch<SetStateAction<AppState>>,
  { syncReady }: UseChoresOptions,
): UseChoresResult {
  const [today, setToday] = useState<string>(() => getTodayIso());
  const todayRef = useRef(today);

  // Ultimo estado visto: las acciones validan contra el y devuelven el resultado de forma sincrona.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // --- Siembra de la lista base (una sola vez por cuenta) ---
  const seedPending = needsChoreSeed(state);
  useEffect(() => {
    if (!syncReady || !seedPending) return;
    setState((prev) => {
      if (!needsChoreSeed(prev)) return prev;
      const seed = buildChoreSeed();
      return {
        ...prev,
        chores: prev.chores && prev.chores.length > 0 ? prev.chores : seed.chores,
        choreSettings: seed.choreSettings,
      };
    });
  }, [syncReady, seedPending, setState]);

  // --- Cambio de dia (medianoche local) ---
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const rollover = () => {
      const current = getTodayIso();
      const previous = todayRef.current;
      if (current !== previous) {
        todayRef.current = current;
        // El dia que termina queda guardado tal como estaba; solo se normaliza (sin inventar marcas).
        setState((prev) => {
          const days = sanitizeChoreDays(prev.choreDays);
          const closed = closeChoreDay(days, previous);
          return closed === days ? prev : { ...prev, choreDays: closed };
        });
        setToday(current);
      }
      schedule();
    };
    const schedule = () => {
      if (timer !== undefined) clearTimeout(timer);
      // +50 ms para caer siempre despues de la medianoche, no justo antes.
      timer = setTimeout(rollover, msUntilNextLocalMidnight() + 50);
    };
    const onVisible = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') rollover();
    };
    schedule();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', rollover);
    return () => {
      if (timer !== undefined) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', rollover);
    };
  }, [setState]);

  // --- Datos derivados ---
  // Todo lo que se lee pasa por los esquemas compartidos: una entrada dañada se descarta y no rompe el resumen.
  const { chores: storedChores, choreDays: storedDays, choreSettings } = state;
  const rawChores = useMemo(() => sanitizeChores(storedChores), [storedChores]);
  const choreDays = useMemo(() => sanitizeChoreDays(storedDays), [storedDays]);
  const validLevels = useMemo(() => sanitizeChoreLevels(choreSettings?.levels), [choreSettings]);
  const summary = useMemo(
    () => summarizeChoreDay({ chores: rawChores, choreDays, choreSettings: { seeded: true, levels: validLevels } }, today),
    [rawChores, choreDays, validLevels, today],
  );
  const chores = useMemo(() => sortChores(rawChores), [rawChores]);
  const levels = useMemo(() => sortLevels(validLevels), [validLevels]);
  const history = useMemo(() => [...choreDays].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)), [choreDays]);
  const stats = useMemo(() => computeWeekdayStats({ chores: rawChores, choreDays }, today), [rawChores, choreDays, today]);

  // --- Acciones ---
  const setDone = useCallback(
    (choreId: string, done: boolean) => {
      setState((prev) => {
        const chore = sanitizeChores(prev.chores).find((c) => c.id === choreId);
        if (!chore) return prev;
        const days = sanitizeChoreDays(prev.choreDays);
        const next = setChoreCompleted(days, chore, todayRef.current, done);
        return next === days ? prev : { ...prev, choreDays: next };
      });
    },
    [setState],
  );

  const toggle = useCallback(
    (choreId: string) => {
      setDone(choreId, !isChoreCompletedOn(sanitizeChoreDays(stateRef.current.choreDays), choreId, todayRef.current));
    },
    [setDone],
  );

  const markHardDay = useCallback(
    (reason?: ChoreHardReason) => {
      setState((prev) => {
        const days = sanitizeChoreDays(prev.choreDays);
        const next = setHardDay(days, todayRef.current, true, reason);
        return next === days ? prev : { ...prev, choreDays: next };
      });
    },
    [setState],
  );

  const undoHardDay = useCallback(() => {
    setState((prev) => {
      const days = sanitizeChoreDays(prev.choreDays);
      const next = setHardDay(days, todayRef.current, false);
      return next === days ? prev : { ...prev, choreDays: next };
    });
  }, [setState]);

  const add = useCallback(
    (name: string, days?: ReadonlyArray<DayOfWeek>): ChoreEditResult<Chore> => {
      const attempt = addChore(sanitizeChores(stateRef.current.chores), name, days);
      if (!attempt.ok) return attempt;
      const created = attempt.value[attempt.value.length - 1];
      setState((prev) => {
        const result = addChore(sanitizeChores(prev.chores), name, days, created.id);
        return result.ok ? { ...prev, chores: result.value } : prev;
      });
      return { ok: true, value: created };
    },
    [setState],
  );

  const edit = useCallback(
    (choreId: string, changes: { name?: string; days?: ReadonlyArray<DayOfWeek> }): ChoreEditResult<Chore> => {
      const attempt = updateChore(sanitizeChores(stateRef.current.chores), choreId, changes);
      if (!attempt.ok) return attempt;
      setState((prev) => {
        const result = updateChore(sanitizeChores(prev.chores), choreId, changes);
        return result.ok ? { ...prev, chores: result.value } : prev;
      });
      return { ok: true, value: attempt.value.find((c) => c.id === choreId)! };
    },
    [setState],
  );

  const rename = useCallback((choreId: string, name: string) => edit(choreId, { name }), [edit]);
  const setDays = useCallback((choreId: string, days: ReadonlyArray<DayOfWeek>) => edit(choreId, { days }), [edit]);

  const remove = useCallback(
    (choreId: string): ChoreEditResult<null> => {
      const attempt = removeChore(sanitizeChores(stateRef.current.chores), choreId);
      if (!attempt.ok) return attempt;
      setState((prev) => {
        const result = removeChore(sanitizeChores(prev.chores), choreId);
        return result.ok ? { ...prev, chores: result.value } : prev;
      });
      return { ok: true, value: null };
    },
    [setState],
  );

  const setLevels = useCallback(
    (next: ReadonlyArray<ChoreLevel>): ChoreEditResult<ChoreLevel[]> => {
      const normalized = normalizeChoreLevels(next);
      if (!normalized.ok) return normalized;
      setState((prev) => ({
        ...prev,
        choreSettings: { seeded: true, ...prev.choreSettings, levels: normalized.value },
      }));
      return normalized;
    },
    [setState],
  );

  return {
    ready: state.choreSettings !== undefined,
    today,
    summary,
    chores,
    levels,
    history,
    stats,
    canAdd: rawChores.length < MAX_CHORES,
    setDone,
    toggle,
    markHardDay,
    undoHardDay,
    add,
    rename,
    setDays,
    remove,
    setLevels,
  };
}
