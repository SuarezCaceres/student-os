import {
  ChoreDaySchema,
  ChoreLevelSchema,
  ChoreSchema,
  MAX_CHORES,
  MAX_CHORE_LEVELS,
  MAX_CHORE_LEVEL_MESSAGE_LENGTH,
  MAX_CHORE_LEVEL_MIN,
  MAX_CHORE_NAME_LENGTH,
} from '@student-os/shared';
import type { Chore, ChoreDay, ChoreHardReason, ChoreLevel, ChoreSettings, DayOfWeek } from '../types';
import { getLocalIsoDate } from './gymAttendance';
import { ORDERED_DAYS } from './routineGenerator';

/**
 * Logica pura de los quehaceres diarios (spec 012): sin React, sin red y sin leer el reloj por su cuenta.
 * Todo recibe la fecha local `AAAA-MM-DD` ya calculada (`getTodayIso`), asi que se prueba con reloj simulado.
 *
 * Convenciones:
 *  - El orden del arreglo `chores` NO es semantico (el sync aplica por id): se ordena siempre por `order`.
 *  - Un quehacer con `days` vacio no aplica ningun dia (queda "en pausa"); la UI debe exigir al menos un dia.
 *  - Un `ChoreDay` solo existe si pasó algo (algo marcado o dia dificil); un dia sin registro equivale a 0.
 *  - El nombre se COPIA en `completed`: renombrar o borrar un quehacer no cambia el pasado (C11).
 */

export { MAX_CHORES, MAX_CHORE_NAME_LENGTH };

// --- Fechas locales -----------------------------------------------------------------

const WEEKDAY_BY_JS_INDEX: DayOfWeek[] = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

/** Fecha local `AAAA-MM-DD` de `now`. Siempre pasa un `Date` explicito: no depende de `Temporal` ni del reloj global. */
export function getTodayIso(now: Date = new Date()): string {
  return getLocalIsoDate(now);
}

function parseLocalDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** Suma `days` (puede ser negativo) a una fecha local `AAAA-MM-DD`, sin desfases de zona horaria ni de horario de verano. */
export function addDaysIso(iso: string, days: number): string {
  const date = parseLocalDate(iso);
  date.setDate(date.getDate() + days);
  return getLocalIsoDate(date);
}

/** Dia de la semana (`Lunes`..`Domingo`) de una fecha local `AAAA-MM-DD`. */
export function getDayOfWeekForDate(iso: string): DayOfWeek {
  return WEEKDAY_BY_JS_INDEX[parseLocalDate(iso).getDay()];
}

/** Milisegundos hasta la proxima medianoche local (para el temporizador de cambio de dia). Siempre > 0. */
export function msUntilNextLocalMidnight(now: Date = new Date()): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return Math.max(1, next.getTime() - now.getTime());
}

// --- Lista base y niveles por defecto -----------------------------------------------

export const DEFAULT_CHORE_LEVELS: ReadonlyArray<ChoreLevel> = [
  { min: 5, message: '¡Eres lo máximo!' },
  { min: 10, message: '¡Sigue así!' },
];

/** Lista base fijada por el humano (spec 012). Ids deterministas: dos dispositivos nuevos se fusionan, no duplican. */
export const BASE_CHORE_NAMES: ReadonlyArray<string> = [
  'Tender la cama',
  'Pasear al perro',
  'Ducharme',
  'Limpiar mi cuarto',
  'Avanzar en mis proyectos personales de inteligencia artificial',
];

export const ALL_DAYS: ReadonlyArray<DayOfWeek> = ORDERED_DAYS;

export const baseChoreId = (position: number): string => `chore-base-${position}`;

/** Lista base (todos los dias) y ajustes por defecto, ya marcados como sembrados. */
export function buildChoreSeed(): { chores: Chore[]; choreSettings: ChoreSettings } {
  return {
    chores: BASE_CHORE_NAMES.map((name, index) => ({
      id: baseChoreId(index + 1),
      name,
      days: [...ALL_DAYS],
      order: index,
    })),
    choreSettings: { seeded: true, levels: DEFAULT_CHORE_LEVELS.map((level) => ({ ...level })) },
  };
}

