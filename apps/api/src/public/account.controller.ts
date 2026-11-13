import { Body, Controller, Delete, Get, HttpCode, Res, UseGuards, UseInterceptors } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { CurrentUser, type AuthUser } from '../auth';
import { SecurityHeadersInterceptor } from '../common/security/security-headers.interceptor';
import { USER_THROTTLER, UserThrottlerGuard } from '../common/security/user-throttler.guard';
import { ACCOUNT_RATE_LIMIT, type AccountDeletionReport } from './account.types';
import { AccountService } from './account.service';

/**
 * Cuenta del usuario: exportar y borrar. Protegido por el guard global de Supabase JWT.
 * El `UserThrottlerGuard` va a nivel de controlador (se ejecuta DESPUES de los globales, ya con `request.user`),
 * asi que este limite por usuario funciona aunque el Integrador no lo registre como `APP_GUARD`.
 */
@Controller('account')
@UseGuards(UserThrottlerGuard)
@UseInterceptors(SecurityHeadersInterceptor)
export class AccountController {
  constructor(private readonly account: AccountService) {}

  /** Descarga JSON con todos los datos del usuario. 5 peticiones cada 10 minutos por usuario. */
  @Get('export')
  @Throttle({ [USER_THROTTLER]: ACCOUNT_RATE_LIMIT })
  async download(@CurrentUser() user: AuthUser, @Res({ passthrough: true }) res: Response): Promise<string> {
    const data = await this.account.exportData(user.id, user.email);
    const day = data.exportedAt.slice(0, 10);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="studentos-datos-${day}.json"`);
    res.setHeader('Cache-Control', 'no-store');
    return JSON.stringify(data, null, 2);
  }

  /** Borra la cuenta. Exige `{ "confirm": "BORRAR" }`. Idempotente y reintentable. */
  @Delete()
  @HttpCode(200)
  @Throttle({ [USER_THROTTLER]: ACCOUNT_RATE_LIMIT })
  remove(@CurrentUser('id') userId: string, @Body() body: unknown): Promise<AccountDeletionReport> {
    return this.account.deleteAccount(userId, body);
  }
}
