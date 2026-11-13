import { Body, Controller, Get, Header, HttpCode, Post, Query } from '@nestjs/common';
import type { SyncPullResponse, SyncPushResponse } from '@student-os/shared';
import { CurrentUser } from '../auth';
import { SyncService } from './sync.service';

/**
 * Rutas protegidas por defecto (guard global de Supabase JWT). El `userId` SIEMPRE sale del JWT; ni el body
 * ni la query pueden elegir a que usuario pertenecen los datos. La validacion de entrada la hace el servicio
 * con los esquemas de @student-os/shared.
 */
@Controller('sync')
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  /** `GET /sync/pull?since=<cursor>&collection=&limit=` */
  @Get('pull')
  @Header('Cache-Control', 'no-store')
  pull(@CurrentUser('id') userId: string, @Query() query: unknown): Promise<SyncPullResponse> {
    return this.sync.pull(userId, query);
  }

  /** `POST /sync/push` con `{ changes: SyncRecord[] }` */
  @Post('push')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  push(@CurrentUser('id') userId: string, @Body() body: unknown): Promise<SyncPushResponse> {
    return this.sync.push(userId, body);
  }
}
