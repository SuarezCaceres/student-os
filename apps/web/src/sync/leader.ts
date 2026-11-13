/**
 * Eleccion de lider entre pestanas del mismo navegador (Web Locks API).
 * Solo la pestana lider ejecuta el motor de sync; las demas siguen el estado por el evento `storage`.
 * Sin Web Locks (jsdom, navegadores antiguos) la pestana actual se considera lider.
 */
interface LockManagerLike {
  request(
    name: string,
    options: { signal?: AbortSignal },
    callback: () => Promise<void>,
  ): Promise<unknown>;
}

export interface LeaderCallbacks {
  /** Se llama al obtener el liderazgo; devuelve la funcion que lo libera. */
  onLead: () => (() => void) | void;
  onFollow?: () => void;
}

export function runAsLeader(
  name: string,
  callbacks: LeaderCallbacks,
  locks: LockManagerLike | undefined = typeof navigator === 'undefined'
    ? undefined
    : (navigator as unknown as { locks?: LockManagerLike }).locks,
): () => void {
  if (!locks || typeof locks.request !== 'function') {
    const release = callbacks.onLead();
    return () => release?.();
  }

  const abort = new AbortController();
  let release: (() => void) | void;
  let finishHold: (() => void) | null = null;
  let cancelled = false;

  callbacks.onFollow?.();
  locks
    .request(name, { signal: abort.signal }, () => {
      if (cancelled) return Promise.resolve();
      return new Promise<void>((resolve) => {
        finishHold = resolve;
        release = callbacks.onLead();
      });
    })
    .catch(() => {
      // AbortError al cancelar mientras se esperaba el turno: es normal.
    });

  return () => {
    cancelled = true;
    abort.abort();
    release?.();
    release = undefined;
    finishHold?.();
  };
}
