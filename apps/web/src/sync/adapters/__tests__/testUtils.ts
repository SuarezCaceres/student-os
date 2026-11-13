import { SyncRecordSchema, type Collection, type SyncRecord } from '@student-os/shared';
import { initialData } from '../../../data/initialData';
import type { AppState } from '../../../types';
import type { SyncAdapter } from '../../adapterTypes';

export const T0 = '2026-11-13T10:00:00.000Z';

/** Copia profunda del estado inicial REAL de la app (para no mutar el original entre pruebas). */
export const freshInitial = (): AppState => structuredClone(initialData);

/** Estado sin kanban / universidad / reflexiones; el resto es el de `initialData`. */
export const blankState = (): AppState => ({
  ...structuredClone(initialData),
  kanbanItems: [],
  universityAssignments: [],
  weeklyReflections: {},
});

export function record(
  collection: Collection,
  id: string,
  data: unknown,
  opts: { updatedAt?: string; deleted?: boolean; rev?: number } = {},
): SyncRecord {
  const updatedAt = opts.updatedAt ?? T0;
  return {
    id,
    collection,
    data: opts.deleted ? null : data,
    updatedAt,
    deletedAt: opts.deleted ? updatedAt : null,
    rev: opts.rev ?? 1,
  };
}

/** `select` del adaptador convertido en registros de sync (como lo haria el motor). */
export function toRecords(adapter: SyncAdapter, state: AppState, updatedAt = T0): SyncRecord[] {
  return adapter.select(state).map((r) => record(adapter.collection, r.id, JSON.parse(JSON.stringify(r.data)), { updatedAt }));
}

/** Valida cada registro contra el contrato REAL de shared (envoltorio + esquema de la coleccion). */
export function expectValidAgainstContract(records: SyncRecord[]): void {
  for (const r of records) {
    const parsed = SyncRecordSchema.safeParse(r);
    if (!parsed.success) throw new Error(`Registro ${r.collection}/${r.id} invalido: ${parsed.error.message}`);
  }
}

/** Congela recursivamente: cualquier mutacion accidental dentro de `apply` lanza en modo estricto. */
export function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value as object)) deepFreeze(v);
  }
  return value;
}
