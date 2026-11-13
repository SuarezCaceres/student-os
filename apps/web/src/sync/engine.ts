import { SyncRecordSchema, type Collection, type SyncRecord } from '@student-os/shared';
import type { AppState } from '../types';
import { ApiError, isApiError, type ApiStatus, type SyncTransport } from '../services/api';
import type { SyncAdapter } from './adapterTypes';
import { hashData, toPlainJson } from './hash';
import { syncDocKey, type SyncStorage } from './storage';
import {
  emptyDoc,
  keyOf,
  splitKey,
  type DataSummary,
  type DecisionChoice,
  type QueueEntry,
  type RecordKey,
  type RemoteSnapshot,
  type SyncBackup,
  type SyncDecision,
  type SyncDoc,
  type SyncPhase,
  type SyncStatus,
} from './types';

/**
 * Motor de sincronizacion local-first.
 *
 * Idea central: la UI y `localStorage` mandan en el dispositivo; el motor observa el estado, calcula
 * que registros cambiaron (diff por `id` contra el ultimo snapshot observado), los encola en
 * IndexedDB y los sube en segundo plano. Los registros remotos se aplican con `adapter.apply`.
 *
 * Invariantes:
 *  - Nada de lo que hace el motor bloquea la UI: todas las operaciones de red son asincronas y
 *    `observe()` es sincrono y barato.
 *  - Bucle eco: tras aplicar registros remotos, el snapshot se reconstruye desde el estado resultante,
 *    asi que lo recien recibido no se vuelve a subir.
 *  - Sin perdida durante un pull en vuelo: los registros se aplican sobre el estado MAS RECIENTE
 *    (`getState()` en el momento de aplicar), no sobre el que habia al iniciar la peticion; antes de
 *    aplicar se hace `observe()` para encolar cualquier edicion que aun no se hubiera visto.
 *  - Ultima edicion gana por `updatedAt`. Un cambio local pendiente mas reciente que el registro remoto
 *    se conserva; en empate manda el servidor.
 */

export interface SyncEngineOptions {
  /** Espera tras un cambio local antes de calcular el diff y encolar. */
  observeDebounceMs: number;
  /** Espera para agrupar ediciones antes de subirlas. */
  pushDebounceMs: number;
  /** Separacion minima entre pulls disparados por foco/visibilidad. */
  minPullIntervalMs: number;
  pageSize: number;
  pushBatchSize: number;
  /** Tope de bytes por lote de subida (el servidor acepta 1 MB por peticion). */
  pushBatchBytes: number;
  /** Reintentos del propio motor tras agotar los del cliente HTTP. */
  retryDelaysMs: number[];
  maxPushAttempts: number;
}

export const DEFAULT_ENGINE_OPTIONS: SyncEngineOptions = {
  observeDebounceMs: 200,
  pushDebounceMs: 1_500,
  minPullIntervalMs: 15_000,
  pageSize: 500,
  pushBatchSize: 200,
  pushBatchBytes: 500_000,
  retryDelaysMs: [5_000, 15_000, 30_000, 60_000],
  maxPushAttempts: 5,
};

export interface SyncEngineDeps {
  userId: string;
  adapters: SyncAdapter[];
  storage: SyncStorage;
  transport: SyncTransport;
  getState: () => AppState;
  /** Reemplaza el estado (sincrono: `getState()` debe devolver ya el valor nuevo). */
  setState: (next: AppState) => void;
  /** true si el estado es el de fabrica (nada que perder al reemplazarlo). */
  isPristine?: (state: AppState) => boolean;
  /** Descarga el respaldo; si lanza, la operacion destructiva se cancela. */
  saveBackup?: (backup: SyncBackup) => void | Promise<void>;
  /** Marca persistente "este usuario ya importo sus datos locales alguna vez". */
  hasImportedBefore?: () => boolean;
  markImported?: () => void;
  now?: () => number;
  isOnline?: () => boolean;
  options?: Partial<SyncEngineOptions>;
}

const persistChains = new WeakMap<SyncStorage, Map<string, Promise<void>>>();

interface Projected {
  collection: Collection;
  id: string;
  data: unknown;
  hash: string;
}

interface BootContext {
  remote: RemoteSnapshot;
  decision: SyncDecision;
}

function summarize(items: Array<{ collection: Collection }>): DataSummary {
  const byCollection: Partial<Record<Collection, number>> = {};
  for (const item of items) byCollection[item.collection] = (byCollection[item.collection] ?? 0) + 1;
  return { total: items.length, byCollection };
}

