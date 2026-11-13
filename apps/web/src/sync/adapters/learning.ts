import { WeeklyReflectionSchema, weeklyReflectionRecordId, type SyncRecord } from '@student-os/shared';
import type { WeeklyReflection } from '../../types';
import type { SyncAdapter } from '../adapterTypes';
import { stableStringify } from '../hash';
import { pickKnown } from './kanban';

/**
 * Adaptador de sync de APRENDIZAJE (coleccion `learning`): una reflexion por semana.
 *
 * - Id del registro = `weeklyReflectionRecordId(week)` = la semana en texto ("5"). La clave del mapa
 *   `weeklyReflections` y `reflection.week` son lo mismo; si discrepan manda la CLAVE.
 * - Orden: `weeklyReflections` es un objeto con claves enteras, que JS recorre siempre en orden
 *   numerico ascendente; no hay lista que ordenar y por tanto nada que pueda oscilar.
 * - Tombstone: elimina la clave. Si el mapa queda vacio se deja `{}` (la vista ya lo trata como vacio).
 * - Registros con id no canonico, datos invalidos o `week` distinto del id se ignoran.
 */

const LEARNING_KEYS: ReadonlySet<string> = new Set(Object.keys(WeeklyReflectionSchema.shape));

/** Id canonico de una clave del mapa ("05" y "5" son la misma semana), o null si no es una semana. */
function recordIdForKey(key: string): string | null {
  if (!/^\d+$/.test(key)) return null;
  const week = Number(key);
  return Number.isSafeInteger(week) ? weeklyReflectionRecordId(week) : null;
}

export const learningAdapter: SyncAdapter = {
  collection: 'learning',
  select: (state) => {
    const out: Array<{ id: string; data: Record<string, unknown> }> = [];
    const seen = new Set<string>();
    for (const [key, reflection] of Object.entries(state.weeklyReflections ?? {})) {
      const id = recordIdForKey(key);
      if (id === null || seen.has(id) || !reflection || typeof reflection !== 'object') continue;
      seen.add(id);
      out.push({ id, data: { ...pickKnown(reflection, LEARNING_KEYS), week: Number(id) } });
    }
    return out;
  },
  apply: (state, records) => {
    const latest = new Map<string, SyncRecord>();
    for (const record of records) {
      const prev = latest.get(record.id);
      if (!prev || !(Date.parse(record.updatedAt) < Date.parse(prev.updatedAt))) latest.set(record.id, record);
    }

    const current: Record<string, WeeklyReflection | undefined> = state.weeklyReflections ?? {};
    let next: Record<string, WeeklyReflection | undefined> | null = null;
    const draft = () => (next ??= { ...current });

    for (const [id, record] of latest) {
      if (recordIdForKey(id) !== id) continue; // solo ids canonicos ("5", no "05" ni "abc")
      const local = (next ?? current)[id];

      if (record.deletedAt !== null) {
        if (local !== undefined) delete draft()[id];
        continue;
      }

      const parsed = WeeklyReflectionSchema.safeParse(record.data);
      if (!parsed.success || parsed.data.week !== Number(id)) {
        console.warn(`Registro remoto invalido ignorado (learning/${id}).`);
        continue;
      }

      const extras: Record<string, unknown> = {};
      for (const [key, v] of Object.entries(local ?? {})) if (!LEARNING_KEYS.has(key)) extras[key] = v;
      const merged = { ...extras, ...parsed.data } as WeeklyReflection;
      if (local !== undefined && stableStringify(local) === stableStringify(merged)) continue;
      draft()[id] = merged;
    }

    if (!next) return state;
    return { ...state, weeklyReflections: next as { [week: number]: WeeklyReflection } };
  },
};
