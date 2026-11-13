import { HttpException } from '@nestjs/common';
import { MAX_PULL_LIMIT, MAX_PUSH_CHANGES, type SyncRecord } from '@student-os/shared';
import type { SyncService } from '../../src/sync/sync.service';
import { MAX_RECORDS_PER_USER, MAX_RECORD_DATA_BYTES } from '../../src/sync/sync.constants';
import { NOW, at, kanbanData, kanbanRecord, newUserId, profileRecord, titleOf, tombstone } from './sync-fixtures';

export interface ScenarioContext {
  service: SyncService;
  /** Reloj del servidor simulado: mutable, `service` lo lee en cada operacion. */
  clock: { now: Date };
}

async function statusOf(promise: Promise<unknown>): Promise<{ status: number; message: string }> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof HttpException) {
      const body = error.getResponse() as { message?: string | string[] } | string;
      const raw = typeof body === 'string' ? body : (body.message ?? '');
      return { status: error.getStatus(), message: Array.isArray(raw) ? raw.join('\n') : raw };
    }
    throw error;
  }
  throw new Error('Se esperaba una HttpException y la operacion termino bien');
}

/** Todo lo que `pull` devuelve desde `since` hasta agotar paginas. */
async function pullAll(service: SyncService, userId: string, since?: string, collection?: string) {
  const records: SyncRecord[] = [];
  let cursor = since;
  for (let page = 0; page < 1000; page += 1) {
    const res = await service.pull(userId, { since: cursor, collection, limit: '100' });
    records.push(...res.records);
    cursor = res.cursor;
    if (!res.hasMore) return { records, cursor: cursor as string };
  }
  throw new Error('paginacion infinita');
}

/**
 * Escenarios de comportamiento del motor de sync. Se ejecutan contra el repositorio en memoria (siempre) y
 * contra Postgres real (embedded-postgres) para demostrar que ambas implementaciones cumplen el mismo contrato.
 */
