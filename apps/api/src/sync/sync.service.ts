import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  Optional,
  PayloadTooLargeException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  MAX_PULL_LIMIT,
  MAX_PUSH_CHANGES,
  SyncPullQuerySchema,
  SyncPushRequestSchema,
  validateRecordData,
  type SyncPullResponse,
  type SyncPushResponse,
  type SyncRecord,
} from '@student-os/shared';
import { ProfileService } from '../profile/profile.service';
import { planPush, recordKey, type NormalizedChange } from './sync-logic';
import {
  CURSOR_PATTERN,
  DEFAULT_PULL_LIMIT,
  INITIAL_CURSOR,
  MAX_RECORDS_PER_USER,
  MAX_RECORD_DATA_BYTES,
  SYNC_CLOCK,
  SYNC_REPOSITORY,
} from './sync.constants';
import type { StoredRecord, SyncRepository } from './sync.types';

/** Maximo de problemas de validacion que se devuelven al cliente (el resto se resume). */
const MAX_REPORTED_ISSUES = 10;

interface ZodIssueLike {
  path: PropertyKey[];
  message: string;
}

/** Fila del servidor -> `SyncRecord` del contrato (no expone `seq` ni `serverUpdatedAt`). */
export function toSyncRecord(row: StoredRecord): SyncRecord {
  return {
    id: row.id,
    collection: row.collection,
    data: row.deletedAt ? null : row.data,
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
    rev: row.rev,
  };
}

/**
 * Motor de sync generico por coleccion. REGLA DE SEGURIDAD: `userId` es siempre un argumento que el
 * controlador saca del JWT (`@CurrentUser()`); este servicio nunca lo lee de un body o query.
 */