const iso = (ms: number) => new Date(ms).toISOString();

export class SyncEngine {
  private readonly deps: SyncEngineDeps;
  private readonly opts: SyncEngineOptions;
  private readonly adapters: SyncAdapter[];
  private readonly tracked: Set<Collection>;

  private doc: SyncDoc = emptyDoc();
  private loaded = false;
  private started = false;
  private stopped = false;
  private paused = false;
  private failed = false;
  private bootstrapping = false;

  private phase: SyncPhase = 'off';
  private error: string | null = null;
  private lastSyncAt: number | null = null;
  private decision: SyncDecision | null = null;
  private bootCtx: BootContext | null = null;
  private apiStatus: ApiStatus = 'idle';

  private wantPull = false;
  private wantPush = false;
  private running: Promise<void> | null = null;
  private lastPullAt = 0;
  private lastNotifyAt: number | null = null;
  private retryIndex = 0;

  private observeTimer: ReturnType<typeof setTimeout> | null = null;
  private pushTimer: ReturnType<typeof setTimeout> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly abort = new AbortController();
  private unsubscribeApi: (() => void) | null = null;
  private detachBrowser: (() => void) | null = null;

  private persistDirty = false;
  private persistPromise: Promise<void> | null = null;
  private readonly listeners = new Set<(status: SyncStatus) => void>();

  constructor(deps: SyncEngineDeps) {
    this.deps = deps;
    this.opts = { ...DEFAULT_ENGINE_OPTIONS, ...deps.options };
    this.adapters = deps.adapters;
    this.tracked = new Set(deps.adapters.map((a) => a.collection));
  }

  // --- API publica ------------------------------------------------------------

  getStatus(): SyncStatus {
    return {
      phase: this.phase,
      pending: Object.keys(this.doc.queue).length,
      rejected: Object.keys(this.doc.rejected).length,
      online: this.online(),
      waking: this.apiStatus === 'waking',
      apiStatus: this.apiStatus,
      lastSyncAt: this.lastSyncAt,
      error: this.error,
      decision: this.decision,
      follower: false,
    };
  }

  subscribe(listener: (status: SyncStatus) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Carga el documento persistido y arranca la sincronizacion en segundo plano. */
  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    this.setPhase('starting');
    this.apiStatus = this.deps.transport.getApiStatus?.() ?? 'idle';
    this.unsubscribeApi =
      this.deps.transport.subscribeApiStatus?.((status) => {
        this.apiStatus = status;
        this.emit();
      }) ?? null;

    const key = syncDocKey(this.deps.userId);
    await this.chain().get(key)?.catch(() => undefined);
    let stored: unknown;
    try {
      stored = await this.deps.storage.get(key);
    } catch (error) {
      console.warn('No se pudo leer la cola de sincronización:', error);
    }
    if (this.stopped) return;
    this.doc = this.isValidDoc(stored) ? stored : emptyDoc();
    this.loaded = true;

    // Proteccion: si el estado local volvio a "fabrica" (localStorage borrado) pero el snapshot
    // recuerda datos, NO lo interpretamos como "el usuario borro todo": se repite el importador.
    const state = this.deps.getState();
    if (this.doc.bootstrapped && this.deps.isPristine?.(state)) {
      const current = this.project(state);
      if (Object.keys(this.doc.snapshot).some((k) => !current.has(k))) {
        console.warn('El estado local se reinició; se vuelve a comparar con la nube en lugar de borrar.');
        this.doc.bootstrapped = false;
        this.doc.cursor = null;
        this.doc.snapshot = {};
        this.doc.versions = {};
      }
    }

    if (!this.doc.bootstrapped) {
      // Resuelve cuando el importador termino o quedo esperando una decision (nunca bloquea la UI:
      // el hook no espera este promise).
      await this.bootstrap();
      return;
    }
    this.beginNormalOperation();
  }

  /** Detiene timers, red y listeners. Captura las ultimas ediciones en la cola antes de salir. */
  async stop(): Promise<void> {
    if (this.stopped) return;
    if (this.loaded && this.doc.bootstrapped && !this.paused) this.observe();
    this.stopped = true;
    for (const timer of [this.observeTimer, this.pushTimer, this.retryTimer]) {
      if (timer) clearTimeout(timer);
    }
    this.observeTimer = this.pushTimer = this.retryTimer = null;
    this.abort.abort();
    this.detachBrowser?.();
    this.detachBrowser = null;
    this.unsubscribeApi?.();
    this.unsubscribeApi = null;
    if (this.loaded) this.schedulePersist();
    await this.flushPersist();
    this.phase = 'off';
    this.emit();
  }

