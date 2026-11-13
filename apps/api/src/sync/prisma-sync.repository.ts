import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { Collection } from '@student-os/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { PullCriteria, RecordKey, StoredRecord, SyncRepository, SyncTransaction } from './sync.types';

type Client = Prisma.TransactionClient;

/** Margen para esperar el bloqueo del usuario (otro push en curso) y para ejecutar un push de hasta 500 cambios. */
const TX_OPTIONS = { maxWait: 10_000, timeout: 30_000 } as const;

interface Row {
  collection: string;
  id: string;
  data: Prisma.JsonValue | null;
  updatedAt: Date;
  deletedAt: Date | null;
  rev: number;
  seq: bigint;
  serverUpdatedAt: Date;
}

function toStored(row: Row): StoredRecord {
  return {
    collection: row.collection as Collection,
    id: row.id,
    data: row.data,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
    rev: row.rev,
    seq: row.seq,
    serverUpdatedAt: row.serverUpdatedAt,
  };
}

/**
 * Repositorio sobre Postgres (Prisma). Garantia del cursor: `lockUser()` hace upsert de la fila de
 * `user_sync_state` (bloqueo de fila hasta el commit), de modo que dos pushes del mismo usuario nunca se
 * solapan. Los `seq` se reparten dentro de esa seccion critica a partir del contador de la propia fila, que
 * se actualiza en la misma transaccion: si algo falla, el contador tambien se revierte (sin huecos) y un
 * lector (READ COMMITTED) solo ve `seq` ya confirmados y en orden. No hay `sequence` de Postgres a proposito:
 * las sequences no se revierten y se asignan fuera de orden de commit.
 */
@Injectable()
export class PrismaSyncRepository implements SyncRepository {
  constructor(private readonly prisma: PrismaService) {}

  transaction<T>(userId: string, fn: (tx: SyncTransaction) => Promise<T>): Promise<T> {
    return this.prisma.$transaction((client) => fn(new PrismaSyncTransaction(client, userId)), TX_OPTIONS);
  }

  async pull(userId: string, criteria: PullCriteria): Promise<StoredRecord[]> {
    const rows = await this.prisma.syncItem.findMany({
      where: {
        userId,
        seq: { gt: criteria.afterSeq },
        ...(criteria.collection ? { collection: criteria.collection } : {}),
      },
      orderBy: { seq: 'asc' },
      take: criteria.limit,
    });
    return rows.map(toStored);
  }

  async touchLastSync(userId: string, at: Date): Promise<void> {
    await this.prisma.userSyncState.upsert({
      where: { userId },
      create: { userId, seqCounter: 0n, lastSyncAt: at },
      update: { lastSyncAt: at },
    });
  }

  async deleteAllForUser(userId: string): Promise<number> {
    return this.prisma.$transaction(async (client) => {
      // Primero el estado: toma el bloqueo de fila y espera a un push en curso del mismo usuario.
      await client.userSyncState.deleteMany({ where: { userId } });
      const { count } = await client.syncItem.deleteMany({ where: { userId } });
      return count;
    }, TX_OPTIONS);
  }
}

class PrismaSyncTransaction implements SyncTransaction {
  constructor(
    private readonly client: Client,
    private readonly userId: string,
  ) {}

  async lockUser(): Promise<bigint> {
    const rows = await this.client.$queryRaw<{ seqCounter: bigint }[]>`
      INSERT INTO "user_sync_state" ("userId", "seqCounter", "lastSyncAt")
      VALUES (${this.userId}::uuid, 0, now())
      ON CONFLICT ("userId") DO UPDATE SET "lastSyncAt" = now()
      RETURNING "seqCounter"`;
    return rows[0].seqCounter;
  }

  async findByKeys(keys: RecordKey[]): Promise<StoredRecord[]> {
    if (keys.length === 0) return [];
    const byCollection = new Map<string, string[]>();
    for (const key of keys) {
      const ids = byCollection.get(key.collection) ?? [];
      ids.push(key.id);
      byCollection.set(key.collection, ids);
    }
    const rows = await this.client.syncItem.findMany({
      where: {
        userId: this.userId,
        OR: [...byCollection].map(([collection, ids]) => ({ collection, id: { in: ids } })),
      },
    });
    return rows.map(toStored);
  }

  countRecords(): Promise<number> {
    return this.client.syncItem.count({ where: { userId: this.userId } });
  }

  async write(records: StoredRecord[], newCounter: bigint): Promise<void> {
    if (records.length > 0) {
      // Una sola sentencia para todo el lote (500 upserts sueltos serian lentisimos contra el pooler).
      // Todo viaja como text[] y se castea en SQL; '' representa NULL (los arrays de Prisma no admiten NULL).
      await this.client.$executeRaw`
        INSERT INTO "sync_records"
          ("userId", "collection", "id", "data", "updatedAt", "deletedAt", "rev", "seq", "serverUpdatedAt")
        SELECT ${this.userId}::uuid, t.c, t.i, NULLIF(t.d, '')::jsonb, t.u::timestamptz,
               NULLIF(t.x, '')::timestamptz, t.r::int, t.s::bigint, t.v::timestamptz
        FROM unnest(
          ${records.map((r) => r.collection)}::text[],
          ${records.map((r) => r.id)}::text[],
          ${records.map((r) => (r.data === null || r.data === undefined ? '' : JSON.stringify(r.data)))}::text[],
          ${records.map((r) => r.updatedAt.toISOString())}::text[],
          ${records.map((r) => (r.deletedAt ? r.deletedAt.toISOString() : ''))}::text[],
          ${records.map((r) => String(r.rev))}::text[],
          ${records.map((r) => r.seq.toString())}::text[],
          ${records.map((r) => r.serverUpdatedAt.toISOString())}::text[]
        ) AS t(c, i, d, u, x, r, s, v)
        ON CONFLICT ("userId", "collection", "id") DO UPDATE SET
          "data" = EXCLUDED."data",
          "updatedAt" = EXCLUDED."updatedAt",
          "deletedAt" = EXCLUDED."deletedAt",
          "rev" = EXCLUDED."rev",
          "seq" = EXCLUDED."seq",
          "serverUpdatedAt" = EXCLUDED."serverUpdatedAt"`;
    }
    await this.client.userSyncState.update({
      where: { userId: this.userId },
      data: { seqCounter: newCounter },
    });
  }
}
