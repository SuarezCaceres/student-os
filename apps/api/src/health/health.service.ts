import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Tiempo maximo que espera `SELECT 1` antes de dar la base por no disponible. */
export const DB_READY_TIMEOUT_MS = 5_000;

class DatabaseTimeoutError extends Error {
  override readonly name = 'DatabaseTimeoutError';
}

/**
 * Comprueba que la base de datos responde. La usa `GET /health/ready`, que el ping programado llama para que
 * Supabase registre actividad (el plan gratuito pausa el proyecto tras 7 dias sin ella).
 */
@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** `true` si `SELECT 1` responde a tiempo. Nunca lanza: cualquier fallo o espera excesiva es `false`. */
  async isDatabaseReady(): Promise<boolean> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new DatabaseTimeoutError()), DB_READY_TIMEOUT_MS);
    });
    try {
      await Promise.race([this.prisma.$queryRaw`SELECT 1`, timeout]);
      return true;
    } catch (error) {
      // Solo el tipo de error: el mensaje de Prisma puede incluir el host o el usuario de la conexion.
      const kind = error instanceof Error ? error.name : 'desconocido';
      this.logger.warn(`La base de datos no responde (${kind})`);
      return false;
    } finally {
      clearTimeout(timer);
    }
  }
}
