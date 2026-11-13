import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

/**
 * Validacion de entrada del proxy a Calendar. Todo es una LISTA BLANCA: los campos desconocidos se descartan
 * (zod los elimina), asi el navegador no puede colar `attendees`, `conferenceData`, otro `calendarId`, etc.
 */

const rfc3339 = z
  .string()
  .max(40)
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/, 'debe ser una fecha RFC 3339');

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'debe ser AAAA-MM-DD');

const boolString = z.enum(['true', 'false']);

const intString = (min: number, max: number) =>
  z
    .string()
    .regex(/^\d{1,6}$/)
    .transform(Number)
    .refine((value) => value >= min && value <= max, `debe estar entre ${min} y ${max}`)
    .transform(String);

export const listEventsQuerySchema = z.object({
  timeMin: rfc3339.optional(),
  timeMax: rfc3339.optional(),
  singleEvents: boolString.optional(),
  orderBy: z.enum(['startTime', 'updated']).optional(),
  timeZone: z.string().max(64).optional(),
  maxResults: intString(1, 2500).optional(),
  pageToken: z.string().max(2048).optional(),
  showDeleted: boolString.optional(),
});

export const instancesQuerySchema = z.object({
  timeMin: rfc3339.optional(),
  timeMax: rfc3339.optional(),
  timeZone: z.string().max(64).optional(),
  maxResults: intString(1, 2500).optional(),
  pageToken: z.string().max(2048).optional(),
  showDeleted: boolString.optional(),
});

const eventTime = z.object({
  dateTime: rfc3339.optional(),
  date: isoDate.optional(),
  timeZone: z.string().max(64).optional(),
});

const recurrenceLine = z
  .string()
  .max(500)
  .regex(/^(RRULE|EXRULE|RDATE|EXDATE)[:;]/i, 'debe ser una linea RFC 5545 (RRULE:, EXDATE:...)');

const privateProps = z
  .record(z.string().max(64), z.string().max(1024))
  .refine((record) => Object.keys(record).length <= 20, 'maximo 20 propiedades');

const reminders = z.object({
  useDefault: z.boolean(),
  overrides: z
    .array(
      z.object({
        method: z.enum(['popup', 'email']),
        minutes: z.number().int().min(0).max(40_320),
      }),
    )
    .max(5)
    .optional(),
});

/** Campos de evento que el proxy deja pasar (los mismos que ya usa `googleCalendar.ts`). */
export const eventBodySchema = z.object({
  summary: z.string().max(1024).optional(),
  description: z.string().max(8192).optional(),
  location: z.string().max(1024).optional(),
  start: eventTime.optional(),
  end: eventTime.optional(),
  recurrence: z.array(recurrenceLine).max(5).optional(),
  extendedProperties: z.object({ private: privateProps.optional() }).optional(),
  reminders: reminders.optional(),
  transparency: z.enum(['opaque', 'transparent']).optional(),
});

export const freeBusyBodySchema = z.object({
  timeMin: rfc3339,
  timeMax: rfc3339,
  timeZone: z.string().max(64).optional(),
});

export const connectBodySchema = z.object({
  returnTo: z.string().max(2048).optional(),
});

export const callbackQuerySchema = z.object({
  code: z.string().max(2048).optional(),
  state: z.string().max(1024).optional(),
  error: z.string().max(200).optional(),
});

/** Id de evento de Google: alfanumerico, `_`, `-`, `@`, `.` (instancias: `abc_20260101T100000Z`). No puede empezar por `.`. */
export const eventIdSchema = z
  .string()
  .max(1024)
  .regex(/^[A-Za-z0-9_@-][A-Za-z0-9_@.-]*$/, 'id de evento invalido');

/** Parsea con zod y lanza 400 con lineas `ruta: mensaje` (maximo 8) sin eco del valor recibido. */
export function parseOrBadRequest<T extends z.ZodType>(schema: T, data: unknown): z.output<T> {
  const result = schema.safeParse(data ?? {});
  if (!result.success) {
    const lines = result.error.issues
      .slice(0, 8)
      .map((issue) => `${issue.path.join('.') || '(valor)'}: ${issue.message}`);
    throw new BadRequestException(lines);
  }
  return result.data;
}
