import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { USER_THROTTLER, USER_THROTTLER_DEFAULT, UserThrottlerGuard } from '../common/security/user-throttler.guard';
import { SyncModule } from '../sync/sync.module';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';
import { ACCOUNT_REPOSITORY } from './account.types';
import { PrismaAccountRepository } from './prisma-account.repository';

/**
 * Producto publico: exportar/borrar cuenta, limite de frecuencia por usuario y utilidades de seguridad.
 * Exporta `UserThrottlerGuard` para que el Integrador lo registre como `APP_GUARD` si quiere un limite
 * general por usuario (ver docs/agent-notes/PUBLIC.md). NO se registra globalmente aqui.
 */
@Module({
  imports: [
    SyncModule,
    // Proporciona opciones y almacen al guard de este modulo (propio: no comparte contadores con el global).
    ThrottlerModule.forRoot([{ name: USER_THROTTLER, ...USER_THROTTLER_DEFAULT }]),
  ],
  controllers: [AccountController],
  providers: [AccountService, UserThrottlerGuard, { provide: ACCOUNT_REPOSITORY, useClass: PrismaAccountRepository }],
  exports: [UserThrottlerGuard],
})
export class PublicModule {}
