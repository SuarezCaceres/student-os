import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import type { Env } from '../config/env.schema';

/**
 * Cliente Prisma unico. No se conecta en el arranque (conexion perezosa): la API debe levantar y
 * responder `/health` aunque la base de datos este dormida o inaccesible.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(config: ConfigService<Env, true>) {
    super({ datasourceUrl: config.get('DATABASE_URL', { infer: true }) });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
