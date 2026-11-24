import {
  GYM_PREFERENCE_RECORD_ID,
  GYM_PROFILE_RECORD_ID,
  GymRecordDataSchema,
  dismissedAlertRecordId,
  weightEntryRecordId,
  type SyncRecord,
} from '@student-os/shared';
import type {
  AppState,
  ExerciseHistoryEntry,
  GymAttendanceLog,
  GymExercise,
  GymRoutine,
  GymSessionStatus,
  UserGymProfile,
  WeightHistoryEntry,
} from '../../types';
import type { SyncAdapter } from '../adapterTypes';
import { stableStringify } from '../hash';

/**
 * Adaptador de sincronizacion de GYM (coleccion `gym`).
 *
 * Proyeccion (todos los registros viajan como `{ kind, value }`, ver `packages/shared/src/gym.ts`):
 *   gymRoutines                -> 'routine'        id = routine.id            (un registro por rutina)
 *   gymProfile                 -> 'profile'        id = GYM_PROFILE_RECORD_ID (singleton)
 *   weightHistory              -> 'weightEntry'    id = weight-<date>         (1 por fecha)
 *   gymAttendanceLogs          -> 'attendanceLog'  id = log.id                (att-<date>-<routineId>)
 *   dismissedGymScheduleAlerts -> 'dismissedAlert' id = dismissed-<date>      (semantica de conjunto)
 *   gymDisabled                -> 'preference'     id = GYM_PREFERENCE_RECORD_ID (singleton; spec 011)
 *
 * Reglas de `apply` (funcion pura, inmutable e idempotente):
 *  - Devuelve el MISMO objeto de estado si ningun registro cambia nada (el motor no re-renderiza ni re-sube).
 *  - Tombstone (`deletedAt !== null`): elimina la entidad. Como un tombstone no lleva `data`, el tipo de entidad
 *    se deduce del id (`gym-profile`, `gym-preference`, `weight-*`, `dismissed-*`; el resto = rutina o log de asistencia).
 *  - Registros vivos invalidos o con id incoherente con su valor se IGNORAN (nunca lanzan ni rompen el estado).
 *  - Orden determinista de listas: solo se reordena una lista cuando un registro la cambia realmente
 *    (rutinas por dia de la semana + id, pesos por fecha, asistencia por fecha + id, alertas por fecha).
 *
 * Riesgo "ultima edicion gana" sobre la rutina completa: ver `mergeRoutine` y `docs/agent-notes/GYM.md`.
 * No se sincronizan bloques de calendario (son de CALENDAR): los bloques `category === 'gym'` locales siguen
 * sin duplicarse mientras Google este conectado porque este adaptador nunca los toca.
 */

const DAY_ORDER: Record<string, number> = {
  Lunes: 0,
  Martes: 1,
  'Miércoles': 2,
  Jueves: 3,
  Viernes: 4,
  'Sábado': 5,
  Domingo: 6,
};

/** Maximo del servidor por registro: 64 KB (`MAX_RECORD_DATA_BYTES`). Margen de seguridad para el recorte. */
const ROUTINE_SOFT_LIMIT_BYTES = 60_000;

const WEIGHT_PREFIX = weightEntryRecordId('');
const DISMISSED_PREFIX = dismissedAlertRecordId('');

const STATUS_RANK: Record<GymSessionStatus, number> = {
  idle: 0,
  missed: 1,
  rescheduled: 2,
  in_progress: 3,
  completed: 4,
};

// --- Utilidades ---------------------------------------------------------------

const asArray = <T>(value: T[] | undefined | null): T[] => (Array.isArray(value) ? value : []);

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const sameValue = (a: unknown, b: unknown): boolean => stableStringify(a) === stableStringify(b);

/** Comparacion de cadenas independiente del idioma del navegador (determinista entre dispositivos). */
const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** ids que ocupan el espacio de nombres de otros `kind`: una rutina/log con ese id no se puede sincronizar. */
const isReservedId = (id: string): boolean =>
  id === GYM_PROFILE_RECORD_ID ||
  id === GYM_PREFERENCE_RECORD_ID ||
  id.startsWith(WEIGHT_PREFIX) ||
  id.startsWith(DISMISSED_PREFIX);

const byteLength = (value: unknown): number => new TextEncoder().encode(JSON.stringify(value)).length;

// --- Recorte defensivo del historial (limite de 64 KB por registro) ------------

/**
 * Si una rutina serializada supera el limite del servidor (historial muy largo), recorta las entradas de historial
 * MAS ANTIGUAS de los ejercicios con mas historial hasta que quepa. El PR (`personalRecordKg`) es un campo propio y
 * NO se toca, asi que un recorte nunca borra un PR. Localmente no se pierde nada: `apply` vuelve a unir el historial.
 */
