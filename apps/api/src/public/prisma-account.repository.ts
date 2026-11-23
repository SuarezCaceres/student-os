import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EXPORT_PAGE_SIZE, type AccountRepository, type AccountSnapshot, type ExportedRecord } from './account.types';

/** Transaccion interactiva: tiempos holgados para el plan gratuito (cold start de la BD). */
const TX_OPTIONS = { maxWait: 10_000, timeout: 30_000 } as const;

@Injectable()
export class PrismaAccountRepository implements AccountRepository {
  constructor(private readonly prisma: PrismaService) {}

  async snapshot(userId: string): Promise<AccountSnapshot> {
    // RepeatableRead: perfil, estado y todas las paginas de registros ven la MISMA foto de la base.
    return this.prisma.$transaction(
      async (tx) => {
        const profile = await tx.profile.findUnique({ where: { id: userId } });
        const state = await tx.userSyncState.findUnique({ where: { userId }, select: { lastSyncAt: true } });

        const records: ExportedRecord[] = [];
        let afterSeq = 0n;
        for (;;) {
          const page = await tx.syncItem.findMany({
            where: { userId, deletedAt: null, seq: { gt: afterSeq } },
            orderBy: { seq: 'asc' },
            take: EXPORT_PAGE_SIZE,
          });
          for (const row of page) {
            records.push({
              collection: row.collection,
              id: row.id,
              data: row.data,
              updatedAt: row.updatedAt.toISOString(),
              rev: row.rev,
            });
          }
          if (page.length < EXPORT_PAGE_SIZE) break;
          afterSeq = page[page.length - 1].seq;
        }

        return {
          profile: profile
            ? { id: profile.id, createdAt: profile.createdAt.toISOString(), updatedAt: profile.updatedAt.toISOString() }
            : null,
          lastSyncAt: state?.lastSyncAt ? state.lastSyncAt.toISOString() : null,
          records,
        };
      },
      { ...TX_OPTIONS, isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async deleteProfileData(userId: string): Promise<{ profileDeleted: boolean }> {
    return this.prisma.$transaction(async (tx) => {
      await tx.userSyncState.deleteMany({ where: { userId } });
      const { count } = await tx.profile.deleteMany({ where: { id: userId } });
      return { profileDeleted: count > 0 };
    }, TX_OPTIONS);
  }
}
