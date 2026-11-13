import type { SyncAdapter } from '../adapterTypes';

/**
 * STUB — lo rellena el agente CALENDAR (Ola 3). No edites otros archivos compartidos.
 * Mientras sea un stub no sincroniza nada: `select` no emite registros y `apply` deja el estado intacto.
 */
export const calendarAdapter: SyncAdapter = {
  collection: 'calendar',
  select: () => [],
  apply: (state) => state,
};