/** Hay que sembrar solo si nunca se creo `choreSettings` (si el usuario borra todo, no se vuelve a sembrar). */
export function needsChoreSeed(state: { choreSettings?: ChoreSettings }): boolean {
  return state.choreSettings === undefined;
}

// --- Datos dañados -------------------------------------------------------------------

function keepValid<T>(list: unknown, schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false } }): T[] {
  if (!Array.isArray(list)) return [];
  const valid: T[] = [];
  for (const entry of list) {
    const parsed = schema.safeParse(entry);
    if (parsed.success) valid.push(parsed.data);
  }
  return valid;
}

/** Descarta (sin lanzar) los quehaceres que no cumplen el esquema compartido: datos dañados o de una version futura. */
export function sanitizeChores(chores: unknown): Chore[] {
  return keepValid<Chore>(chores, ChoreSchema);
}

/** Descarta (sin lanzar) los registros de dia que no cumplen el esquema compartido. */
export function sanitizeChoreDays(choreDays: unknown): ChoreDay[] {
  return keepValid<ChoreDay>(choreDays, ChoreDaySchema);
}

/** Descarta (sin lanzar) los niveles de motivacion que no cumplen el esquema compartido. */
export function sanitizeChoreLevels(levels: unknown): ChoreLevel[] {
  return keepValid<ChoreLevel>(levels, ChoreLevelSchema);
}

// --- Consultas: quehaceres de un dia ------------------------------------------------

