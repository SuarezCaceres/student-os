import type { SyncAdapter } from '../adapterTypes';

/**
 * STUB — lo rellena el agente GYM (Ola 3). No edites otros archivos compartidos.
 * Mientras sea un stub no sincroniza nada: `select` no emite registros y `apply` deja el estado intacto.
 */
export const gymAdapter: SyncAdapter = {
  collection: 'gym',
  select: () => [],
  apply: (state) => state,
};