export function defineSyncScenarios(label: string, setup: () => Promise<ScenarioContext>) {
  describe(`escenarios de sync [${label}]`, () => {
    let ctx: ScenarioContext;
    let A: string;
    let B: string;

    beforeEach(async () => {
      ctx = await setup();
      ctx.clock.now = new Date(NOW);
      A = newUserId();
      B = newUserId();
    });

    const push = (user: string, ...changes: SyncRecord[]) => ctx.service.push(user, { changes });

    describe('ultima edicion gana (LWW)', () => {
      it('un registro nuevo se aplica, queda con rev 1 y se ve en el pull', async () => {
        const res = await push(A, kanbanRecord('t1', at(-10), 'Primera'));
        expect(res).toEqual({ applied: ['t1'], conflicts: [] });
        const pulled = await pullAll(ctx.service, A);
        expect(pulled.records).toHaveLength(1);
        expect(pulled.records[0]).toMatchObject({ id: 't1', collection: 'kanban', rev: 1, deletedAt: null });
        expect(titleOf(pulled.records[0])).toBe('Primera');
        expect(pulled.records[0].updatedAt).toBe(at(-10));
      });

      it('un cambio MAS NUEVO gana: se aplica y sube rev', async () => {
        await push(A, kanbanRecord('t1', at(-10), 'v1'));
        const res = await push(A, kanbanRecord('t1', at(-5), 'v2'));
        expect(res).toEqual({ applied: ['t1'], conflicts: [] });
        const { records } = await pullAll(ctx.service, A);
        expect(records).toHaveLength(1);
        expect(titleOf(records[0])).toBe('v2');
        expect(records[0].rev).toBe(2);
      });

      it('un cambio MAS ANTIGUO pierde: entra en conflicts con la version del servidor y no cambia nada', async () => {
        await push(A, kanbanRecord('t1', at(-5), 'servidor'));
        const res = await push(A, kanbanRecord('t1', at(-20), 'viejo'));
        expect(res.applied).toEqual([]);
        expect(res.conflicts).toHaveLength(1);
        expect(res.conflicts[0]).toMatchObject({ id: 't1', rev: 1, updatedAt: at(-5) });
        expect(titleOf(res.conflicts[0])).toBe('servidor');
        const { records } = await pullAll(ctx.service, A);
        expect(titleOf(records[0])).toBe('servidor');
        expect(records[0].rev).toBe(1);
      });

      it('mismo updatedAt con contenido distinto: conflicto (empate favorece al servidor)', async () => {
        await push(A, kanbanRecord('t1', at(-5), 'servidor'));
        const res = await push(A, kanbanRecord('t1', at(-5), 'otro'));
        expect(res.applied).toEqual([]);
        expect(titleOf(res.conflicts[0])).toBe('servidor');
      });

      it('dos clientes: el que edita despues gana aunque su push llegue primero', async () => {
        // Cliente 2 (offline) edita a las -5 pero llega primero; cliente 1 edito a las -30 y llega tarde.
        await push(A, kanbanRecord('t1', at(-5), 'cliente2'));
        const late = await push(A, kanbanRecord('t1', at(-30), 'cliente1'));
        expect(late.conflicts).toHaveLength(1);
        const { records } = await pullAll(ctx.service, A);
        expect(titleOf(records[0])).toBe('cliente2');
      });

      it('el rev del cliente se ignora: manda el servidor', async () => {
        await push(A, { ...kanbanRecord('t1', at(-10), 'v1'), rev: 99 });
        const { records } = await pullAll(ctx.service, A);
        expect(records[0].rev).toBe(1);
      });
    });

    describe('idempotencia', () => {
      it('reenviar el mismo cambio no duplica, no cambia rev y no genera nada nuevo en el pull', async () => {
        const change = kanbanRecord('t1', at(-10), 'v1');
        await push(A, change);
        const first = await pullAll(ctx.service, A);

        const again = await push(A, change);
        expect(again).toEqual({ applied: ['t1'], conflicts: [] });

        const second = await pullAll(ctx.service, A);
        expect(second.records).toHaveLength(1);
        expect(second.records[0].rev).toBe(1);
        // Cursor intacto: no se asigno ningun seq nuevo, asi que otro dispositivo no vuelve a descargarlo.
        expect(second.cursor).toBe(first.cursor);
        expect((await pullAll(ctx.service, A, first.cursor)).records).toEqual([]);
      });

      it('el orden de claves del JSON no importa para detectar el reenvio', async () => {
        await push(A, kanbanRecord('t1', at(-10), 'v1'));
        const reordered: SyncRecord = {
          ...kanbanRecord('t1', at(-10), 'v1'),
          data: { createdAt: '2026-11-01', priority: 'media', category: 'universidad', status: 'todo', title: 'v1', id: 't1' },
        };
        await push(A, reordered);
        const { records } = await pullAll(ctx.service, A);
        expect(records[0].rev).toBe(1);
      });

      it('dos cambios con el mismo id en un push se evaluan en orden y el mas nuevo gana', async () => {
        const res = await push(A, kanbanRecord('t1', at(-20), 'a'), kanbanRecord('t1', at(-10), 'b'), kanbanRecord('t1', at(-15), 'c'));
        expect(res.applied).toEqual(['t1']);
        expect(res.conflicts).toHaveLength(1);
        const { records } = await pullAll(ctx.service, A);
        expect(records).toHaveLength(1);
        expect(titleOf(records[0])).toBe('b');
      });
    });

    describe('borrado logico (tombstones)', () => {
      it('un borrado mas nuevo se aplica, se conserva el tombstone y el pull lo devuelve con data null', async () => {
        await push(A, kanbanRecord('t1', at(-10), 'v1'));
        const res = await push(A, tombstone('t1', at(-5)));
        expect(res.applied).toEqual(['t1']);
        const { records } = await pullAll(ctx.service, A);
        expect(records).toHaveLength(1);
        expect(records[0]).toMatchObject({ id: 't1', data: null, deletedAt: at(-5), rev: 2 });
      });

      it('el tombstone anula data aunque el cliente la envie', async () => {
        await push(A, { ...kanbanRecord('t1', at(-5), 'secreto'), deletedAt: at(-5) });
        const { records } = await pullAll(ctx.service, A);
        expect(records[0].data).toBeNull();
        expect(records[0].deletedAt).toBe(at(-5));
      });

      it('un borrado mas antiguo que la edicion del servidor pierde (conflicto)', async () => {
        await push(A, kanbanRecord('t1', at(-5), 'editado despues'));
        const res = await push(A, tombstone('t1', at(-20)));
        expect(res.applied).toEqual([]);
        expect(res.conflicts[0]).toMatchObject({ id: 't1', deletedAt: null });
      });

      it('una edicion mas nueva "revive" un tombstone', async () => {
        await push(A, tombstone('t1', at(-20)));
        const res = await push(A, kanbanRecord('t1', at(-5), 'de vuelta'));
        expect(res.applied).toEqual(['t1']);
        const { records } = await pullAll(ctx.service, A);
        expect(records[0]).toMatchObject({ deletedAt: null, rev: 2 });
        expect(titleOf(records[0])).toBe('de vuelta');
      });

      it('borrar dos veces es idempotente (rev no cambia)', async () => {
        await push(A, tombstone('t1', at(-10)));
        await push(A, tombstone('t1', at(-10)));
        await push(A, tombstone('t1', at(-3)));
        const { records } = await pullAll(ctx.service, A);
        expect(records).toHaveLength(1);
        expect(records[0].rev).toBe(1);
      });

      it('un tombstone de algo que el servidor nunca vio se conserva', async () => {
        await push(A, tombstone('fantasma', at(-1)));
        const { records } = await pullAll(ctx.service, A);
        expect(records).toHaveLength(1);
        expect(records[0].deletedAt).not.toBeNull();
      });
    });

    describe('defensa contra reloj adelantado', () => {
      it('un updatedAt mas alla de ahora + 5 min se recorta a ahora', async () => {
        await push(A, kanbanRecord('t1', at(60), 'futuro'));
        const { records } = await pullAll(ctx.service, A);
        expect(records[0].updatedAt).toBe(NOW.toISOString());
      });

      it('un updatedAt dentro de la tolerancia (ahora + 4 min) se respeta', async () => {
        await push(A, kanbanRecord('t1', at(4), 'casi futuro'));
        const { records } = await pullAll(ctx.service, A);
        expect(records[0].updatedAt).toBe(at(4));
      });

      it('un cliente con reloj adelantado no puede "congelar" el registro: una edicion honesta posterior gana', async () => {
        await push(A, kanbanRecord('t1', at(24 * 60), 'reloj loco'));
        ctx.clock.now = new Date(NOW.getTime() + 10 * 60_000); // pasan 10 minutos en el servidor
        const res = await push(A, kanbanRecord('t1', at(8), 'edicion honesta'));
        expect(res.applied).toEqual(['t1']);
        const { records } = await pullAll(ctx.service, A);
        expect(titleOf(records[0])).toBe('edicion honesta');
      });

      it('reintentar el mismo cambio con fecha futura (otro "ahora") sigue siendo idempotente', async () => {
        const change = kanbanRecord('t1', at(90), 'futuro');
        await push(A, change);
        ctx.clock.now = new Date(NOW.getTime() + 60_000);
        const again = await push(A, change);
        expect(again.applied).toEqual(['t1']);
        const { records } = await pullAll(ctx.service, A);
        expect(records[0].rev).toBe(1);
      });

      it('un deletedAt futuro tambien se recorta', async () => {
        await push(A, { ...tombstone('t1', at(-1)), deletedAt: at(600) });
        const { records } = await pullAll(ctx.service, A);
        expect(records[0].deletedAt).toBe(NOW.toISOString());
      });
    });

    describe('aislamiento entre usuarios', () => {
      it('A y B pueden usar el mismo id sin pisarse y cada uno solo ve lo suyo', async () => {
        await push(A, kanbanRecord('mismo-id', at(-10), 'de A'));
        await push(B, kanbanRecord('mismo-id', at(-20), 'de B'));

        const a = await pullAll(ctx.service, A);
        const b = await pullAll(ctx.service, B);
        expect(a.records.map(titleOf)).toEqual(['de A']);
        expect(b.records.map(titleOf)).toEqual(['de B']);
      });

      it('B no puede sobrescribir el registro de A (ni siquiera con un updatedAt mas nuevo)', async () => {
        await push(A, kanbanRecord('t1', at(-10), 'de A'));
        const res = await push(B, kanbanRecord('t1', at(-1), 'de B'));
        expect(res.conflicts).toEqual([]); // para B es un registro nuevo, no un conflicto con A
        expect(titleOf((await pullAll(ctx.service, A)).records[0])).toBe('de A');
        expect((await pullAll(ctx.service, A)).records[0].rev).toBe(1);
      });

      it('un conflicto de B nunca revela datos de A', async () => {
        await push(A, kanbanRecord('t1', at(-1), 'PRIVADO-DE-A'));
        await push(B, kanbanRecord('t1', at(-30), 'de B'));
        const res = await push(B, kanbanRecord('t1', at(-40), 'viejo de B'));
        expect(JSON.stringify(res)).not.toContain('PRIVADO-DE-A');
      });

      it('B no ve nada de A, ni tombstones, ni con un cursor mas bajo', async () => {
        await push(A, kanbanRecord('t1', at(-10)), tombstone('t2', at(-10)));
        expect((await pullAll(ctx.service, B, '0')).records).toEqual([]);
        expect((await pullAll(ctx.service, B)).records).toEqual([]);
      });

      it('los cursores son por usuario: el seq de A no afecta al de B', async () => {
        await push(A, kanbanRecord('a1', at(-10)), kanbanRecord('a2', at(-10)), kanbanRecord('a3', at(-10)));
        await push(B, kanbanRecord('b1', at(-10)));
        const b = await pullAll(ctx.service, B);
        expect(b.cursor).toBe('1');
        const a = await pullAll(ctx.service, A);
        expect(a.cursor).toBe('3');
      });

      it('deleteAllForUser borra solo los datos del usuario indicado', async () => {
        await push(A, kanbanRecord('t1', at(-10)), tombstone('t2', at(-10)));
        await push(B, kanbanRecord('t1', at(-10)));
        const removed = await ctx.service.deleteAllForUser(A);
        expect(removed).toBe(2);
        expect((await pullAll(ctx.service, A)).records).toEqual([]);
        expect((await pullAll(ctx.service, B)).records).toHaveLength(1);
      });
    });

    describe('limites', () => {
      it('un data de mas de MAX_RECORD_DATA_BYTES se rechaza con 413 y no escribe nada', async () => {
        const big = kanbanRecord('t1', at(-1), 'x'.repeat(MAX_RECORD_DATA_BYTES + 1));
        const error = await statusOf(push(A, kanbanRecord('ok', at(-1)), big));
        expect(error.status).toBe(413);
        expect(error.message).toContain('t1');
        expect((await pullAll(ctx.service, A)).records).toEqual([]);
      });

      it('un data justo bajo el limite se acepta', async () => {
        const base = JSON.stringify(kanbanData('', { id: 't1' })).length;
        const record = kanbanRecord('t1', at(-1), 'x'.repeat(MAX_RECORD_DATA_BYTES - base - 10));
        const res = await push(A, record);
        expect(res.applied).toEqual(['t1']);
      });

      it('mas de MAX_PUSH_CHANGES cambios en una peticion -> 413', async () => {
        const changes = Array.from({ length: MAX_PUSH_CHANGES + 1 }, (_, i) => kanbanRecord(`t${i}`, at(-1)));
        const error = await statusOf(ctx.service.push(A, { changes }));
        expect(error.status).toBe(413);
        expect(error.message).toContain(String(MAX_PUSH_CHANGES));
      });

      it('exactamente MAX_PUSH_CHANGES cambios se acepta', async () => {
        const changes = Array.from({ length: MAX_PUSH_CHANGES }, (_, i) => kanbanRecord(`t${i}`, at(-1)));
        const res = await ctx.service.push(A, { changes });
        expect(res.applied).toHaveLength(MAX_PUSH_CHANGES);
      });

      it('la cuota por usuario (MAX_RECORDS_PER_USER) rechaza con 422 y deja todo intacto', async () => {
        for (let start = 0; start < MAX_RECORDS_PER_USER; start += MAX_PUSH_CHANGES) {
          const changes = Array.from({ length: MAX_PUSH_CHANGES }, (_, i) => kanbanRecord(`t${start + i}`, at(-1)));
          await ctx.service.push(A, { changes });
        }
        // Una fila mas -> 422.
        const error = await statusOf(push(A, kanbanRecord('uno-mas', at(-1))));
        expect(error.status).toBe(422);
        expect(error.message).toContain(String(MAX_RECORDS_PER_USER));
        // Editar lo existente SIGUE permitido (no crea filas) y mezclarlo con una nueva se rechaza ATOMICAMENTE.
        expect((await push(A, kanbanRecord('t0', at(-0.5), 'editado'))).applied).toEqual(['t0']);
        const mixed = await statusOf(push(A, kanbanRecord('t1', at(-0.5), 'tampoco'), kanbanRecord('nueva', at(-1))));
        expect(mixed.status).toBe(422);
        const all = await pullAll(ctx.service, A);
        expect(all.records).toHaveLength(MAX_RECORDS_PER_USER);
        expect(titleOf(all.records.find((r) => r.id === 't1') as SyncRecord)).toBe('Tarea t1');
        // La cuota es por usuario: B no se ve afectado.
        expect((await push(B, kanbanRecord('t0', at(-1)))).applied).toEqual(['t0']);
      }, 120_000);
    });

    describe('validacion de payload', () => {
      it.each([
        ['cuerpo ausente', undefined],
        ['cuerpo no objeto', 'hola'],
        ['sin changes', {}],
        ['changes no es array', { changes: 'x' }],
      ])('rechaza con 400: %s', async (_name, body) => {
        expect((await statusOf(ctx.service.push(A, body))).status).toBe(400);
      });

      it('rechaza una coleccion desconocida', async () => {
        const bad = { ...kanbanRecord('t1', at(-1)), collection: 'hackers' };
        expect((await statusOf(ctx.service.push(A, { changes: [bad] }))).status).toBe(400);
      });

      it('rechaza `data` que no cumple el esquema de su coleccion, sin eco del valor enviado', async () => {
        const bad = kanbanRecord('t1', at(-1));
        (bad.data as Record<string, unknown>).status = 'VALOR-SECRETO-INVENTADO';
        const error = await statusOf(ctx.service.push(A, { changes: [bad] }));
        expect(error.status).toBe(400);
        expect(error.message).toContain('changes[0].data.status');
        expect(error.message).not.toContain('VALOR-SECRETO-INVENTADO');
        expect(error.message).not.toMatch(/prisma|postgres|select |stack/i);
      });

      it('rechaza data de otra coleccion (un kanban enviado como profile)', async () => {
        const bad: SyncRecord = { ...kanbanRecord('profile', at(-1)), collection: 'profile' };
        expect((await statusOf(ctx.service.push(A, { changes: [bad] }))).status).toBe(400);
      });

      it('rechaza fechas invalidas, ids vacios o demasiado largos', async () => {
        for (const bad of [
          { ...kanbanRecord('t1', 'ayer') },
          { ...kanbanRecord('', at(-1)) },
          { ...kanbanRecord('x'.repeat(201), at(-1)) },
          { ...kanbanRecord('t1', at(-1)), deletedAt: 'nunca' },
        ]) {
          expect((await statusOf(ctx.service.push(A, { changes: [bad] }))).status).toBe(400);
        }
      });

      it('si un cambio es invalido no se aplica NINGUNO del lote', async () => {
        const bad = { ...kanbanRecord('t2', at(-1)), collection: 'nope' };
        await statusOf(ctx.service.push(A, { changes: [kanbanRecord('t1', at(-1)), bad] }));
        expect((await pullAll(ctx.service, A)).records).toEqual([]);
      });

      it('descarta las claves desconocidas dentro de data (solo se guarda lo del contrato)', async () => {
        const noisy = kanbanRecord('t1', at(-1));
        (noisy.data as Record<string, unknown>).campoExtra = 'basura';
        await push(A, noisy);
        const { records } = await pullAll(ctx.service, A);
        expect(records[0].data).not.toHaveProperty('campoExtra');
      });

      it('ignora un userId enviado en el cuerpo: los datos son del usuario autenticado', async () => {
        await ctx.service.push(A, { userId: B, changes: [{ ...kanbanRecord('t1', at(-1)), userId: B }] });
        expect((await pullAll(ctx.service, B)).records).toEqual([]);
        expect((await pullAll(ctx.service, A)).records).toHaveLength(1);
      });

      it('valida la query de pull (limit, cursor, coleccion)', async () => {
        for (const query of [
          { limit: '0' },
          { limit: String(MAX_PULL_LIMIT + 1) },
          { limit: 'abc' },
          { since: 'no-es-un-cursor' },
          { since: '-1' },
          { since: ['1', '2'] },
          { collection: 'nope' },
        ]) {
          expect((await statusOf(ctx.service.pull(A, query))).status).toBe(400);
        }
      });
    });

    describe('pull, paginacion y cursor', () => {
      async function seed(count: number) {
        const changes = Array.from({ length: count }, (_, i) => kanbanRecord(`t${i}`, at(-100 + i), `v${i}`));
        await ctx.service.push(A, { changes });
      }

      it('sin registros devuelve cursor 0 y hasMore false', async () => {
        expect(await ctx.service.pull(A, {})).toEqual({ records: [], cursor: '0', hasMore: false });
      });

      it('un pull vacio conserva el cursor recibido', async () => {
        await seed(2);
        const first = await ctx.service.pull(A, {});
        const next = await ctx.service.pull(A, { since: first.cursor });
        expect(next).toEqual({ records: [], cursor: first.cursor, hasMore: false });
      });

      it('pagina con limit: 3 + 3 + 1, hasMore correcto y sin repetidos ni huecos', async () => {
        await seed(7);
        const p1 = await ctx.service.pull(A, { limit: '3' });
        expect(p1.records).toHaveLength(3);
        expect(p1.hasMore).toBe(true);
        const p2 = await ctx.service.pull(A, { since: p1.cursor, limit: '3' });
        expect(p2.records).toHaveLength(3);
        expect(p2.hasMore).toBe(true);
        const p3 = await ctx.service.pull(A, { since: p2.cursor, limit: '3' });
        expect(p3.records).toHaveLength(1);
        expect(p3.hasMore).toBe(false);
        const ids = [...p1.records, ...p2.records, ...p3.records].map((r) => r.id);
        expect(ids).toEqual(['t0', 't1', 't2', 't3', 't4', 't5', 't6']);
      });

      it('un limit exacto al total no marca hasMore', async () => {
        await seed(3);
        const res = await ctx.service.pull(A, { limit: '3' });
        expect(res.records).toHaveLength(3);
        expect(res.hasMore).toBe(false);
      });

      it('el cursor avanza por orden de ESCRITURA en el servidor, no por el updatedAt del cliente', async () => {
        // Una edicion con updatedAt "antiguo" (offline) escrita DESPUES debe llegar a quien ya paso por el cursor.
        await push(A, kanbanRecord('a', at(-1), 'a'));
        const seen = await ctx.service.pull(A, {});
        await push(A, kanbanRecord('b', at(-500), 'b editado offline hace horas'));
        const next = await ctx.service.pull(A, { since: seen.cursor });
        expect(next.records.map((r) => r.id)).toEqual(['b']);
      });

      it('escrituras intercaladas durante la paginacion: nada se pierde y lo modificado reaparece UNA vez', async () => {
        await seed(6); // t0..t5
        const p1 = await ctx.service.pull(A, { limit: '2' }); // t0, t1
        expect(p1.records.map((r) => r.id)).toEqual(['t0', 't1']);

        // Entre paginas: se edita uno ya visto (t0), se edita uno por venir (t4) y llega uno nuevo (nuevo).
        await push(A, kanbanRecord('t0', at(-1), 't0 editado'), kanbanRecord('t4', at(-1), 't4 editado'), kanbanRecord('nuevo', at(-1)));

        const rest: SyncRecord[] = [];
        let cursor = p1.cursor;
        for (let guard = 0; guard < 20; guard += 1) {
          const res = await ctx.service.pull(A, { since: cursor, limit: '2' });
          rest.push(...res.records);
          cursor = res.cursor;
          if (!res.hasMore) break;
        }
        const ids = rest.map((r) => r.id);
        // t2, t3, t5 (sin tocar) + t0, t4, nuevo (reescritos, con seq nuevo). t4 aparece una sola vez.
        expect([...ids].sort()).toEqual(['nuevo', 't0', 't2', 't3', 't4', 't5']);
        expect(new Set(ids).size).toBe(ids.length);
        expect(titleOf(rest.find((r) => r.id === 't0') as SyncRecord)).toBe('t0 editado');
        expect(titleOf(rest.find((r) => r.id === 't4') as SyncRecord)).toBe('t4 editado');

        // Reconstruyendo estado con lo visto (p1 + rest) el cliente converge al estado del servidor.
        const merged = new Map<string, SyncRecord>();
        for (const r of [...p1.records, ...rest]) merged.set(r.id, r);
        const truth = await pullAll(ctx.service, A);
        for (const r of truth.records) expect(merged.get(r.id)).toEqual(r);
        expect(merged.size).toBe(truth.records.length);
      });

      it('los cursores son estrictamente crecientes', async () => {
        const cursors: bigint[] = [];
        for (let i = 0; i < 5; i += 1) {
          await push(A, kanbanRecord(`t${i}`, at(-10 + i)));
          cursors.push(BigInt((await pullAll(ctx.service, A)).cursor));
        }
        for (let i = 1; i < cursors.length; i += 1) expect(cursors[i]).toBeGreaterThan(cursors[i - 1]);
      });

      it('filtra por coleccion y el cursor sigue siendo global', async () => {
        await push(A, kanbanRecord('t1', at(-10)), profileRecord(at(-10)), kanbanRecord('t2', at(-10)));
        const onlyProfile = await pullAll(ctx.service, A, undefined, 'profile');
        expect(onlyProfile.records.map((r) => r.id)).toEqual(['profile']);
        const onlyKanban = await pullAll(ctx.service, A, undefined, 'kanban');
        expect(onlyKanban.records.map((r) => r.id)).toEqual(['t1', 't2']);
      });

      it('el mismo id en colecciones distintas son registros distintos', async () => {
        const kanban = kanbanRecord('x', at(-10), 'en kanban');
        const profile: SyncRecord = { ...profileRecord(at(-10)), id: 'x' };
        const res = await push(A, kanban, profile);
        expect(res.conflicts).toEqual([]);
        expect((await pullAll(ctx.service, A)).records).toHaveLength(2);
      });

      it('incluye tombstones en el pull incremental', async () => {
        await push(A, kanbanRecord('t1', at(-10)));
        const seen = await ctx.service.pull(A, {});
        await push(A, tombstone('t1', at(-5)));
        const next = await ctx.service.pull(A, { since: seen.cursor });
        expect(next.records).toHaveLength(1);
        expect(next.records[0]).toMatchObject({ id: 't1', data: null, deletedAt: at(-5) });
      });
    });

    describe('concurrencia', () => {
      it('pushes simultaneos del mismo usuario: no se pierde nada y los cursores no se solapan', async () => {
        const writers = Array.from({ length: 8 }, (_, w) =>
          ctx.service.push(A, {
            changes: Array.from({ length: 25 }, (_, i) => kanbanRecord(`w${w}-${i}`, at(-10), `w${w}-${i}`)),
          }),
        );
        const results = await Promise.all(writers);
        expect(results.every((r) => r.conflicts.length === 0 && r.applied.length === 25)).toBe(true);

        const all = await pullAll(ctx.service, A);
        expect(all.records).toHaveLength(8 * 25);
        expect(all.cursor).toBe(String(8 * 25)); // seq 1..200 sin huecos ni repetidos
        // Paginar con paginas pequenas recorre exactamente lo mismo.
        const seen = new Set<string>();
        let cursor: string | undefined;
        for (let guard = 0; guard < 500; guard += 1) {
          const res = await ctx.service.pull(A, { since: cursor, limit: '7' });
          for (const r of res.records) seen.add(r.id);
          cursor = res.cursor;
          if (!res.hasMore) break;
        }
        expect(seen.size).toBe(200);
      }, 60_000);

      it('escritores concurrentes sobre la misma clave: gana el updatedAt mas alto, sea cual sea el orden de llegada', async () => {
        const edits = Array.from({ length: 6 }, (_, i) => push(A, kanbanRecord('t1', at(-60 + i * 10), `edicion-${i}`)));
        await Promise.all(edits);
        const { records } = await pullAll(ctx.service, A);
        expect(records).toHaveLength(1);
        expect(titleOf(records[0])).toBe('edicion-5');
      }, 60_000);

      it('un lector concurrente nunca se salta un registro confirmado', async () => {
        // Mientras se escriben lotes, un lector pagina continuamente. Al final, lo que acumulo + un ultimo pull
        // desde su cursor debe cubrir TODOS los registros escritos.
        const seen = new Set<string>();
        let cursor: string | undefined;
        let writing = true;
        const reader = (async () => {
          while (writing) {
            const res = await ctx.service.pull(A, { since: cursor, limit: '10' });
            res.records.forEach((r) => seen.add(r.id));
            cursor = res.cursor;
            await new Promise((resolve) => setImmediate(resolve)); // cede el turno a los escritores
          }
        })();
        for (let batch = 0; batch < 6; batch += 1) {
          await Promise.all(
            [0, 1, 2].map((w) =>
              push(A, ...Array.from({ length: 10 }, (_, i) => kanbanRecord(`b${batch}-w${w}-${i}`, at(-10)))),
            ),
          );
        }
        writing = false;
        await reader;
        for (let guard = 0; guard < 100; guard += 1) {
          const res = await ctx.service.pull(A, { since: cursor, limit: '10' });
          res.records.forEach((r) => seen.add(r.id));
          cursor = res.cursor;
          if (!res.hasMore) break;
        }
        expect(seen.size).toBe(6 * 3 * 10);
      }, 60_000);
    });

    describe('perfil de usuario', () => {
      it('la primera peticion autenticada crea el perfil (push y pull), de forma idempotente', async () => {
        await ctx.service.pull(B, {});
        await ctx.service.pull(B, {});
        await push(B, kanbanRecord('t1', at(-1)));
        // No lanza ni duplica: ProfileService.ensure es idempotente (la comprobacion fina esta en profile.service.spec).
        expect((await pullAll(ctx.service, B)).records).toHaveLength(1);
      });
    });
  });
}
