import { UniversityAssignmentSchema } from '@student-os/shared';
import type { UniversityAssignment } from '../../types';
import type { SyncAdapter } from '../adapterTypes';
import { applyEntityRecords, naturalCompare, selectEntities, type EntitySchema } from './kanban';

/**
 * Adaptador de sync de UNIVERSIDAD (coleccion `university`, un registro por entrega, id = `assignment.id`).
 *
 * Orden de la lista (los registros no traen posicion): `week` asc, luego id "natural" desc (la UI
 * antepone las altas, asi que lo mas nuevo queda primero dentro de su semana). Como la vista agrupa
 * por semana, lo unico visible es el orden dentro de cada semana. Se aplica solo cuando `apply`
 * cambia algo; el comparador es total y depende solo del conjunto de entregas => no oscila.
 * Nota: el curso por defecto de una alta rapida es el primero de la lista (`courses[0]` en la vista),
 * por lo que un orden determinista tambien lo hace consistente entre dispositivos.
 */

const UNIVERSITY_KEYS: ReadonlySet<string> = new Set(Object.keys(UniversityAssignmentSchema.shape));

export function compareUniversityAssignments(a: UniversityAssignment, b: UniversityAssignment): number {
  if (a.week !== b.week) return a.week - b.week;
  return naturalCompare(b.id, a.id);
}

const NO_ASSIGNMENTS: readonly never[] = [];

export const universityAdapter: SyncAdapter = {
  collection: 'university',
  select: (state) => selectEntities(state.universityAssignments, UNIVERSITY_KEYS),
  apply: (state, records) => {
    const base: readonly UniversityAssignment[] = state.universityAssignments ?? NO_ASSIGNMENTS;
    const next = applyEntityRecords<UniversityAssignment>(
      base,
      records,
      UniversityAssignmentSchema as unknown as EntitySchema<UniversityAssignment>,
      compareUniversityAssignments,
    );
    return next === base ? state : { ...state, universityAssignments: next as UniversityAssignment[] };
  },
};