export function sortChores(chores: ReadonlyArray<Chore>): Chore[] {
  return [...chores].sort((a, b) => a.order - b.order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Quehaceres que aplican a una fecha (por su dia de la semana), en orden. */
export function getChoresForDate(chores: ReadonlyArray<Chore> | undefined, date: string): Chore[] {
  const weekday = getDayOfWeekForDate(date);
  return sortChores((chores ?? []).filter((chore) => chore.days.includes(weekday)));
}

export function findChoreDay(choreDays: ReadonlyArray<ChoreDay> | undefined, date: string): ChoreDay | undefined {
  return (choreDays ?? []).find((day) => day.date === date);
}

export function isChoreCompletedOn(choreDays: ReadonlyArray<ChoreDay> | undefined, choreId: string, date: string): boolean {
  return findChoreDay(choreDays, date)?.completed.some((entry) => entry.choreId === choreId) ?? false;
}

// --- Niveles y mensajes -------------------------------------------------------------

export const ALL_DONE_MESSAGE = '¡Completaste todos los quehaceres de hoy!';
export const HARD_DAY_MESSAGE = 'Hoy es un día difícil y está bien. Descansa, mañana seguimos sin presión.';
export const NO_CHORES_MESSAGE = 'Hoy no tienes quehaceres. Añade uno si quieres.';

export function sortLevels(levels: ReadonlyArray<ChoreLevel>): ChoreLevel[] {
  return [...levels].sort((a, b) => a.min - b.min);
}

/** Nivel mas alto alcanzado con `count` quehaceres completados, o `null` si aun no llega al primero. */
export function getReachedLevel(levels: ReadonlyArray<ChoreLevel>, count: number): ChoreLevel | null {
  let reached: ChoreLevel | null = null;
  for (const level of sortLevels(levels)) {
    if (count >= level.min) reached = level;
  }
  return reached;
}

/** Primer nivel que todavia no se alcanza con `count`, o `null` si ya se alcanzaron todos. */
export function getNextLevel(levels: ReadonlyArray<ChoreLevel>, count: number): ChoreLevel | null {
  return sortLevels(levels).find((level) => count < level.min) ?? null;
}

export type ChoreDayStatus = 'hard' | 'none' | 'level' | 'all-done' | 'progress';

export interface ChoreDayItem {
  chore: Chore;
  done: boolean;
}

export interface ChoreDaySummary {
  date: string;
  dayOfWeek: DayOfWeek;
  /** Quehaceres que aplican a la fecha, con su estado. */
  items: ChoreDayItem[];
  /** Completados en el dia (incluye los de quehaceres que luego se borraron o ya no aplican: no se pierden). */
  completedCount: number;
  applicableCount: number;
  hard: boolean;
  reason?: ChoreHardReason;
  /** Nivel mas alto alcanzado, o `null`. */
  level: ChoreLevel | null;
  /** Siguiente nivel por alcanzar, o `null` si no queda ninguno. */
  nextLevel: ChoreLevel | null;
  /** Meta alcanzable hoy hacia el siguiente nivel: `min(nextLevel.min, applicableCount)`; `null` sin siguiente nivel. */
  goal: number | null;
  /** Cuantos faltan para `goal` (>= 0), o `null`. */
  remaining: number | null;
  /** Todos los quehaceres que aplican hoy estan hechos (y hay al menos uno). */
  allDone: boolean;
  status: ChoreDayStatus;
  /** Mensaje de animo listo para mostrar. En un dia dificil NUNCA habla de meta incumplida (C8). */
  message: string;
}

/** Resumen del dia que alimenta la tarjeta: aplicables, contador, nivel, meta y mensaje (C3-C8). */
export function summarizeChoreDay(
  state: { chores?: ReadonlyArray<Chore>; choreDays?: ReadonlyArray<ChoreDay>; choreSettings?: ChoreSettings },
  date: string,
): ChoreDaySummary {
  const applicable = getChoresForDate(state.chores, date);
  const record = findChoreDay(state.choreDays, date);
  const doneIds = new Set((record?.completed ?? []).map((entry) => entry.choreId));
  const items = applicable.map((chore) => ({ chore, done: doneIds.has(chore.id) }));
  const completedCount = doneIds.size;
  const levels = state.choreSettings?.levels ?? [];
  const level = getReachedLevel(levels, completedCount);
  const nextLevel = getNextLevel(levels, completedCount);
  const allDone = applicable.length > 0 && items.every((item) => item.done);
  const hard = record?.hard ?? false;

  // Con menos quehaceres aplicables que la meta, la meta real es completar todos (C7).
  const goal = nextLevel ? Math.min(nextLevel.min, Math.max(applicable.length, completedCount)) : null;
  const remaining = goal === null ? null : Math.max(0, goal - completedCount);
  const firstMin = sortLevels(levels)[0]?.min;
  const belowFirstGoal = firstMin === undefined || applicable.length < firstMin;

  let status: ChoreDayStatus;
  let message: string;
  if (hard) {
    status = 'hard';
    message = HARD_DAY_MESSAGE;
  } else if (applicable.length === 0 && completedCount === 0) {
    status = 'none';
    message = NO_CHORES_MESSAGE;
  } else if (level) {
    status = 'level';
    message = level.message;
  } else if (allDone && belowFirstGoal) {
    status = 'all-done';
    message = ALL_DONE_MESSAGE;
  } else {
    status = 'progress';
    message = goal === null ? `Llevas ${completedCount}` : `Llevas ${completedCount} de ${goal}`;
  }

  return {
    date,
    dayOfWeek: getDayOfWeekForDate(date),
    items,
    completedCount,
    applicableCount: applicable.length,
    hard,
    reason: record?.reason,
    level,
    nextLevel,
    goal,
    remaining,
    allDone,
    status,
    message,
  };
}

// --- Historial: marcar, dia dificil y cierre ----------------------------------------

/** Quita un registro de dia que quedo sin nada que recordar (ni marcas ni dia dificil). */
function dropIfEmpty(choreDays: ChoreDay[], date: string): ChoreDay[] {
  return choreDays.filter((day) => day.date !== date || day.completed.length > 0 || day.hard);
}

function upsertDay(choreDays: ReadonlyArray<ChoreDay>, next: ChoreDay): ChoreDay[] {
  const exists = choreDays.some((day) => day.date === next.date);
  const list = exists ? choreDays.map((day) => (day.date === next.date ? next : day)) : [...choreDays, next];
  return dropIfEmpty(list, next.date);
}

/**
 * Marca o desmarca un quehacer en `date`. Idempotente: marcar dos veces no duplica (C4). Copia el nombre actual.
 * Devuelve la MISMA referencia si no hay cambio. Un dia dificil se conserva (C9).
 */
export function setChoreCompleted(
  choreDays: ReadonlyArray<ChoreDay> | undefined,
  chore: Pick<Chore, 'id' | 'name'>,
  date: string,
  done: boolean,
): ChoreDay[] {
  const days = choreDays ?? [];
  const current = findChoreDay(days, date);
  const isDone = current?.completed.some((entry) => entry.choreId === chore.id) ?? false;
  if (isDone === done) return days as ChoreDay[];

  const base: ChoreDay = current ?? { date, completed: [], hard: false };
  const completed = done
    ? [...base.completed, { choreId: chore.id, name: chore.name }]
    : base.completed.filter((entry) => entry.choreId !== chore.id);
  return upsertDay(days, { ...base, completed });
}

/**
 * «Hoy no puedo»: marca o deshace el dia dificil de `date` sin tocar lo ya marcado (C8, C9).
 * Al deshacer se borra el motivo. Devuelve la MISMA referencia si no hay cambio.
 */
export function setHardDay(
  choreDays: ReadonlyArray<ChoreDay> | undefined,
  date: string,
  hard: boolean,
  reason?: ChoreHardReason,
): ChoreDay[] {
  const days = choreDays ?? [];
  const current = findChoreDay(days, date);
  if (!hard) {
    if (!current?.hard) return days as ChoreDay[];
    const { reason: _omit, ...rest } = current;
    return upsertDay(days, { ...rest, hard: false });
  }
  if (current?.hard && current.reason === reason) return days as ChoreDay[];
  const base: ChoreDay = current ?? { date, completed: [], hard: false };
  const { reason: _omit, ...rest } = base;
  return upsertDay(days, reason ? { ...rest, hard: true, reason } : { ...rest, hard: true });
}

/**
 * Cierre de dia (C10): normaliza el registro de un dia ya terminado (quita duplicados y lo borra si quedo vacio).
 * Jamas inventa marcas ni cambia nombres; el pasado queda tal cual. Misma referencia si no hay nada que normalizar.
 */
export function closeChoreDay(choreDays: ReadonlyArray<ChoreDay> | undefined, date: string): ChoreDay[] {
  const days = choreDays ?? [];
  const current = findChoreDay(days, date);
  if (!current) return days as ChoreDay[];
  const seen = new Set<string>();
  const completed = current.completed.filter((entry) => !seen.has(entry.choreId) && seen.add(entry.choreId));
  if (completed.length === current.completed.length && (completed.length > 0 || current.hard)) return days as ChoreDay[];
  return upsertDay(days, { ...current, completed });
}

// --- Estadistica semanal ------------------------------------------------------------

export const CHART_WEEKS = 8;
/** Dias contados minimos para mostrar la grafica (C13): con menos, estado vacio. */
export const MIN_CHART_DAYS = 3;

export interface WeekdayAverage {
  day: DayOfWeek;
  /** Promedio de quehaceres completados ese dia de la semana (0 si no hay muestras). */
  average: number;
  /** Cuantos dias entraron en el promedio. */
  samples: number;
}

export interface WeekdayStats {
  /** Siempre 7 entradas, de Lunes a Domingo. */
  averages: WeekdayAverage[];
  /** Dia con mayor promedio (empate: el primero de la semana); `null` si no hay datos o todos son 0. */
  bestDay: DayOfWeek | null;
  /** Dias que entraron en el calculo (sin contar los dificiles). */
  countedDays: number;
  /** `false` = mostrar estado vacio en vez de la grafica (pocos dias o ningun quehacer completado). */
  hasEnoughData: boolean;
}

/**
 * Promedio de completados por dia de la semana en las ultimas `weeks` semanas (56 dias) que terminan AYER
 * (hoy aun esta en curso y falsearia el promedio). Reglas:
 *  - Los dias dificiles se excluyen (C12).
 *  - Solo cuentan fechas desde el primer registro del usuario: nadie arranca con semanas de ceros.
 *  - Un dia sin registro cuenta como 0 si hoy habria algun quehacer para ese dia de la semana; si no, no cuenta.
 */
export function computeWeekdayStats(
  state: { chores?: ReadonlyArray<Chore>; choreDays?: ReadonlyArray<ChoreDay> },
  today: string,
  weeks: number = CHART_WEEKS,
): WeekdayStats {
  const days = state.choreDays ?? [];
  const sums = new Map<DayOfWeek, { total: number; samples: number }>(ORDERED_DAYS.map((d) => [d, { total: 0, samples: 0 }]));
  const byDate = new Map(days.map((day) => [day.date, day]));
  const firstDate = days.reduce<string | null>((min, day) => (min === null || day.date < min ? day.date : min), null);
  const scheduledWeekdays = new Set((state.chores ?? []).flatMap((chore) => chore.days));
  let countedDays = 0;
  let completedTotal = 0;

  if (firstDate !== null) {
    for (let back = 1; back <= weeks * 7; back += 1) {
      const date = addDaysIso(today, -back);
      if (date < firstDate) break;
      const record = byDate.get(date);
      if (record?.hard) continue;
      const weekday = getDayOfWeekForDate(date);
      if (!record && !scheduledWeekdays.has(weekday)) continue;
      const bucket = sums.get(weekday)!;
      const done = record?.completed.length ?? 0;
      bucket.total += done;
      completedTotal += done;
      bucket.samples += 1;
      countedDays += 1;
    }
  }

  const averages = ORDERED_DAYS.map((day) => {
    const { total, samples } = sums.get(day)!;
    return { day, average: samples === 0 ? 0 : total / samples, samples };
  });
  let bestDay: DayOfWeek | null = null;
  let best = 0;
  for (const entry of averages) {
    if (entry.samples > 0 && entry.average > best) {
      best = entry.average;
      bestDay = entry.day;
    }
  }
  return {
    averages,
    bestDay,
    countedDays,
    // Sin ningun quehacer completado en la ventana solo habria barras en cero: estado vacio (C13).
    hasEnoughData: countedDays >= MIN_CHART_DAYS && completedTotal > 0,
  };
}

// --- Edicion de la lista y de los niveles -------------------------------------------

export type ChoreEditError = 'empty' | 'too-long' | 'limit' | 'no-days' | 'not-found' | 'invalid-levels';
export type ChoreEditResult<T> = { ok: true; value: T } | { ok: false; error: ChoreEditError };

/** Mensajes listos para mostrar al usuario por cada error de edicion. */
export const CHORE_EDIT_ERROR_MESSAGES: Record<ChoreEditError, string> = {
  empty: 'Escribe un nombre.',
  'too-long': `El nombre puede tener hasta ${MAX_CHORE_NAME_LENGTH} caracteres.`,
  limit: `Puedes tener hasta ${MAX_CHORES} quehaceres.`,
  'no-days': 'Elige al menos un día de la semana.',
  'not-found': 'Ese quehacer ya no existe.',
  'invalid-levels': 'Revisa las metas: cantidades distintas entre 1 y 99 y un mensaje en cada una.',
};

function validateName(name: string): ChoreEditResult<string> {
  const trimmed = name.trim();
  if (trimmed.length === 0) return { ok: false, error: 'empty' };
  if (trimmed.length > MAX_CHORE_NAME_LENGTH) return { ok: false, error: 'too-long' };
  return { ok: true, value: trimmed };
}

function uniqueDays(days: ReadonlyArray<DayOfWeek>): DayOfWeek[] {
  return ORDERED_DAYS.filter((day) => days.includes(day));
}

/** true si ya hay otro quehacer con ese nombre (sin distinguir mayusculas): la UI lo avisa pero lo permite. */
export function hasDuplicateChoreName(chores: ReadonlyArray<Chore> | undefined, name: string, excludeId?: string): boolean {
  const wanted = name.trim().toLowerCase();
  return (chores ?? []).some((chore) => chore.id !== excludeId && chore.name.trim().toLowerCase() === wanted);
}

export function newChoreId(): string {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `chore-${random}`;
}

export function addChore(
  chores: ReadonlyArray<Chore> | undefined,
  name: string,
  days: ReadonlyArray<DayOfWeek> = ALL_DAYS,
  id: string = newChoreId(),
): ChoreEditResult<Chore[]> {
  const list = chores ?? [];
  const valid = validateName(name);
  if (!valid.ok) return valid;
  if (list.length >= MAX_CHORES) return { ok: false, error: 'limit' };
  const chosenDays = uniqueDays(days);
  if (chosenDays.length === 0) return { ok: false, error: 'no-days' };
  const order = list.reduce((max, chore) => Math.max(max, chore.order), -1) + 1;
  return { ok: true, value: [...list, { id, name: valid.value, days: chosenDays, order }] };
}

/** Renombra y/o cambia los dias de un quehacer. El historial ya guardado NO cambia (C11). */
export function updateChore(
  chores: ReadonlyArray<Chore> | undefined,
  id: string,
  changes: { name?: string; days?: ReadonlyArray<DayOfWeek> },
): ChoreEditResult<Chore[]> {
  const list = chores ?? [];
  const target = list.find((chore) => chore.id === id);
  if (!target) return { ok: false, error: 'not-found' };
  let name = target.name;
  let days = target.days;
  if (changes.name !== undefined) {
    const valid = validateName(changes.name);
    if (!valid.ok) return valid;
    name = valid.value;
  }
  if (changes.days !== undefined) {
    days = uniqueDays(changes.days);
    if (days.length === 0) return { ok: false, error: 'no-days' };
  }
  return { ok: true, value: list.map((chore) => (chore.id === id ? { ...chore, name, days } : chore)) };
}

export function removeChore(chores: ReadonlyArray<Chore> | undefined, id: string): ChoreEditResult<Chore[]> {
  const list = chores ?? [];
  if (!list.some((chore) => chore.id === id)) return { ok: false, error: 'not-found' };
  return { ok: true, value: list.filter((chore) => chore.id !== id) };
}

/** Valida y normaliza los niveles (ordenados, cantidades distintas 1..99, mensaje no vacio y corto). */
export function normalizeChoreLevels(levels: ReadonlyArray<ChoreLevel>): ChoreEditResult<ChoreLevel[]> {
  if (levels.length > MAX_CHORE_LEVELS) return { ok: false, error: 'invalid-levels' };
  const cleaned: ChoreLevel[] = [];
  for (const level of levels) {
    const message = level.message.trim();
    const validMin = Number.isInteger(level.min) && level.min >= 1 && level.min <= MAX_CHORE_LEVEL_MIN;
    if (!validMin || message.length === 0 || message.length > MAX_CHORE_LEVEL_MESSAGE_LENGTH) {
      return { ok: false, error: 'invalid-levels' };
    }
    cleaned.push({ min: level.min, message });
  }
  if (new Set(cleaned.map((level) => level.min)).size !== cleaned.length) return { ok: false, error: 'invalid-levels' };
  return { ok: true, value: sortLevels(cleaned) };
}

/** Texto de cada motivo de «hoy no puedo» para la UI. */
export const CHORE_HARD_REASON_LABELS: Record<ChoreHardReason, string> = {
  cansado: 'Cansado',
  agobiado: 'Agobiado',
  enfermo: 'Enfermo',
  otro: 'Otro',
};
