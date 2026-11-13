import type { INestApplication } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { startJwksServer, type JwksServer } from './helpers/jwks-server';
import { startSyncPg, type SyncPg } from './helpers/sync-pg';
import { defineSyncScenarios } from './helpers/sync-scenarios';
import { NOW, at, kanbanRecord, newUserId, titleOf, tombstone } from './helpers/sync-fixtures';
import { ProfileService } from '../src/profile/profile.service';
import { PrismaProfileRepository } from '../src/profile/prisma-profile.repository';
import { PrismaService } from '../src/prisma/prisma.service';
import { PrismaSyncRepository } from '../src/sync/prisma-sync.repository';
import { SyncService } from '../src/sync/sync.service';

/**
 * Capa Prisma contra un Postgres REAL (embedded-postgres, puerto 54329, base temporal, schema privado
 * `dev_sync_api`, tablas creadas con `prisma db push`). Sin Docker, sin Supabase, sin credenciales reales.
 */
jest.setTimeout(180_000);

describe('Sync sobre Postgres real (Prisma)', () => {
  let pg: SyncPg;
  let prisma: PrismaService;
  const clock = { now: new Date() };
  let service: SyncService;

  beforeAll(async () => {
    pg = await startSyncPg();
    prisma = new PrismaService({ get: () => pg.url } as unknown as ConfigService<never, true>);
    service = new SyncService(
      new PrismaSyncRepository(prisma),
      new ProfileService(new PrismaProfileRepository(prisma)),
      () => clock.now,
    );
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await pg?.stop();
  });

  // Los mismos escenarios que el repositorio en memoria (LWW, aislamiento, limites, cursor, concurrencia...).
  defineSyncScenarios('Postgres real', async () => ({ service, clock }));

  describe('garantias propias de Postgres', () => {
    beforeEach(() => {
      clock.now = new Date(NOW);
    });

    it('seq es 1..N sin huecos ni repetidos y la clave (userId, collection, id) es unica', async () => {
      const user = newUserId();
      await Promise.all(
        [0, 1, 2, 3].map((w) =>
          service.push(user, { changes: Array.from({ length: 20 }, (_, i) => kanbanRecord(`w${w}-${i}`, at(-120))) }),
        ),
      );
      // Reescribir algunos (nuevo seq por escritura) y borrar otros.
      await service.push(user, { changes: [kanbanRecord('w0-0', at(-1), 'otra'), tombstone('w1-1', at(-1))] });

      const rows = await prisma.syncItem.findMany({ where: { userId: user }, orderBy: { seq: 'asc' } });
      expect(rows).toHaveLength(80);
      const seqs = rows.map((r) => Number(r.seq));
      expect(new Set(seqs).size).toBe(80);
      // Hay 80 filas con seq en 1..82 menos los 2 seq "reemplazados": el maximo es el contador y no hay duplicados.
      const state = await prisma.userSyncState.findUniqueOrThrow({ where: { userId: user } });
      expect(state.seqCounter).toBe(BigInt(Math.max(...seqs)));
      expect(Math.max(...seqs)).toBe(82);
      expect(state.lastSyncAt).not.toBeNull();
    });

    it('un push que falla (cuota/validacion en transaccion) revierte tambien el contador de seq', async () => {
      const user = newUserId();
      await service.push(user, { changes: [kanbanRecord('a', at(-5))] });
      const before = await prisma.userSyncState.findUniqueOrThrow({ where: { userId: user } });

      // Fuerza un fallo dentro de la transaccion del repositorio despues de bloquear y reservar seq.
      const repository = new PrismaSyncRepository(prisma);
      await expect(
        repository.transaction(user, async (tx) => {
          const counter = await tx.lockUser();
          await tx.write(
            [
              {
                collection: 'kanban',
                id: 'fantasma',
                data: { title: 'x' },
                updatedAt: new Date(),
                deletedAt: null,
                rev: 1,
                seq: counter + 1n,
                serverUpdatedAt: new Date(),
              },
            ],
            counter + 1n,
          );
          throw new Error('fallo simulado');
        }),
      ).rejects.toThrow('fallo simulado');

      const after = await prisma.userSyncState.findUniqueOrThrow({ where: { userId: user } });
      expect(after.seqCounter).toBe(before.seqCounter);
      expect(await prisma.syncItem.count({ where: { userId: user, id: 'fantasma' } })).toBe(0);
    });

    it('el tombstone guarda data = NULL en la base y el updatedAt del cliente (saneado)', async () => {
      const user = newUserId();
      await service.push(user, { changes: [{ ...kanbanRecord('t1', at(-1), 'secreto'), deletedAt: at(-1) }] });
      const row = await prisma.syncItem.findUniqueOrThrow({
        where: { userId_collection_id: { userId: user, collection: 'kanban', id: 't1' } },
      });
      expect(row.data).toBeNull();
      expect(row.deletedAt?.toISOString()).toBe(at(-1));
      expect(row.rev).toBe(1);
    });

    it('jsonb conserva los datos tal cual (acentos, anidados) y la comparacion idempotente funciona tras el roundtrip', async () => {
      const user = newUserId();
      const record = kanbanRecord('t1', at(-3), 'Ñandú: reunión "importante" \u{1F680}');
      (record.data as Record<string, unknown>).checklist = [{ id: 'c1', text: 'ver tildes áéíóú', done: false }];
      await service.push(user, { changes: [record] });
      const again = await service.push(user, { changes: [record] });
      expect(again.applied).toEqual(['t1']);
      const { records } = await service.pull(user, {});
      expect(records[0].rev).toBe(1);
      expect(titleOf(records[0])).toBe('Ñandú: reunión "importante" \u{1F680}');
      expect(records[0].data).toMatchObject({ checklist: [{ id: 'c1', text: 'ver tildes áéíóú', done: false }] });
    });

    it('deleteAllForUser borra filas y estado del usuario en la base, y solo del suyo', async () => {
      const a = newUserId();
      const b = newUserId();
      await service.push(a, { changes: [kanbanRecord('t1', at(-1))] });
      await service.push(b, { changes: [kanbanRecord('t1', at(-1))] });
      await service.deleteAllForUser(a);
      expect(await prisma.syncItem.count({ where: { userId: a } })).toBe(0);
      expect(await prisma.userSyncState.count({ where: { userId: a } })).toBe(0);
      expect(await prisma.syncItem.count({ where: { userId: b } })).toBe(1);
    });

    it('el schema es el privado dev_sync_api (no se toco public)', async () => {
      const rows = await prisma.$queryRaw<{ table_schema: string }[]>`
        SELECT table_schema FROM information_schema.tables WHERE table_name = 'sync_records'`;
      expect(rows.map((r) => r.table_schema)).toEqual(['dev_sync_api']);
    });
  });

  describe('HTTP completo sobre Postgres (guard real + PrismaService real)', () => {
    let jwks: JwksServer;
    let app: INestApplication;

    beforeAll(async () => {
      jwks = await startJwksServer();
      process.env.SUPABASE_URL = jwks.url;
      process.env.SUPABASE_JWT_AUDIENCE = 'authenticated';
      process.env.WEB_ORIGINS = 'http://localhost:5173';
      process.env.DATABASE_URL = pg.url;
      process.env.DIRECT_URL = pg.url;
      const { AppModule } = await import('../src/app.module');
      const { configureApp } = await import('../src/app.setup');
      const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
      app = moduleRef.createNestApplication({ logger: false });
      configureApp(app);
      await app.init();
    });

    afterAll(async () => {
      await app?.close();
      await jwks?.close();
    });

    it('push -> pull -> profile con dos usuarios, aislados', async () => {
      const ua = newUserId();
      const ub = newUserId();
      const ta = await jwks.sign({ sub: ua, email: 'a@example.com' });
      const tb = await jwks.sign({ sub: ub, email: 'b@example.com' });
      const http = () => request(app.getHttpServer());

      await http().post('/sync/push').set('Authorization', `Bearer ${ta}`).send({ changes: [kanbanRecord('x', at(-10), 'de A')] }).expect(200);
      await http().post('/sync/push').set('Authorization', `Bearer ${tb}`).send({ changes: [kanbanRecord('x', at(-1), 'de B')] }).expect(200);

      const a = await http().get('/sync/pull').set('Authorization', `Bearer ${ta}`).expect(200);
      const b = await http().get('/sync/pull').set('Authorization', `Bearer ${tb}`).expect(200);
      expect(a.body.records.map(titleOf)).toEqual(['de A']);
      expect(b.body.records.map(titleOf)).toEqual(['de B']);

      const profile = await http().get('/profile').set('Authorization', `Bearer ${ta}`).expect(200);
      expect(profile.body).toMatchObject({ id: ua, email: 'a@example.com' });
      expect(profile.body.lastSyncAt).not.toBeNull();
      expect(await prisma.profile.count({ where: { id: { in: [ua, ub] } } })).toBe(2);
    });

    it('401 sin token', async () => {
      await request(app.getHttpServer()).get('/sync/pull').expect(401);
    });
  });
});