@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);
  private readonly now: () => Date;

  constructor(
    @Inject(SYNC_REPOSITORY) private readonly repository: SyncRepository,
    private readonly profiles: ProfileService,
    @Optional() @Inject(SYNC_CLOCK) clock?: () => Date,
  ) {
    this.now = clock ?? (() => new Date());
  }

  /** `GET /sync/pull`: registros del usuario con `seq` posterior al cursor, en orden de `seq`. */
  async pull(userId: string, rawQuery: unknown): Promise<SyncPullResponse> {
    const parsed = SyncPullQuerySchema.safeParse(rawQuery ?? {});
    if (!parsed.success) {
      throw new BadRequestException(formatIssues(parsed.error.issues, 'query'));
    }
    const { since, collection } = parsed.data;
    const limit = parsed.data.limit ?? Math.min(DEFAULT_PULL_LIMIT, MAX_PULL_LIMIT);
    if (since !== undefined && !CURSOR_PATTERN.test(since)) {
      throw new BadRequestException('Cursor "since" invalido: usa el cursor devuelto por el ultimo pull');
    }

    await this.profiles.ensure(userId);
    // limit + 1: la fila extra solo sirve para saber si hay mas paginas.
    const rows = await this.repository.pull(userId, {
      afterSeq: BigInt(since ?? INITIAL_CURSOR),
      collection,
      limit: limit + 1,
    });
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const cursor = page.length > 0 ? page[page.length - 1].seq.toString() : (since ?? INITIAL_CURSOR);

    // Mejor esfuerzo: un fallo al anotar lastSyncAt no debe tumbar un pull valido.
    this.repository.touchLastSync(userId, this.now()).catch((error: unknown) => {
      this.logger.warn(`No se pudo actualizar lastSyncAt: ${error instanceof Error ? error.message : 'error'}`);
    });

    return { records: page.map(toSyncRecord), cursor, hasMore };
  }

  /** `POST /sync/push`: aplica los cambios en UNA transaccion con "ultima edicion gana". */
  async push(userId: string, rawBody: unknown): Promise<SyncPushResponse> {
    const changes = this.parsePush(rawBody);
    await this.profiles.ensure(userId);

    if (changes.length === 0) {
      await this.repository.touchLastSync(userId, this.now());
      return { applied: [], conflicts: [] };
    }

    const plan = await this.repository.transaction(userId, async (tx) => {
      // 1) Bloquear al usuario: serializa pushes concurrentes y fija el contador de `seq`.
      const counter = await tx.lockUser();
      // 2) Leer el estado actual de las claves tocadas (ya bajo el bloqueo).
      const keys = new Map(changes.map((change) => [recordKey(change.collection, change.id), change]));
      const existing = new Map(
        (await tx.findByKeys([...keys.values()].map(({ collection, id }) => ({ collection, id })))).map((row) => [
          recordKey(row.collection, row.id),
          row,
        ]),
      );
      // 3) Decidir (logica pura) y comprobar la cuota antes de escribir.
      const result = planPush(existing, changes, this.now(), counter);
      if (result.newRows > 0) {
        const current = await tx.countRecords();
        if (current + result.newRows > MAX_RECORDS_PER_USER) {
          throw new UnprocessableEntityException(
            `Cuota de registros excedida: maximo ${MAX_RECORDS_PER_USER} por cuenta. ` +
              'Elimina datos que ya no necesites antes de seguir sincronizando.',
          );
        }
      }
      // 4) Escribir todo (o nada).
      if (result.writes.length > 0) {
        await tx.write(result.writes, result.newCounter);
      }
      return result;
    });

    return { applied: plan.applied, conflicts: plan.conflicts.map(toSyncRecord) };
  }

  /**
   * Borra TODOS los registros de sync del usuario (y su estado/cursor). Para el borrado de cuenta (agente PUBLIC).
   * No toca `Profile`: eso lo borra quien orquesta el borrado de cuenta.
   */
  deleteAllForUser(userId: string): Promise<number> {
    return this.repository.deleteAllForUser(userId);
  }

  // --- Validacion --------------------------------------------------------------------------------------------

  private parsePush(rawBody: unknown): NormalizedChange[] {
    const rawChanges = (rawBody as { changes?: unknown } | null | undefined)?.changes;
    if (Array.isArray(rawChanges) && rawChanges.length > MAX_PUSH_CHANGES) {
      throw new PayloadTooLargeException(
        `Demasiados cambios en una peticion: maximo ${MAX_PUSH_CHANGES}. Envialos en lotes.`,
      );
    }
    const parsed = SyncPushRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new BadRequestException(formatIssues(parsed.error.issues, 'body'));
    }

    return parsed.data.changes.map((change, index) => {
      const deletedAt = change.deletedAt ? new Date(change.deletedAt) : null;
      let data: unknown = null;
      if (!deletedAt) {
        // SyncRecordSchema ya valido `data`, pero conserva claves desconocidas: guardamos la version
        // saneada por el esquema de la coleccion (descarta lo no declarado en el contrato).
        const validated = validateRecordData(change.collection, change.data);
        if (!validated.success) {
          throw new BadRequestException(formatIssues(validated.error.issues, `changes[${index}].data`));
        }
        data = validated.data;
        const bytes = Buffer.byteLength(JSON.stringify(data), 'utf8');
        if (bytes > MAX_RECORD_DATA_BYTES) {
          throw new PayloadTooLargeException(
            `El registro "${change.id}" de "${change.collection}" ocupa ${bytes} bytes; ` +
              `el maximo por registro es ${MAX_RECORD_DATA_BYTES} bytes.`,
          );
        }
      }
      return {
        collection: change.collection,
        id: change.id,
        data,
        updatedAt: new Date(change.updatedAt),
        deletedAt,
      };
    });
  }
}

/**
 * Convierte problemas de zod en mensajes cortos `ruta: mensaje`. Solo incluye rutas y mensajes de zod
 * (que nunca repiten el valor recibido), jamas trazas ni detalles internos.
 */
function formatIssues(issues: readonly ZodIssueLike[], root: string): string[] {
  const lines = issues.slice(0, MAX_REPORTED_ISSUES).map((issue) => {
    const path = issue.path.reduce<string>(
      (acc, part) => (typeof part === 'number' ? `${acc}[${part}]` : `${acc}.${String(part)}`),
      root,
    );
    return `${path}: ${issue.message}`;
  });
  if (issues.length > MAX_REPORTED_ISSUES) {
    lines.push(`... y ${issues.length - MAX_REPORTED_ISSUES} problemas mas`);
  }
  return lines;
}