function fitRoutineToLimit(routine: GymRoutine): GymRoutine {
  if (byteLength(routine) <= ROUTINE_SOFT_LIMIT_BYTES) return routine;
  const histories = routine.exercises.map((ex) => [...asArray(ex.history)]);
  let size = byteLength(routine);
  let guard = 0;
  while (size > ROUTINE_SOFT_LIMIT_BYTES && guard++ < 100_000) {
    let longest = -1;
    let longestLen = 0;
    histories.forEach((h, i) => {
      if (h.length > longestLen) {
        longest = i;
        longestLen = h.length;
      }
    });
    if (longest === -1) break; // nada mas que recortar
    const dropped = histories[longest].shift();
    size -= byteLength(dropped) + 1;
  }
  return {
    ...routine,
    exercises: routine.exercises.map((ex, i) =>
      ex.history === undefined ? ex : { ...ex, history: histories[i] },
    ),
  };
}

// --- select -------------------------------------------------------------------

function select(state: AppState): Array<Pick<SyncRecord, 'id' | 'data'>> {
  const out = new Map<string, Pick<SyncRecord, 'id' | 'data'>>();
  const put = (id: string, kind: string, value: unknown, firstWins = false): void => {
    if (firstWins && out.has(id)) {
      console.warn(`Gym: id de registro duplicado ignorado (${id}).`);
      return;
    }
    out.set(id, { id, data: { kind, value } });
  };

  if (isObject(state.gymProfile)) put(GYM_PROFILE_RECORD_ID, 'profile', state.gymProfile);
  // `gymDisabled` ausente = gym activo: no se sube nada. `false` se sube para que reactivar llegue a otros dispositivos.
  if (typeof state.gymDisabled === 'boolean') {
    put(GYM_PREFERENCE_RECORD_ID, 'preference', { disabled: state.gymDisabled });
  }

  for (const entry of asArray(state.weightHistory)) {
    if (!isObject(entry) || typeof entry.date !== 'string') continue;
    put(weightEntryRecordId(entry.date), 'weightEntry', entry); // 1 por fecha: la ultima gana (como la app)
  }

  for (const date of new Set(asArray(state.dismissedGymScheduleAlerts))) {
    if (typeof date !== 'string' || date === '') continue;
    put(dismissedAlertRecordId(date), 'dismissedAlert', date);
  }

  for (const routine of asArray(state.gymRoutines)) {
    if (!isObject(routine) || typeof routine.id !== 'string' || routine.id === '') continue;
    if (isReservedId(routine.id)) {
      console.warn(`Gym: la rutina "${routine.id}" usa un id reservado y no se sincroniza.`);
      continue;
    }
    put(routine.id, 'routine', fitRoutineToLimit(routine), true);
  }

  for (const log of asArray(state.gymAttendanceLogs)) {
    if (!isObject(log) || typeof log.id !== 'string' || log.id === '') continue;
    if (isReservedId(log.id)) {
      console.warn(`Gym: el registro de asistencia "${log.id}" usa un id reservado y no se sincroniza.`);
      continue;
    }
    put(log.id, 'attendanceLog', log, true);
  }

  return [...out.values()];
}

// --- Fusion de rutinas --------------------------------------------------------

const historyKey = (e: ExerciseHistoryEntry): string => `${e.date}|${e.weightKg}|${e.reps}`;

/**
 * Cuando llega una version remota de una rutina que ya existe localmente, el servidor manda (la rutina remota gana
 * entera: series completadas, pesos, notas, estructura). Salvedad para NO PERDER PROGRESO HISTORICO: las entradas de
 * `history` que solo existen localmente (levantamientos registrados que el otro dispositivo no vio) se conservan y,
 * si las hay, el PR no puede quedar por debajo de ellas ni del PR local.
 *
 * Se limita deliberadamente a eso: `completedSets`, `weightKg`, `notes` o ejercicios borrados se resuelven por
 * "ultima edicion gana" (una fusion de `completedSets` resucitaria series marcadas tras el reinicio semanal).
 */
