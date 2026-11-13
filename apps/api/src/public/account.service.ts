import { BadRequestException, HttpException, Inject, Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { runAccountDeletionHooks } from '../common/account-deletion';
import { safeErrorSummary, userRef } from '../common/security/pii';
import { SyncService } from '../sync/sync.service';
import { listAccountExportContributors } from './account-export.registry';
import {
  ACCOUNT_REPOSITORY,
  DELETE_CONFIRMATION,
  type AccountDeletionReport,
  type AccountExport,
  type AccountRepository,
} from './account.types';

const DeleteAccountBodySchema = z.object({ confirm: z.literal(DELETE_CONFIRMATION) });

/** HTTP 424 Failed Dependency: un modulo externo no pudo limpiar y por eso NO se borro nada mas. */
const FAILED_DEPENDENCY = 424;

/**
 * Exportacion y borrado de cuenta. REGLA DE SEGURIDAD: `userId` siempre es un argumento que el controlador
 * saca del JWT (`@CurrentUser()`); nada del body o la query decide a quien se exporta o se borra.
 */
@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  constructor(
    @Inject(ACCOUNT_REPOSITORY) private readonly repository: AccountRepository,
    private readonly sync: SyncService,
  ) {}

  /** `GET /account/export`: todo lo que la app guarda del usuario (registros vivos + perfil + extras de modulos). */
  async exportData(userId: string, email: string | undefined): Promise<AccountExport> {
    const snapshot = await this.repository.snapshot(userId);

    const byCollection: Record<string, number> = {};
    for (const record of snapshot.records) {
      byCollection[record.collection] = (byCollection[record.collection] ?? 0) + 1;
    }

    const extras: Record<string, unknown> = {};
    for (const contributor of listAccountExportContributors()) {
      try {
        extras[contributor.name] = await contributor.collect(userId);
      } catch (error) {
        // La exportacion no debe fallar por un modulo ajeno: se marca el bloque y se registra sin datos.
        extras[contributor.name] = { unavailable: true };
        this.logger.warn(
          `La exportacion no pudo incluir el modulo "${contributor.name}" (${safeErrorSummary(error)}) user=${userRef(userId)}`,
        );
      }
    }

    return {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      account: {
        id: userId,
        email: email ?? null,
        createdAt: snapshot.profile?.createdAt ?? null,
        updatedAt: snapshot.profile?.updatedAt ?? null,
        lastSyncAt: snapshot.lastSyncAt,
      },
      counts: { total: snapshot.records.length, byCollection },
      records: snapshot.records,
      extras,
    };
  }

  /**
   * `DELETE /account`. Orden:
   *  1. Ganchos de otros modulos (`runAccountDeletionHooks`): p. ej. GOOGLE revoca y borra su token.
   *     Si ALGUNO falla se corta aqui con 424 y el detalle por modulo; no se borra nada mas.
   *  2. `SyncService.deleteAllForUser` (registros + cursor, una transaccion).
   *  3. `Profile` + `user_sync_state` (una transaccion).
   * Cada paso es idempotente, asi que reintentar tras cualquier fallo es seguro y converge.
   */
  async deleteAccount(userId: string, rawBody: unknown): Promise<AccountDeletionReport> {
    const parsed = DeleteAccountBodySchema.safeParse(rawBody ?? {});
    if (!parsed.success) {
      throw new BadRequestException(
        `Para borrar la cuenta envia { "confirm": "${DELETE_CONFIRMATION}" }. Esta accion no se puede deshacer.`,
      );
    }
    const ref = userRef(userId);

    const hookResults = await runAccountDeletionHooks(userId);
    const failed = hookResults.filter((result) => !result.ok);
    if (failed.length > 0) {
      this.logger.warn(`Borrado de cuenta interrumpido user=${ref}: ${failed.map((f) => f.name).join(', ')}`);
      throw new HttpException(
        {
          statusCode: FAILED_DEPENDENCY,
          error: 'Failed Dependency',
          message: [
            'No se pudo completar el borrado de la cuenta. No se ha borrado nada mas: puedes reintentarlo.',
            ...hookResults.map((result) =>
              result.ok ? `${result.name}: ok` : `${result.name}: fallo (${result.error ?? 'Error'})`,
            ),
          ],
        },
        FAILED_DEPENDENCY,
      );
    }

    try {
      const syncRecordsDeleted = await this.sync.deleteAllForUser(userId);
      const { profileDeleted } = await this.repository.deleteProfileData(userId);
      this.logger.log(`Cuenta borrada user=${ref} registros=${syncRecordsDeleted} perfil=${profileDeleted}`);
      return {
        deleted: true,
        modules: hookResults.map((result) => ({ name: result.name, ok: true as const })),
        syncRecordsDeleted,
        profileDeleted,
        authUser: 'not_deleted',
      };
    } catch (error) {
      // El filtro global responde 500 generico; aqui queda el motivo, sin datos personales.
      this.logger.error(`Fallo al borrar datos de la cuenta user=${ref} (${safeErrorSummary(error)})`);
      throw error;
    }
  }
}
