import type { Collection } from '@student-os/shared';
import { MAX_CLIENT_CLOCK_SKEW_MS } from './sync.constants';
import type { StoredRecord } from './sync.types';

/**
 * Logica PURA de "ultima edicion gana" (sin acceso a datos ni reloj propio): totalmente testeable.
 *
 * Reglas, por cada cambio entrante y la version actual del servidor (si existe):
 *  1. Sin version en el servidor -> se inserta (`rev` = 1).
 *  2. Mismo contenido (mismo `data`, o ambos tombstones) -> idempotente: cuenta como aplicado, NO se escribe
 *     (ni cambia `rev` ni `seq`). Asi un reintento tras perder la respuesta no ensucia el historial, ni siquiera
 *     cuando el `updatedAt` se recorto por reloj adelantado (el segundo intento tendria otro "ahora").
 *  3. `updatedAt` entrante <= `updatedAt` del servidor -> conflicto: se devuelve la version del servidor.
 *     (El empate favorece al servidor, que es quien manda.)
 *  4. En otro caso (entrante mas nuevo) -> se aplica y `rev` = rev anterior + 1.
 *
 * `rev` y `seq` los decide SIEMPRE el servidor; los valores que traiga el cliente se ignoran.
 */

/** Cambio ya validado y normalizado (fechas parseadas; `data` pasado por el esquema de su coleccion). */
export interface NormalizedChange {
  collection: Collection;
  id: string;
  /** Ignorado y anulado si `deletedAt` no es null (los tombstones no conservan contenido). */
  data: unknown;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface PushPlan {
  /** Ids aplicados (incluye reenvios idempotentes), sin repetidos, en orden de llegada. */
  applied: string[];
  /** Version vigente del servidor de los cambios rechazados. */
  conflicts: StoredRecord[];
  /** Filas a escribir (con `seq` ya asignado, en orden creciente). */
  writes: StoredRecord[];
  /** Ultimo `seq` asignado (= contador de entrada si no hay escrituras). */
  newCounter: bigint;
  /** Cuantas filas NUEVAS crea el push (para la cuota). */
  newRows: number;
}

export type Decision = 'insert' | 'update' | 'noop' | 'conflict';

export function recordKey(collection: Collection, id: string): string {
  return `${collection}:${id}`;
}

/**
 * Defensa contra reloj adelantado: una fecha posterior a `now + 5 min` se recorta a `now`.
 * (Las fechas pasadas, aunque sean muy antiguas, se respetan: son ediciones offline legitimas.)
 */
export function clampClientDate(date: Date, now: Date): Date {
  return date.getTime() > now.getTime() + MAX_CLIENT_CLOCK_SKEW_MS ? new Date(now.getTime()) : date;
}

/** JSON con claves ordenadas, para comparar contenido sin depender del orden de claves (jsonb lo reordena). */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(source)
        .sort()
        .map((key) => [key, sortKeys(source[key])]),
    );
  }
  return value;
}

export function sameContent(current: StoredRecord, incoming: NormalizedChange): boolean {
  const currentDeleted = current.deletedAt !== null;
  const incomingDeleted = incoming.deletedAt !== null;
  if (currentDeleted || incomingDeleted) return currentDeleted && incomingDeleted;
  return stableStringify(current.data) === stableStringify(incoming.data);
}

export function decide(current: StoredRecord | undefined, incoming: NormalizedChange): Decision {
  if (!current) return 'insert';
  if (sameContent(current, incoming)) return 'noop';
  if (incoming.updatedAt.getTime() <= current.updatedAt.getTime()) return 'conflict';
  return 'update';
}

/**
 * Calcula el resultado de un push sobre el estado actual del servidor.
 * @param existing versiones actuales del servidor de las claves tocadas, por `recordKey`.
 * @param counter ultimo `seq` asignado del usuario (ya bloqueado).
 */
export function planPush(
  existing: ReadonlyMap<string, StoredRecord>,
  changes: readonly NormalizedChange[],
  now: Date,
  counter: bigint,
): PushPlan {
  // Estado de trabajo: dos cambios con la misma clave en un mismo push se evaluan en orden de llegada.
  const state = new Map(existing);
  const dirty = new Set<string>();
  const applied = new Set<string>();
  const conflicts = new Map<string, StoredRecord>();
  let newRows = 0;

  for (const change of changes) {
    const key = recordKey(change.collection, change.id);
    const updatedAt = clampClientDate(change.updatedAt, now);
    const deletedAt = change.deletedAt ? clampClientDate(change.deletedAt, now) : null;
    const normalized: NormalizedChange = {
      ...change,
      updatedAt,
      deletedAt,
      data: deletedAt ? null : change.data,
    };
    const current = state.get(key);

    switch (decide(current, normalized)) {
      case 'noop':
        applied.add(change.id);
        break;
      case 'conflict':
        conflicts.set(key, current as StoredRecord);
        break;
      case 'insert':
      case 'update': {
        if (!current) newRows += 1;
        state.set(key, {
          collection: change.collection,
          id: change.id,
          data: normalized.data,
          updatedAt,
          deletedAt,
          rev: current ? current.rev + 1 : 1,
          seq: 0n, // se asigna abajo, una vez conocido el orden final
          serverUpdatedAt: now,
        });
        dirty.add(key);
        conflicts.delete(key);
        applied.add(change.id);
        break;
      }
    }
  }

  let newCounter = counter;
  const writes: StoredRecord[] = [];
  for (const key of dirty) {
    newCounter += 1n;
    const row = { ...(state.get(key) as StoredRecord), seq: newCounter };
    writes.push(row);
  }

  return {
    applied: [...applied],
    conflicts: [...conflicts.values()],
    writes,
    newCounter,
    newRows,
  };
}
