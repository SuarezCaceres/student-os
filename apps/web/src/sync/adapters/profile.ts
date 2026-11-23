import { PROFILE_RECORD_ID, ProfileSchema, type Profile, type SyncRecord } from '@student-os/shared';
import type { AppState } from '../../types';
import type { SyncAdapter } from '../adapterTypes';

/**
 * Adaptador de la coleccion `profile`: UN registro singleton (`PROFILE_RECORD_ID`) con
 * `studentName`, `career`, `currentAcademicWeek` y `streak` (+ `theme`, ver abajo).
 *
 * DECISION `theme`: es una preferencia POR DISPOSITIVO (un movil puede estar en oscuro y el PC en claro; que
 * un cambio remoto invierta de golpe la pantalla seria un parpadeo inesperado). El contrato obliga a que
 * `data.theme` exista, asi que:
 *  - `select` emite siempre `PROFILE_SYNC_THEME` (constante) en lugar del tema real. Asi alternar el tema
 *    NO cambia el hash del registro: no genera push, no pisa por "ultima edicion gana" una edicion
 *    concurrente del nombre/carrera/racha en otro dispositivo, y no puede haber eco.
 *  - `apply` ignora el `theme` remoto y conserva el local.
 *
 * `streak` y `currentAcademicWeek` son escalares con ultima-edicion-gana sobre el objeto entero (limitacion del
 * contrato: dos dispositivos que incrementan la racha a la vez se quedan con la edicion mas reciente).
 *
 * Puro: sin I/O. `apply` es inmutable, idempotente y devuelve la MISMA referencia si no cambia nada.
 */

/** Valor fijo que viaja en `theme` (el tema real no se sincroniza). */
export const PROFILE_SYNC_THEME: Profile['theme'] = 'dark';

function isSaneProfile(profile: Profile): boolean {
  return (
    Number.isInteger(profile.currentAcademicWeek) &&
    profile.currentAcademicWeek >= 0 &&
    Number.isInteger(profile.streak) &&
    profile.streak >= 0
  );
}

export const profileAdapter: SyncAdapter = {
  collection: 'profile',

  select(state: AppState) {
    const data: Profile = {
      studentName: state.studentName,
      career: state.career,
      currentAcademicWeek: state.currentAcademicWeek,
      streak: state.streak,
      theme: PROFILE_SYNC_THEME,
    };
    return [{ id: PROFILE_RECORD_ID, data }];
  },

  apply(state: AppState, records: SyncRecord[]): AppState {
    let next = state;
    // Un unico registro por id; si llegasen varios, el orden de llegada decide (el servidor ya resolvio LWW).
    for (const record of records) {
      if (record.collection !== 'profile' || record.id !== PROFILE_RECORD_ID) continue;
      // El perfil no se "borra": un tombstone no deja la app sin nombre ni racha.
      if (record.deletedAt !== null) continue;
      const parsed = ProfileSchema.safeParse(record.data);
      if (!parsed.success || !isSaneProfile(parsed.data)) continue;
      const { studentName, career, currentAcademicWeek, streak } = parsed.data;
      if (
        next.studentName === studentName &&
        next.career === career &&
        next.currentAcademicWeek === currentAcademicWeek &&
        next.streak === streak
      ) {
        continue;
      }
      // `theme` se conserva (preferencia por dispositivo).
      next = { ...next, studentName, career, currentAcademicWeek, streak };
    }
    return next;
  },
};
