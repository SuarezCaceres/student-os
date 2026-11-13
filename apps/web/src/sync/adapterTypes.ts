import type { Collection, SyncRecord } from '@student-os/shared';
import type { AppState } from '../types';

/**
 * Contrato que implementa cada modulo para sincronizar su parte de `AppState`.
 *
 * Propiedad: SYNC-WEB (Ola 2) puede refinarlo; los agentes de la Ola 3 lo tratan como SOLO LECTURA
 * y unicamente rellenan su archivo en `./adapters/`.
 *
 * Un adaptador es una funcion pura sobre el estado: sin I/O, sin React, sin red.
 */
export interface SyncAdapter {
  /** Coleccion del contrato compartido (`@student-os/shared`) a la que pertenecen sus registros. */
  collection: Collection;
  /**
   * Proyecta el estado local a registros de sync (uno por entidad, con `id` estable).
   * `updatedAt`/`rev`/`deletedAt` los gestiona el motor; aqui solo `id` y `data`.
   */
  select(state: AppState): Array<Pick<SyncRecord, 'id' | 'data'>>;
  /**
   * Aplica al estado los registros recibidos del servidor (ya validados contra el contrato).
   * Los registros con `deletedAt` no nulo deben eliminar la entidad. Debe devolver un estado NUEVO
   * (inmutable) y ser idempotente.
   */
  apply(state: AppState, records: SyncRecord[]): AppState;
}
