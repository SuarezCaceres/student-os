import { SyncRecordSchema, type SyncRecord } from '@student-os/shared';
import { initialData } from '../../data/initialData';
import { createApiClient, type ApiClient } from '../../services/api';
import type { AppState, KanbanItem } from '../../types';
import type { SyncAdapter } from '../adapterTypes';
import { createSyncEngine, type SyncEngine, type SyncEngineDeps } from '../engine';
import { stableStringify } from '../hash';
import { createMemoryStorage, type SyncStorage } from '../storage';
import type { SyncBackup } from '../types';

export const EMPTY_STATE: AppState = { ...initialData, kanbanItems: [] };

export function task(id: string, title = `Tarea ${id}`, extra: Partial<KanbanItem> = {}): KanbanItem {
  return { id, title, status: 'todo', category: 'personal', priority: 'media', createdAt: '2026-11-01', ...extra };
}

export const withTasks = (items: KanbanItem[]): AppState => ({ ...EMPTY_STATE, kanbanItems: items });

/** Adaptador falso de prueba (los reales son stubs hasta la Ola 3): proyecta `kanbanItems`. */
export const fakeKanbanAdapter: SyncAdapter = {
  collection: 'kanban',
  select: (state) => state.kanbanItems.map((item) => ({ id: item.id, data: item })),
  apply: (state, records) => {
    let items = state.kanbanItems;
    for (const record of records) {
      if (record.deletedAt !== null) {
        items = items.filter((i) => i.id !== record.id);
      } else {
        const data = record.data as KanbanItem;
        items = items.some((i) => i.id === record.id)
          ? items.map((i) => (i.id === record.id ? data : i))
          : [...items, data];
      }
    }
    return { ...state, kanbanItems: items };
  },
};

// --- Servidor simulado --------------------------------------------------------

export type Fault =
  | { type: 'status'; status: number; headers?: Record<string, string> }
  | { type: 'network' }
  | { type: 'hang' };

export class FakeServer {
  records = new Map<string, SyncRecord & { seq: number }>();
  seq = 0;
  requests: Array<{ method: string; path: string; body?: unknown }> = [];
  faults: Fault[] = [];
  validTokens = new Set<string>(['token-1']);
  /** Token que se considera valido tras un refresh. */
  refreshedToken = 'token-2';
  pushCount = 0;

  put(record: SyncRecord): void {
    this.records.set(`${record.collection}/${record.id}`, { ...record, seq: ++this.seq });
  }

  live(collection = 'kanban'): SyncRecord[] {
    return [...this.records.values()].filter((r) => r.collection === collection && r.deletedAt === null);
  }

  fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(String(input), 'http://api.test');
    const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    this.requests.push({ method, path: url.pathname, body });

    const fault = this.faults.shift();
    if (fault) {
      if (fault.type === 'network') throw new TypeError('fetch failed');
      if (fault.type === 'hang') {
        return new Promise<Response>((_, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        });
      }
      return new Response(JSON.stringify({ message: 'fault' }), { status: fault.status, headers: fault.headers });
    }

    const auth = new Headers(init?.headers).get('Authorization') ?? '';
    if (!this.validTokens.has(auth.replace('Bearer ', ''))) {
      return new Response('{}', { status: 401 });
    }

    if (url.pathname === '/sync/pull') {
      const since = Number(url.searchParams.get('since') ?? 0);
      const limit = Number(url.searchParams.get('limit') ?? 1000);
      const all = [...this.records.values()].filter((r) => r.seq > since).sort((a, b) => a.seq - b.seq);
      const page = all.slice(0, limit);
      const cursor = page.length > 0 ? page[page.length - 1].seq : since;
      return Response.json({
        records: page.map(({ seq: _seq, ...r }) => r),
        cursor: String(cursor),
        hasMore: all.length > page.length,
      });
    }

