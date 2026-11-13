import { KanbanItemSchema, type SyncRecord } from '@student-os/shared';
import type { KanbanItem } from '../../types';
import type { SyncAdapter } from '../adapterTypes';
import { stableStringify } from '../hash';

/**
 * Adaptador de sync de KANBAN (coleccion `kanban`, un registro por `KanbanItem`, id = `item.id`).
 *
 * Tambien aloja los helpers genericos de "lista de entidades con id" que reutiliza el adaptador de
 * universidad (`./university`): son puros y no dependen de React ni de la red.
 *
 * Orden de la lista (los registros no traen posicion):
 *  - La UI antepone las altas (`[nuevo, ...lista]`), asi que "mas nuevo primero" es la semantica de hoy.
 *  - Tras aplicar registros remotos la lista se reordena con un comparador TOTAL y determinista
 *    (`compareKanbanItems`: `createdAt` desc, luego id "natural" desc). El resultado depende solo del
 *    conjunto de entidades, nunca del orden de llegada ni del dispositivo => no oscila entre dispositivos.
 *  - Si `apply` no cambia nada devuelve el MISMO estado (sin reordenar): no se toca lo que no cambio.
 */

// --- Helpers genericos (reutilizados por university.ts) --------------------------------------

/** Compara dos textos por trozos: numeros como numeros, el resto por unidad de codigo (sin locale). */
export function naturalCompare(a: string, b: string): number {
  const re = /(\d+)|(\D+)/g;
  const pa = a.match(re) ?? [];
  const pb = b.match(re) ?? [];
  const n = Math.min(pa.length, pb.length);
  for (let i = 0; i < n; i++) {
    const x = pa[i];
    const y = pb[i];
    if (x === y) continue;
    const xNum = /^\d/.test(x);
    const yNum = /^\d/.test(y);
    if (xNum && yNum) {
      // Sin Number(): los ids con timestamp caben, pero asi no dependemos del tamano del entero.
      const xs = x.replace(/^0+(?=\d)/, '');
      const ys = y.replace(/^0+(?=\d)/, '');
      if (xs.length !== ys.length) return xs.length < ys.length ? -1 : 1;
      if (xs !== ys) return xs < ys ? -1 : 1;
      if (x.length !== y.length) return x.length < y.length ? -1 : 1;
      continue;
    }
    return x < y ? -1 : 1;
  }
  if (pa.length !== pb.length) return pa.length < pb.length ? -1 : 1;
  return a === b ? 0 : a < b ? -1 : 1;
}

/** Forma minima de un esquema zod de objeto que necesitan los helpers. */
export interface EntitySchema<T> {
  shape: Record<string, unknown>;
  safeParse(input: unknown): { success: true; data: T } | { success: false };
}

/** Copia solo las claves que viajan en el contrato (los campos solo-locales no se envian). */
export function pickKnown(value: object, known: ReadonlySet<string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value)) {
    if (known.has(key) && v !== undefined) out[key] = v;
  }
  return out;
}

/** `select` generico: un registro por entidad con `id` string, sin duplicados, solo claves del contrato. */
export function selectEntities(
  items: ReadonlyArray<{ id: string }> | undefined,
  known: ReadonlySet<string>,
): Array<{ id: string; data: Record<string, unknown> }> {
  const out: Array<{ id: string; data: Record<string, unknown> }> = [];
  const seen = new Set<string>();
  for (const item of items ?? []) {
    if (!item || typeof item.id !== 'string' || item.id === '' || seen.has(item.id)) continue;
    seen.add(item.id);
    out.push({ id: item.id, data: pickKnown(item, known) });
  }
  return out;
}

/**
 * `apply` generico e idempotente para una lista de entidades con id.
 *  - Por id se usa el registro con `updatedAt` mas reciente (empate: el ultimo de la lista).
 *  - Tombstone (`deletedAt`): elimina la entidad; si no existe es un no-op.
 *  - Datos invalidos (esquema o id distinto) se ignoran sin tocar el estado.
 *  - Los campos locales que no viajan (claves fuera del esquema) se conservan.
 *  - Si nada cambia devuelve la MISMA referencia; si algo cambia devuelve una lista nueva ordenada.
 */
export function applyEntityRecords<T extends { id: string }>(
  current: readonly T[],
  records: readonly SyncRecord[],
  schema: EntitySchema<T>,
  compare: (a: T, b: T) => number,
): readonly T[] {
  const known = new Set(Object.keys(schema.shape));
  const latest = new Map<string, SyncRecord>();
  for (const record of records) {
    const prev = latest.get(record.id);
    if (!prev || !(Date.parse(record.updatedAt) < Date.parse(prev.updatedAt))) latest.set(record.id, record);
  }

  let next: T[] | null = null;
  const draft = (): T[] => (next ??= current.slice());

  for (const [id, record] of latest) {
    const list = next ?? current;
    const first = list.findIndex((item) => item.id === id);

    if (record.deletedAt !== null) {
      if (first !== -1) next = draft().filter((item) => item.id !== id);
      continue;
    }

    const parsed = schema.safeParse(record.data);
    if (!parsed.success || parsed.data.id !== id) {
      console.warn(`Registro remoto invalido ignorado (${record.collection}/${id}).`);
      continue;
    }

    if (first === -1) {
      draft().push(parsed.data);
      continue;
    }

    const local = list[first];
    const extras: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(local)) if (!known.has(key)) extras[key] = v;
    const merged = { ...extras, ...parsed.data } as T;
    const duplicates = list.some((item, i) => i !== first && item.id === id);
    if (!duplicates && stableStringify(local) === stableStringify(merged)) continue;

    // Reemplaza la primera aparicion y descarta duplicados residuales del mismo id.
    let placed = false;
    next = draft().flatMap((item) => (item.id !== id ? [item] : placed ? [] : ((placed = true), [merged])));
  }

  if (!next) return current;
  return next.sort(compare);
}

// --- Kanban ----------------------------------------------------------------------------------

const KANBAN_KEYS: ReadonlySet<string> = new Set(Object.keys(KanbanItemSchema.shape));

/** `createdAt` desc (YYYY-MM-DD, comparacion de texto) y luego id natural desc (el mas nuevo primero). */
export function compareKanbanItems(a: KanbanItem, b: KanbanItem): number {
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
  return naturalCompare(b.id, a.id);
}

const NO_ITEMS: readonly never[] = [];

export const kanbanAdapter: SyncAdapter = {
  collection: 'kanban',
  select: (state) => selectEntities(state.kanbanItems, KANBAN_KEYS),
  apply: (state, records) => {
    const base: readonly KanbanItem[] = state.kanbanItems ?? NO_ITEMS;
    const next = applyEntityRecords<KanbanItem>(
      base,
      records,
      KanbanItemSchema as unknown as EntitySchema<KanbanItem>,
      compareKanbanItems,
    );
    return next === base ? state : { ...state, kanbanItems: next as KanbanItem[] };
  },
};
