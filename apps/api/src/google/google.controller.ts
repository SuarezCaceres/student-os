import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseFilters,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { CurrentUser, Public } from '../auth';
import { GoogleExceptionFilter } from './google.errors';
import {
  callbackQuerySchema,
  connectBodySchema,
  eventBodySchema,
  eventIdSchema,
  freeBusyBodySchema,
  instancesQuerySchema,
  linkLoginBodySchema,
  listEventsQuerySchema,
  parseOrBadRequest,
} from './google.schemas';
import { GoogleService, type GoogleStatus } from './google.service';

/**
 * Sync persistente de Google Calendar. Todas las rutas estan protegidas por el guard global de Supabase JWT salvo
 * `GET /google/callback` (Google redirige el navegador sin cabecera Authorization; se protege con el `state` firmado).
 * El `userId` SIEMPRE sale del JWT. El navegador nunca recibe tokens de Google: solo el resultado de las llamadas.
 */
@Controller('google')
@UseFilters(GoogleExceptionFilter)
export class GoogleController {
  constructor(private readonly google: GoogleService) {}

  // --- Conexion -------------------------------------------------------------------

  /** Devuelve la URL de consentimiento de Google (con PKCE y `access_type=offline`). El web navega a ella. */
  @Post('connect')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  connect(@CurrentUser('id') userId: string, @Body() body: unknown): Promise<{ url: string }> {
    const { returnTo } = parseOrBadRequest(connectBodySchema, body);
    return this.google.startConnect(userId, returnTo);
  }

  /**
   * Vincula Calendar al terminar el login con Google (spec 009): la web entrega una sola vez el refresh token que Google
   * dio en el consentimiento del login. Limite bajo: solo se usa una vez por inicio de sesion.
   */
  @Post('link-login')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  linkLogin(
    @CurrentUser('id') userId: string,
    @CurrentUser('email') email: string | undefined,
    @Body() body: unknown,
  ): Promise<GoogleStatus> {
    const { refreshToken } = parseOrBadRequest(linkLoginBodySchema, body);
    return this.google.linkFromLogin(userId, email, refreshToken);
  }

  /** Vuelta de Google. Siempre responde 302 a la web con `?google=connected` o `?google=error`. */
  @Public()
  @Get('callback')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async callback(@Query() query: unknown, @Res() res: Response): Promise<void> {
    // Ante una query invalida (arrays, textos enormes) se trata como "sin datos": termina en ?google=error.
    const parsed = callbackQuerySchema.safeParse(query);
    const target = await this.google.handleCallback(parsed.success ? parsed.data : {});
    res.setHeader('Cache-Control', 'no-store');
    res.redirect(302, target);
  }

  @Get('status')
  @Header('Cache-Control', 'no-store')
  status(@CurrentUser('id') userId: string): Promise<GoogleStatus> {
    return this.google.getStatus(userId);
  }

  @Post('disconnect')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  disconnect(@CurrentUser('id') userId: string): Promise<{ disconnected: boolean; revoked: boolean }> {
    return this.google.disconnect(userId);
  }

  // --- Proxy a Calendar API v3 (siempre el calendario `primary` del usuario) ---------------

  @Get('calendar/primary')
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 300, ttl: 60_000 } })
  async primaryCalendar(@CurrentUser('id') userId: string): Promise<unknown> {
    return (await this.google.calendarRequest(userId, { method: 'GET', path: 'calendars/primary' })).body;
  }

  @Get('calendar/events')
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 300, ttl: 60_000 } })
  async listEvents(@CurrentUser('id') userId: string, @Query() query: unknown): Promise<unknown> {
    const parsed = parseOrBadRequest(listEventsQuerySchema, query);
    const result = await this.google.calendarRequest(userId, {
      method: 'GET',
      path: 'calendars/primary/events',
      query: stringify(parsed),
    });
    return result.body;
  }

  @Get('calendar/events/:eventId/instances')
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 300, ttl: 60_000 } })
  async instances(
    @CurrentUser('id') userId: string,
    @Param('eventId') eventId: string,
    @Query() query: unknown,
  ): Promise<unknown> {
    const id = parseOrBadRequest(eventIdSchema, eventId);
    const parsed = parseOrBadRequest(instancesQuerySchema, query);
    const result = await this.google.calendarRequest(userId, {
      method: 'GET',
      path: `calendars/primary/events/${encodeURIComponent(id)}/instances`,
      query: stringify(parsed),
    });
    return result.body;
  }

  @Get('calendar/events/:eventId')
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 300, ttl: 60_000 } })
  async getEvent(@CurrentUser('id') userId: string, @Param('eventId') eventId: string): Promise<unknown> {
    const id = parseOrBadRequest(eventIdSchema, eventId);
    const result = await this.google.calendarRequest(userId, {
      method: 'GET',
      path: `calendars/primary/events/${encodeURIComponent(id)}`,
    });
    return result.body;
  }

  @Post('calendar/events')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 300, ttl: 60_000 } })
  async createEvent(@CurrentUser('id') userId: string, @Body() body: unknown): Promise<unknown> {
    const event = parseOrBadRequest(eventBodySchema, body);
    const result = await this.google.calendarRequest(userId, {
      method: 'POST',
      path: 'calendars/primary/events',
      body: event,
    });
    return result.body;
  }

  /** PATCH: tambien recorta series recurrentes (`{ recurrence: [...;UNTIL=...] }`). */
  @Patch('calendar/events/:eventId')
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 300, ttl: 60_000 } })
  async patchEvent(
    @CurrentUser('id') userId: string,
    @Param('eventId') eventId: string,
    @Body() body: unknown,
  ): Promise<unknown> {
    const id = parseOrBadRequest(eventIdSchema, eventId);
    const event = parseOrBadRequest(eventBodySchema, body);
    const result = await this.google.calendarRequest(userId, {
      method: 'PATCH',
      path: `calendars/primary/events/${encodeURIComponent(id)}`,
      body: event,
    });
    return result.body;
  }

  @Delete('calendar/events/:eventId')
  @HttpCode(204)
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 300, ttl: 60_000 } })
  async deleteEvent(@CurrentUser('id') userId: string, @Param('eventId') eventId: string): Promise<void> {
    const id = parseOrBadRequest(eventIdSchema, eventId);
    await this.google.calendarRequest(userId, {
      method: 'DELETE',
      path: `calendars/primary/events/${encodeURIComponent(id)}`,
    });
  }

  @Post('calendar/freebusy')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 300, ttl: 60_000 } })
  async freeBusy(@CurrentUser('id') userId: string, @Body() body: unknown): Promise<unknown> {
    const parsed = parseOrBadRequest(freeBusyBodySchema, body);
    const result = await this.google.calendarRequest(userId, {
      method: 'POST',
      path: 'freeBusy',
      // Solo el calendario principal: el navegador no puede consultar otros calendarios.
      body: { ...parsed, items: [{ id: 'primary' }] },
    });
    return result.body;
  }
}

/** Convierte los valores ya validados a strings para la query string, omitiendo los `undefined`. */
function stringify(values: Record<string, string | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) out[key] = value;
  }
  return out;
}