function mergeExercise(local: GymExercise, remote: GymExercise): GymExercise {
  const remoteHistory = asArray(remote.history);
  const known = new Set(remoteHistory.map(historyKey));
  const extra: ExerciseHistoryEntry[] = [];
  for (const entry of asArray(local.history)) {
    const key = historyKey(entry);
    if (known.has(key)) continue;
    known.add(key);
    extra.push(entry);
  }
  if (extra.length === 0) return remote;

  // Orden estable por fecha: las entradas del mismo dia conservan el orden (primero las remotas).
  const history = [...remoteHistory, ...extra].sort((a, b) => cmp(a.date, b.date));
  const candidates = [remote.personalRecordKg, local.personalRecordKg, ...extra.map((e) => e.weightKg)].filter(
    (n): n is number => typeof n === 'number' && Number.isFinite(n),
  );
  const personalRecordKg = candidates.length > 0 ? Math.max(...candidates) : undefined;
  return personalRecordKg === undefined ? { ...remote, history } : { ...remote, history, personalRecordKg };
}

function mergeRoutine(local: GymRoutine | undefined, remote: GymRoutine): GymRoutine {
  if (!local) return remote;
  const localById = new Map(asArray(local.exercises).map((ex) => [ex.id, ex]));
  let touched = false;
  const exercises = remote.exercises.map((ex) => {
    const prev = localById.get(ex.id);
    if (!prev) return ex;
    const merged = mergeExercise(prev, ex);
    if (merged !== ex) touched = true;
    return merged;
  });
  return touched ? { ...remote, exercises } : remote;
}

// --- apply --------------------------------------------------------------------

type Op<T> = T | null; // null = borrar

interface Plan {
  profile: { op: Op<UserGymProfile> } | null;
  preference: { op: Op<boolean> } | null;
  routines: Map<string, Op<GymRoutine>>;
  weights: Map<string, Op<WeightHistoryEntry>>; // clave = fecha
  logs: Map<string, Op<GymAttendanceLog>>;
  dismissed: Map<string, boolean>; // clave = fecha, true = presente
  invalid: number;
}

/** Entre varias versiones de un mismo id en un lote, conserva la mas reciente (empate: la ultima del lote). */
function latestPerId(records: SyncRecord[]): SyncRecord[] {
  const latest = new Map<string, SyncRecord>();
  for (const record of records) {
    if (record.collection !== 'gym') continue;
    const prev = latest.get(record.id);
    if (!prev || !(Date.parse(record.updatedAt) < Date.parse(prev.updatedAt))) latest.set(record.id, record);
  }
  return [...latest.values()];
}

function buildPlan(records: SyncRecord[]): Plan {
  const plan: Plan = {
    profile: null,
    preference: null,
    routines: new Map(),
    weights: new Map(),
    logs: new Map(),
    dismissed: new Map(),
    invalid: 0,
  };

  for (const record of latestPerId(records)) {
    const { id } = record;

    if (record.deletedAt !== null) {
      if (id === GYM_PROFILE_RECORD_ID) plan.profile = { op: null };
      else if (id === GYM_PREFERENCE_RECORD_ID) plan.preference = { op: null };
      else if (id.startsWith(WEIGHT_PREFIX)) plan.weights.set(id.slice(WEIGHT_PREFIX.length), null);
      else if (id.startsWith(DISMISSED_PREFIX)) plan.dismissed.set(id.slice(DISMISSED_PREFIX.length), false);
      else {
        // Un tombstone no dice si era rutina o log de asistencia; los ids de ambos no colisionan en la practica.
        plan.routines.set(id, null);
        plan.logs.set(id, null);
      }
      continue;
    }

    const parsed = GymRecordDataSchema.safeParse(record.data);
    if (!parsed.success) {
      plan.invalid++;
      continue;
    }
    const data = parsed.data;
    switch (data.kind) {
      case 'routine':
        if (data.value.id !== id || isReservedId(id)) plan.invalid++;
        else plan.routines.set(id, data.value as GymRoutine);
        break;
      case 'profile':
        if (id !== GYM_PROFILE_RECORD_ID) plan.invalid++;
        else plan.profile = { op: data.value as UserGymProfile };
        break;
      case 'preference':
        if (id !== GYM_PREFERENCE_RECORD_ID) plan.invalid++;
        else plan.preference = { op: data.value.disabled };
        break;
      case 'weightEntry':
        if (id !== weightEntryRecordId(data.value.date)) plan.invalid++;
        else plan.weights.set(data.value.date, data.value);
        break;
      case 'attendanceLog':
        if (data.value.id !== id || isReservedId(id)) plan.invalid++;
        else plan.logs.set(id, data.value as GymAttendanceLog);
        break;
      case 'dismissedAlert':
        if (data.value === '' || id !== dismissedAlertRecordId(data.value)) plan.invalid++;
        else plan.dismissed.set(data.value, true);
        break;
    }
  }
  return plan;
}