  /** Avisa de que el estado cambio. El diff se calcula con un pequeno debounce. */
  notifyLocalChange(opts: { immediate?: boolean } = {}): void {
    if (!this.isTracking()) return;
    this.lastNotifyAt = this.now();
    if (opts.immediate) {
      this.observe();
      return;
    }
    if (this.observeTimer) return;
    this.observeTimer = setTimeout(() => {
      this.observeTimer = null;
      this.observe();
    }, this.opts.observeDebounceMs);
  }

  /** Sube lo pendiente y trae lo nuevo ahora mismo. Resuelve cuando el ciclo termina (con o sin error). */
  async syncNow(): Promise<void> {
    if (!this.isActive()) return;
    this.failed = false;
    this.retryIndex = 0;
    this.wantPull = true;
    this.wantPush = true;
    await this.drain(true);
  }

  /** Pide solo un pull (foco, visibilidad). */
  requestPull(): Promise<void> {
    if (!this.isActive()) return Promise.resolve();
    this.wantPull = true;
    return this.drain();
  }

  /** Reanuda tras "Ahora no" en el importador. */
  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    void this.bootstrap();
  }

  async resolveDecision(choice: DecisionChoice): Promise<void> {
    const ctx = this.bootCtx;
    if (!ctx || this.stopped) return;
    if (choice === 'skip') {
      this.decision = null;
      this.bootCtx = null;
      this.paused = true;
      this.error = null;
      this.setPhase('paused');
      return;
    }
    const allowed = ctx.decision.kind === 'upload' ? ['upload'] : ['cloud', 'local'];
    if (!allowed.includes(choice)) return;
    try {
      this.error = null;
      await this.completeBootstrap(ctx.remote, choice, { backup: true });
    } catch (error) {
      console.error('No se pudo completar la importación:', error);
      this.error = 'No pudimos guardar el respaldo, así que no se cambió nada. Inténtalo de nuevo.';
      this.emit();
    }
  }

  /** Engancha online/offline/foco/visibilidad. Devuelve la funcion para desengancharlos. */
  attachBrowserEvents(
    win: Pick<Window, 'addEventListener' | 'removeEventListener'> = window,
    doc: Pick<Document, 'addEventListener' | 'removeEventListener' | 'visibilityState'> = document,
  ): () => void {
    const onOnline = () => {
      this.failed = false;
      this.retryIndex = 0;
      this.emit();
      if (!this.doc.bootstrapped && this.loaded && !this.decision && !this.paused) {
        void this.bootstrap();
        return;
      }
      if (!this.isActive()) return;
      this.wantPull = true;
      this.wantPush = true;
      void this.drain(true);
    };
    const onOffline = () => {
      if (this.isActive()) this.setPhase('offline');
    };
    const maybePull = () => {
      if (!this.isActive()) return;
      if (this.now() - this.lastPullAt < this.opts.minPullIntervalMs) return;
      this.failed = false;
      this.wantPull = true;
      void this.drain(true);
    };
    const onVisibility = () => {
      if (doc.visibilityState === 'visible') {
        maybePull();
      } else if (this.isTracking()) {
        this.observe();
        void this.flushPersist();
      }
    };
    win.addEventListener('online', onOnline);
    win.addEventListener('offline', onOffline);
    win.addEventListener('focus', maybePull);
    doc.addEventListener('visibilitychange', onVisibility);
    this.detachBrowser = () => {
      win.removeEventListener('online', onOnline);
      win.removeEventListener('offline', onOffline);
      win.removeEventListener('focus', maybePull);
      doc.removeEventListener('visibilitychange', onVisibility);
    };
    return this.detachBrowser;
  }

  /** Espera a que el documento persistido este al dia (pruebas / cierre). */
  async flushPersist(): Promise<void> {
    while (this.persistPromise) await this.persistPromise;
  }

  // --- Utilidades internas ----------------------------------------------------

  private now(): number {
    return (this.deps.now ?? Date.now)();
  }

  private online(): boolean {
    if (this.deps.isOnline) return this.deps.isOnline();
    return typeof navigator === 'undefined' ? true : navigator.onLine !== false;
  }

  private chain(): Map<string, Promise<void>> {
    let map = persistChains.get(this.deps.storage);
    if (!map) {
      map = new Map();
      persistChains.set(this.deps.storage, map);
    }
    return map;
  }

  private isValidDoc(value: unknown): value is SyncDoc {
    const doc = value as Partial<SyncDoc> | undefined;
    return Boolean(
      doc && doc.v === 1 && typeof doc.bootstrapped === 'boolean' && doc.snapshot && doc.queue && doc.versions && doc.rejected,
    );
  }

  /** Observa cambios solo cuando el importador ya se resolvio. */
  private isTracking(): boolean {
    return this.started && this.loaded && !this.stopped && this.doc.bootstrapped && !this.paused;
  }

  private isActive(): boolean {
    return this.isTracking() && !this.decision;
  }

  private setPhase(phase: SyncPhase): void {
    this.phase = phase;
    this.emit();
  }

  private emit(): void {
    if (this.listeners.size === 0) return;
    const status = this.getStatus();
    this.listeners.forEach((l) => l(status));
  }

  private schedulePersist(): void {
    this.persistDirty = true;
    if (this.persistPromise || !this.loaded) return;
    const key = syncDocKey(this.deps.userId);
    const run = (async () => {
      while (this.persistDirty) {
        this.persistDirty = false;
        try {
          await this.deps.storage.set(key, this.doc);
        } catch (error) {
          console.warn('No se pudo guardar la cola de sincronización:', error);
        }
      }
    })().finally(() => {
      this.persistPromise = null;
      if (this.chain().get(key) === run) this.chain().delete(key);
    });
    this.persistPromise = run;
    this.chain().set(key, run);
  }

  private project(state: AppState): Map<RecordKey, Projected> {
    const out = new Map<RecordKey, Projected>();
    for (const adapter of this.adapters) {
      for (const rec of adapter.select(state)) {
        const key = keyOf(adapter.collection, rec.id);
        if (out.has(key)) console.warn(`Registro duplicado en el adaptador ${adapter.collection}: ${rec.id}`);
        out.set(key, { collection: adapter.collection, id: rec.id, data: rec.data, hash: hashData(rec.data) });
      }
    }
    return out;
  }

  // --- Diff local -> cola -------------------------------------------------------

  /** Calcula el diff contra el ultimo snapshot y encola altas/cambios/borrados. */
  private observe(): void {
    if (!this.isTracking()) return;
    let current: Map<RecordKey, Projected>;
    try {
      current = this.project(this.deps.getState());
    } catch (error) {
      console.error('Un adaptador de sync falló al leer el estado:', error);
      return;
    }
    const base = this.lastNotifyAt ?? this.now();
    this.lastNotifyAt = null;
    let changed = false;

    for (const [key, item] of current) {
      if (this.doc.snapshot[key] === item.hash) continue;
      this.enqueue(key, item.collection, item.id, toPlainJson(item.data), false, base);
      this.doc.snapshot[key] = item.hash;
      changed = true;
    }
    for (const key of Object.keys(this.doc.snapshot)) {
      if (current.has(key)) continue;
      const { collection, id } = splitKey(key);
      this.enqueue(key, collection, id, null, true, base);
      delete this.doc.snapshot[key];
      changed = true;
    }
    if (!changed) return;
    this.schedulePersist();
    this.emit();
    this.schedulePush();
  }

  private enqueue(key: RecordKey, collection: Collection, id: string, data: unknown, deleted: boolean, base: number): void {
    const existing = this.doc.queue[key];
    const known = this.doc.versions[key];
    // Siempre mas nuevo que lo que ya sabemos del servidor y que lo que ya teniamos en cola.
    const updatedAt = Math.max(base, (known?.u ?? 0) + 1, (existing?.updatedAt ?? 0) + 1);
    this.doc.queue[key] = {
      collection,
      id,
      data,
      deleted,
      updatedAt,
      rev: existing?.rev ?? known?.rev ?? 0,
      seq: ++this.doc.seq,
      attempts: 0,
    };
    delete this.doc.rejected[key];
  }

  private schedulePush(): void {
    if (this.pushTimer || !this.isActive()) return;
    this.pushTimer = setTimeout(() => {
      this.pushTimer = null;
      if (!this.isActive()) return;
      this.wantPush = true;
      void this.drain();
    }, this.opts.pushDebounceMs);
  }

  // --- Bucle de sincronizacion ---------------------------------------------------

  private drain(force = false): Promise<void> {
    if (this.running) return this.running;
    if (this.failed && !force) return Promise.resolve();
    const run = this.runLoop().finally(() => {
      if (this.running === run) this.running = null;
      if (!this.stopped && !this.failed && this.isActive() && (this.wantPull || this.wantPush)) void this.drain();
    });
    this.running = run;
    return run;
  }

  private async runLoop(): Promise<void> {
    while (!this.stopped && this.isActive() && (this.wantPull || this.wantPush)) {
      if (!this.online()) {
        this.handleCycleError(new ApiError('offline', 'Sin conexión a internet.'));
        return;
      }
      this.error = null;
      this.setPhase('syncing');
      try {
        if (this.wantPull) {
          this.wantPull = false;
          try {
            await this.pullAll();
          } catch (error) {
            this.wantPull = true;
            throw error;
          }
        }
        if (this.wantPush || Object.keys(this.doc.queue).length > 0) {
          this.wantPush = false;
          try {
            await this.pushAll();
          } catch (error) {
            this.wantPush = true;
            throw error;
          }
        }
        this.lastSyncAt = this.now();
        this.retryIndex = 0;
        this.failed = false;
        if (this.retryTimer) {
          clearTimeout(this.retryTimer);
          this.retryTimer = null;
        }
      } catch (error) {
        this.handleCycleError(error);
        return;
      }
    }
    if (!this.stopped && this.isActive()) this.setPhase('idle');
  }

  private handleCycleError(error: unknown): void {
    if (this.stopped) return;
    const api = isApiError(error) ? error : null;
    if (api?.kind === 'aborted') return;
    this.failed = true;
    if (api?.kind === 'auth' || api?.kind === 'not_configured') {
      this.error =
        api.kind === 'auth'
          ? 'Tu sesión expiró. Inicia sesión de nuevo para seguir sincronizando.'
          : 'La sincronización no está configurada.';
      this.setPhase('error');
      return;
    }
    if (!this.online() || api?.kind === 'offline') {
      this.error = null;
      this.setPhase('offline');
    } else {
      this.error = api?.message ?? 'No se pudo sincronizar. Lo reintentaremos.';
      this.setPhase('error');
    }
    const delays = this.opts.retryDelaysMs;
    const delay = api?.retryAfterMs ?? delays[Math.min(this.retryIndex, delays.length - 1)];
    this.retryIndex++;
    this.scheduleRetry(delay);
  }

  private scheduleRetry(delay: number): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (this.stopped) return;
      this.failed = false;
      if (!this.doc.bootstrapped && !this.decision && !this.paused) {
        void this.bootstrap();
        return;
      }
      if (this.isActive()) void this.drain(true);
    }, delay);
  }

  // --- Pull ----------------------------------------------------------------------

  private async pullAll(): Promise<void> {
    this.lastPullAt = this.now();
    for (let page = 0; page < 10_000; page++) {
      const res = await this.deps.transport.pull(
        { since: this.doc.cursor, limit: this.opts.pageSize },
        { signal: this.abort.signal },
      );
      if (this.stopped) return;
      if (res.invalid > 0) console.warn(`${res.invalid} registros remotos no cumplen el contrato y se ignoraron.`);
      this.applyRemote(res.records);
      const advanced = res.cursor !== this.doc.cursor;
      this.doc.cursor = res.cursor;
      this.schedulePersist();
      if (!res.hasMore || !advanced) break;
    }
  }

  /**
   * Aplica registros remotos al estado MAS RECIENTE. Devuelve true si algun registro se aplico.
   * `force` ignora la comprobacion de "version ya conocida" (conflictos y reemplazo total).
   */
  private applyRemote(records: SyncRecord[], opts: { replaceAll?: boolean; force?: boolean } = {}): boolean {
    if (this.doc.bootstrapped) this.observe();
    const state = this.deps.getState();
    const toApply: SyncRecord[] = [];
    const liveKeys = new Set<RecordKey>();

    for (const record of records) {
      if (!this.tracked.has(record.collection)) continue;
      const key = keyOf(record.collection, record.id);
      const t = Date.parse(record.updatedAt);
      if (record.deletedAt === null) liveKeys.add(key);
      const known = this.doc.versions[key];
      if (known && !opts.force && known.u >= t) {
        // Eco de nuestra propia subida o version vieja: nada que aplicar.
        if (known.u === t && record.rev > known.rev) known.rev = record.rev;
        if (known.o && t < known.u) {
          // El servidor recorta un updatedAt futuro (> ahora + 5 min): adoptamos el que nos devuelve.
          this.doc.versions[key] = { u: t, rev: record.rev, d: record.deletedAt !== null };
        } else if (known.o && known.u === t) {
          known.o = false;
          known.rev = Math.max(known.rev, record.rev);
        }
        continue;
      }
      const pending = this.doc.queue[key];
      if (pending && pending.updatedAt > t) {
        // Ultima edicion gana: la edicion local pendiente es mas reciente.
        pending.rev = Math.max(pending.rev, record.rev);
        continue;
      }
      delete this.doc.queue[key];
      this.doc.versions[key] = { u: t, rev: record.rev, d: record.deletedAt !== null };
      toApply.push(record);
    }

    if (opts.replaceAll) {
      // "Usar la nube": lo que solo existe en este dispositivo se elimina del estado.
      const stamp = iso(this.now());
      for (const [key, item] of this.project(state)) {
        if (liveKeys.has(key)) continue;
        toApply.push({ id: item.id, collection: item.collection, data: null, updatedAt: stamp, deletedAt: stamp, rev: 0 });
      }
    }

    if (toApply.length === 0) return false;

    const grouped = new Map<Collection, SyncRecord[]>();
    for (const record of toApply) {
      const list = grouped.get(record.collection) ?? [];
      list.push(record);
      grouped.set(record.collection, list);
    }
    let next = state;
    for (const adapter of this.adapters) {
      const list = grouped.get(adapter.collection);
      if (!list || list.length === 0) continue;
      try {
        next = adapter.apply(next, list);
      } catch (error) {
        console.error(`El adaptador ${adapter.collection} falló al aplicar registros remotos:`, error);
        this.error = 'Algunos cambios de la nube no se pudieron aplicar.';
      }
    }

    // Reconstruye el snapshot desde el estado resultante: asi lo recibido no se re-sube (anti-eco).
    const snapshot: Record<RecordKey, string> = {};
    for (const [key, item] of this.project(next)) snapshot[key] = item.hash;
    this.doc.snapshot = snapshot;
    if (next !== state) this.deps.setState(next);
    this.schedulePersist();
    this.emit();
    return true;
  }

  // --- Push ----------------------------------------------------------------------

  private toRecord(entry: QueueEntry): SyncRecord {
    return {
      id: entry.id,
      collection: entry.collection,
      data: entry.deleted ? null : entry.data,
      updatedAt: iso(entry.updatedAt),
      deletedAt: entry.deleted ? iso(entry.updatedAt) : null,
      rev: entry.rev,
    };
  }

  private async pushAll(): Promise<void> {
    this.observe();
    for (;;) {
      // El servidor limita el body a 1 MB: se parte por numero de cambios Y por bytes (~500 KB).
      const entries: QueueEntry[] = [];
      let bytes = 0;
      for (const entry of Object.values(this.doc.queue).sort((a, b) => a.seq - b.seq)) {
        if (entries.length >= this.opts.pushBatchSize) break;
        const size = JSON.stringify(this.toRecord(entry)).length;
        if (entries.length > 0 && bytes + size > this.opts.pushBatchBytes) break;
        entries.push(entry);
        bytes += size;
      }
      if (entries.length === 0) return;
      await this.pushBatch(entries);
      if (this.stopped) return;
    }
  }

  private reject(entry: QueueEntry, reason: string): void {
    const key = keyOf(entry.collection, entry.id);
    const current = this.doc.queue[key];
    if (current && current.seq === entry.seq) delete this.doc.queue[key];
    this.doc.rejected[key] = { collection: entry.collection, id: entry.id, reason, at: this.now() };
    console.warn(`Cambio rechazado (${key}): ${reason}`);
    this.schedulePersist();
    this.emit();
  }

  private async pushBatch(entries: QueueEntry[]): Promise<void> {
    const sendable: QueueEntry[] = [];
    for (const entry of entries) {
      const parsed = SyncRecordSchema.safeParse(this.toRecord(entry));
      if (parsed.success) sendable.push(entry);
      else this.reject(entry, `No cumple el contrato: ${parsed.error.issues[0]?.message ?? 'dato inválido'}`);
    }
    if (sendable.length === 0) return;

    let result;
    try {
      result = await this.deps.transport.push(sendable.map((e) => this.toRecord(e)), { signal: this.abort.signal });
    } catch (error) {
      if (isApiError(error) && error.kind === 'client' && error.status === 422) {
        // 422 = cuota de registros excedida: reintentar a ciegas no sirve. Se detiene y se avisa.
        this.failed = true;
        this.error = 'Llegaste al límite de registros de tu cuenta. Libera espacio para seguir sincronizando.';
        this.setPhase('error');
        throw new ApiError('aborted', this.error);
      }
      if (isApiError(error) && error.kind === 'client' && (error.status === 400 || error.status === 413)) {
        // Un 4xx (p. ej. 400/413/422): se divide el lote para aislar al registro culpable sin bloquear la cola.
        if (sendable.length === 1) {
          this.reject(sendable[0], `El servidor rechazó el cambio (${error.status ?? 'error'}).`);
          return;
        }
        const mid = Math.ceil(sendable.length / 2);
        await this.pushBatch(sendable.slice(0, mid));
        await this.pushBatch(sendable.slice(mid));
        return;
      }
      throw error;
    }
    if (this.stopped) return;

    const sentSeq = new Map<RecordKey, number>(sendable.map((e) => [keyOf(e.collection, e.id), e.seq]));
    const conflictKeys = new Set(result.conflicts.map((c) => keyOf(c.collection, c.id)));

    // Conflictos: el servidor tiene una version mas nueva; sustituye a nuestra entrada si no cambio en vuelo.
    for (const conflict of result.conflicts) {
      const key = keyOf(conflict.collection, conflict.id);
      const queued = this.doc.queue[key];
      if (queued && sentSeq.get(key) === queued.seq) delete this.doc.queue[key];
    }
    if (result.conflicts.length > 0) this.applyRemote(result.conflicts, { force: true });

    const applied = new Set(result.applied);
    for (const entry of sendable) {
      const key = keyOf(entry.collection, entry.id);
      if (conflictKeys.has(key)) continue;
      if (applied.has(entry.id)) {
        const current = this.doc.queue[key];
        this.doc.versions[key] = { u: entry.updatedAt, rev: entry.rev + 1, d: entry.deleted, o: true };
        if (current && current.seq === entry.seq) delete this.doc.queue[key];
        else if (current) current.rev = entry.rev + 1;
      } else {
        const current = this.doc.queue[key];
        if (current && current.seq === entry.seq) {
          current.attempts++;
          if (current.attempts >= this.opts.maxPushAttempts) {
            this.reject(current, 'El servidor no confirmó este cambio.');
          }
        }
      }
    }
    this.schedulePersist();
    this.emit();
  }

  // --- Importador de primer inicio de sesion --------------------------------------

  private async pullEverything(): Promise<RemoteSnapshot> {
    const records = new Map<RecordKey, SyncRecord>();
    let cursor: string | null = null;
    let invalid = 0;
    for (let page = 0; page < 10_000; page++) {
      const res = await this.deps.transport.pull({ since: cursor, limit: this.opts.pageSize }, { signal: this.abort.signal });
      invalid += res.invalid;
      for (const record of res.records) {
        const key = keyOf(record.collection, record.id);
        const prev = records.get(key);
        if (!prev || Date.parse(record.updatedAt) >= Date.parse(prev.updatedAt)) records.set(key, record);
      }
      const advanced = res.cursor !== cursor;
      cursor = res.cursor;
      if (!res.hasMore || !advanced) break;
    }
    return { records, cursor, invalid };
  }

  private async bootstrap(): Promise<void> {
    if (this.bootstrapping || this.stopped || this.doc.bootstrapped) return;
    this.bootstrapping = true;
    try {
      this.failed = false;
      if (!this.online()) {
        // Sin red no se puede comparar con la nube: se retoma con el evento `online`.
        this.setPhase('offline');
        return;
      }
      this.setPhase('starting');
      const remote = await this.pullEverything();
      if (this.stopped) return;
      await this.decideBootstrap(remote);
    } catch (error) {
      if (this.stopped) return;
      console.warn('No se pudo comparar con la nube; se reintentará:', error);
      this.handleCycleError(error);
    } finally {
      this.bootstrapping = false;
    }
  }

  private async decideBootstrap(remote: RemoteSnapshot): Promise<void> {
    const state = this.deps.getState();
    const local = this.project(state);
    const localHasData = local.size > 0 && !this.deps.isPristine?.(state);
    const live = [...remote.records.values()].filter((r) => r.deletedAt === null && this.tracked.has(r.collection));

    if (!localHasData && live.length === 0) return this.completeBootstrap(remote, 'adopt', { backup: false });

    if (localHasData && live.length === local.size) {
      const equal = live.every((r) => local.get(keyOf(r.collection, r.id))?.hash === hashData(r.data));
      if (equal) return this.completeBootstrap(remote, 'equal', { backup: false });
    }
    if (!localHasData) return this.completeBootstrap(remote, 'cloud', { backup: false });

    if (live.length === 0 && this.deps.hasImportedBefore?.()) {
      return this.completeBootstrap(remote, 'upload', { backup: false });
    }

    this.decision = {
      kind: live.length === 0 ? 'upload' : 'choose',
      local: summarize([...local.values()]),
      cloud: summarize(live),
    };
    this.bootCtx = { remote, decision: this.decision };
    this.error = null;
    this.setPhase('awaiting-decision');
  }

  private async saveBackup(kind: 'local' | 'cloud', reason: string, remote?: RemoteSnapshot): Promise<void> {
    if (!this.deps.saveBackup) return;
    const backup: SyncBackup = {
      app: 'StudentOS',
      version: 1,
      kind,
      reason,
      createdAt: iso(this.now()),
      userId: this.deps.userId,
    };
    if (kind === 'local') backup.state = this.deps.getState();
    else backup.records = [...(remote?.records.values() ?? [])].filter((r) => r.deletedAt === null);
    await this.deps.saveBackup(backup);
  }

  private async completeBootstrap(
    remote: RemoteSnapshot,
    choice: 'adopt' | 'equal' | 'cloud' | 'upload' | 'local',
    opts: { backup: boolean },
  ): Promise<void> {
    if (opts.backup) {
      // Si el respaldo falla, esto lanza y NO se cambia nada.
      if (choice !== 'adopt') await this.saveBackup('local', `Respaldo antes de elegir "${choice}"`);
      if (choice === 'local') await this.saveBackup('cloud', 'Respaldo de la nube antes de reemplazarla', remote);
    }
    if (this.stopped) return;

    const stampRemoteVersions = () => {
      for (const [key, record] of remote.records) {
        this.doc.versions[key] = { u: Date.parse(record.updatedAt), rev: record.rev, d: record.deletedAt !== null };
      }
    };

    this.decision = null;
    this.bootCtx = null;

    if (choice === 'cloud') {
      // Aplica y luego marca como resuelto (para que applyRemote no encole el estado que se reemplaza).
      this.applyRemote([...remote.records.values()], { replaceAll: true, force: true });
      this.doc.bootstrapped = true;
    } else if (choice === 'adopt' || choice === 'equal') {
      stampRemoteVersions();
      this.doc.snapshot = {};
      for (const [key, item] of this.project(this.deps.getState())) this.doc.snapshot[key] = item.hash;
      this.doc.bootstrapped = true;
    } else {
      // 'upload' y 'local': todo lo local se encola como alta (snapshot vacio) con marca de tiempo nueva.
      stampRemoteVersions();
      this.doc.snapshot = {};
      this.doc.bootstrapped = true;
      this.lastNotifyAt = this.now();
      this.observe();
      if (choice === 'local') {
        const current = this.project(this.deps.getState());
        const base = this.now();
        for (const record of remote.records.values()) {
          const key = keyOf(record.collection, record.id);
          if (record.deletedAt === null && this.tracked.has(record.collection) && !current.has(key)) {
            this.enqueue(key, record.collection, record.id, null, true, base);
          }
        }
      }
    }

    this.doc.cursor = remote.cursor;
    this.deps.markImported?.();
    this.schedulePersist();
    this.beginNormalOperation(choice !== 'adopt' && choice !== 'equal');
  }

  private beginNormalOperation(pullFirst = true): void {
    this.setPhase('idle');
    this.observe();
    this.wantPull = pullFirst;
    this.wantPush = Object.keys(this.doc.queue).length > 0;
    if (this.wantPull || this.wantPush) void this.drain(true);
  }
}

export function createSyncEngine(deps: SyncEngineDeps): SyncEngine {
  return new SyncEngine(deps);
}