    if (url.pathname === '/sync/push') {
      this.pushCount++;
      const applied: string[] = [];
      const conflicts: SyncRecord[] = [];
      for (const change of (body as { changes: SyncRecord[] }).changes) {
        const parsed = SyncRecordSchema.safeParse(change);
        if (!parsed.success) return new Response(JSON.stringify({ message: 'invalid' }), { status: 400 });
        const key = `${change.collection}/${change.id}`;
        const current = this.records.get(key);
        if (current && Date.parse(current.updatedAt) > Date.parse(change.updatedAt)) {
          const { seq: _s, ...server } = current;
          conflicts.push(server);
        } else if (current && Date.parse(current.updatedAt) === Date.parse(change.updatedAt) && stableStringify(current.data) !== stableStringify(change.data)) {
          const { seq: _s, ...server } = current;
          conflicts.push(server);
        } else {
          if (!(current && Date.parse(current.updatedAt) === Date.parse(change.updatedAt))) {
            this.records.set(key, { ...change, rev: (current?.rev ?? 0) + 1, seq: ++this.seq });
          }
          applied.push(change.id);
        }
      }
      return Response.json({ applied, conflicts });
    }

    return new Response('{}', { status: 404 });
  };
}

// --- Dispositivo simulado -----------------------------------------------------

export interface DeviceOptions {
  server: FakeServer;
  userId?: string;
  initial?: AppState;
  storage?: SyncStorage;
  adapters?: SyncAdapter[];
  now?: () => number;
  online?: { value: boolean };
  engine?: Partial<SyncEngineDeps>;
  /** Cliente HTTP propio (por defecto uno con sleep instantaneo). */
  api?: ApiClient;
  token?: { value: string };
}

export const instantSleep = async () => undefined;

export function makeApi(server: FakeServer, token: { value: string } = { value: 'token-1' }, extra: Partial<Parameters<typeof createApiClient>[0]> = {}): ApiClient {
  return createApiClient({
    baseUrl: 'http://api.test',
    getAccessToken: async () => token.value,
    refreshSession: async () => {
      token.value = server.refreshedToken;
      return token.value;
    },
    onAuthFailure: () => undefined,
    fetchImpl: ((input: RequestInfo | URL, init?: RequestInit) => server.fetch(input, init)) as typeof fetch,
    sleep: instantSleep,
    random: () => 0.5,
    isOnline: () => true,
    ...extra,
  });
}

export interface Device {
  engine: SyncEngine;
  storage: SyncStorage;
  holder: { current: AppState };
  backups: SyncBackup[];
  edit: (fn: (state: AppState) => AppState) => void;
  start: () => Promise<void>;
  tasks: () => KanbanItem[];
}

export function createDevice(opts: DeviceOptions): Device {
  const holder = { current: opts.initial ?? EMPTY_STATE };
  const storage = opts.storage ?? createMemoryStorage();
  const backups: SyncBackup[] = [];
  const api = opts.api ?? makeApi(opts.server, opts.token, opts.online ? { isOnline: () => opts.online!.value } : {});
  const engine = createSyncEngine({
    userId: opts.userId ?? 'user-1',
    adapters: opts.adapters ?? [fakeKanbanAdapter],
    storage,
    transport: api,
    getState: () => holder.current,
    setState: (next) => {
      holder.current = next;
    },
    isPristine: (s) => stableStringify(s) === stableStringify(EMPTY_STATE),
    saveBackup: (b) => {
      backups.push(b);
    },
    now: opts.now,
    isOnline: opts.online ? () => opts.online!.value : () => true,
    options: { observeDebounceMs: 0, pushDebounceMs: 0, retryDelaysMs: [5, 5, 5], minPullIntervalMs: 0 },
    ...opts.engine,
  });
  return {
    engine,
    storage,
    holder,
    backups,
    edit: (fn) => {
      holder.current = fn(holder.current);
      engine.notifyLocalChange({ immediate: true });
    },
    start: async () => {
      await engine.start();
      await engine.syncNow();
    },
    tasks: () => holder.current.kanbanItems,
  };
}