/**
 * Aplica operaciones por clave sobre una lista. Devuelve `null` si no cambia nada (para conservar la referencia),
 * o la lista nueva (sin ordenar) si cambia algo.
 */
function applyKeyed<T>(
  list: T[],
  keyOf: (item: T) => string,
  ops: Map<string, Op<T>>,
  merge?: (local: T | undefined, remote: T) => T,
): T[] | null {
  if (ops.size === 0) return null;
  const current = new Map<string, T>();
  for (const item of list) {
    if (isObject(item)) current.set(keyOf(item), item);
  }
  let changed = false;
  for (const [key, op] of ops) {
    const local = current.get(key);
    if (op === null) {
      if (current.delete(key)) changed = true;
    } else {
      const next = merge ? merge(local, op) : op;
      if (local === undefined || !sameValue(local, next)) {
        current.set(key, next);
        changed = true;
      }
    }
  }
  return changed ? [...current.values()] : null;
}

const routineOrder = (a: GymRoutine, b: GymRoutine): number =>
  (DAY_ORDER[a.dayOfWeek] ?? 99) - (DAY_ORDER[b.dayOfWeek] ?? 99) || cmp(a.id, b.id);

/** La app guarda como maximo UN log por fecha. Si dos dispositivos crearon ids distintos para el mismo dia, queda el mas "avanzado". */
function dedupeLogsByDate(logs: GymAttendanceLog[]): GymAttendanceLog[] {
  const best = new Map<string, GymAttendanceLog>();
  const stamp = (l: GymAttendanceLog) => l.finishedAt ?? l.startedAt ?? '';
  for (const log of logs) {
    const prev = best.get(log.date);
    if (!prev) {
      best.set(log.date, log);
      continue;
    }
    const diff =
      (STATUS_RANK[log.status] ?? 0) - (STATUS_RANK[prev.status] ?? 0) || cmp(stamp(log), stamp(prev)) || cmp(log.id, prev.id);
    if (diff > 0) best.set(log.date, log);
  }
  return best.size === logs.length ? logs : [...best.values()];
}

function apply(state: AppState, records: SyncRecord[]): AppState {
  const plan = buildPlan(records);
  if (plan.invalid > 0) console.warn(`Gym: ${plan.invalid} registros remotos invalidos se ignoraron.`);

  let next: AppState = state;

  // Perfil (singleton)
  if (plan.profile) {
    const { op } = plan.profile;
    if (op === null) {
      if (state.gymProfile !== undefined) {
        const copy: AppState = { ...next };
        delete copy.gymProfile;
        next = copy;
      }
    } else if (!sameValue(state.gymProfile, op)) {
      next = { ...next, gymProfile: op };
    }
  }

  // Preferencia de gym (singleton). Un tombstone vuelve al estado por defecto: gym activo (campo ausente).
  if (plan.preference) {
    const { op } = plan.preference;
    if (op === null) {
      if (state.gymDisabled !== undefined) {
        const copy: AppState = { ...next };
        delete copy.gymDisabled;
        next = copy;
      }
    } else if (state.gymDisabled !== op) {
      next = { ...next, gymDisabled: op };
    }
  }

  // Rutinas
  const routines = applyKeyed(asArray(state.gymRoutines), (r) => r.id, plan.routines, mergeRoutine);
  if (routines) next = { ...next, gymRoutines: routines.sort(routineOrder) };

  // Historial de peso (1 por fecha)
  const weights = applyKeyed(asArray(state.weightHistory), (w) => w.date, plan.weights);
  if (weights) next = { ...next, weightHistory: weights.sort((a, b) => cmp(a.date, b.date)) };

  // Asistencia
  const logs = applyKeyed(asArray(state.gymAttendanceLogs), (l) => l.id, plan.logs);
  if (logs) {
    const unique = dedupeLogsByDate(logs).sort((a, b) => cmp(a.date, b.date) || cmp(a.id, b.id));
    next = { ...next, gymAttendanceLogs: unique };
  }

  // Alertas descartadas (conjunto de fechas)
  if (plan.dismissed.size > 0) {
    const set = new Set(asArray(state.dismissedGymScheduleAlerts).filter((d) => typeof d === 'string'));
    let changed = false;
    for (const [date, present] of plan.dismissed) {
      if (present && !set.has(date)) {
        set.add(date);
        changed = true;
      } else if (!present && set.delete(date)) {
        changed = true;
      }
    }
    if (changed) next = { ...next, dismissedGymScheduleAlerts: [...set].sort(cmp) };
  }

  return next;
}

export const gymAdapter: SyncAdapter = {
  collection: 'gym',
  select,
  apply,
};
