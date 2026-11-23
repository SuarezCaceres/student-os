import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { GOOGLE_ERROR_CODES, type GoogleErrorCode } from './google.constants';

/** Error HTTP con un `code` estable que el web usa para decidir (p. ej. reconectar). */
export class GoogleHttpException extends HttpException {
  readonly code: GoogleErrorCode;

  constructor(status: number, code: GoogleErrorCode, message: string) {
    super({ statusCode: status, code, message }, status);
    this.code = code;
  }
}

/**
 * Se usa 409 y NO 401: el cliente HTTP del web trata cualquier 401 como "la sesion de StudentOS (Supabase) expiro",
 * intenta renovarla y, si falla, cierra sesion. Un problema de Google no debe sacar al usuario de la app.
 */
export const reauthRequired = (): GoogleHttpException =>
  new GoogleHttpException(
    409,
    GOOGLE_ERROR_CODES.reauthRequired,
    'Google Calendar necesita que vuelvas a autorizar el acceso.',
  );

export const notConnected = (): GoogleHttpException =>
  new GoogleHttpException(409, GOOGLE_ERROR_CODES.notConnected, 'Google Calendar no esta conectado.');

export const notConfigured = (): GoogleHttpException =>
  new GoogleHttpException(
    503,
    GOOGLE_ERROR_CODES.notConfigured,
    'La conexion con Google Calendar no esta configurada en el servidor.',
  );

/** 424 (no 5xx) a proposito: el cliente web reintenta los 5xx durante ~90 s, y repetir un POST a Google podria duplicar eventos. */
export const upstreamError = (): GoogleHttpException =>
  new GoogleHttpException(
    424,
    GOOGLE_ERROR_CODES.upstream,
    'Google Calendar no respondio correctamente. Intenta de nuevo en un momento.',
  );

interface GoogleErrorBody {
  statusCode: number;
  error: string;
  code: GoogleErrorCode;
  message: string;
  requestId?: string;
}

/**
 * Filtro del controlador de Google: conserva el `code` estable en el cuerpo (el filtro global solo copia `message`).
 * Solo atrapa `GoogleHttpException`; todo lo demas sigue al filtro global.
 */
@Catch(GoogleHttpException)
export class GoogleExceptionFilter implements ExceptionFilter<GoogleHttpException> {
  catch(exception: GoogleHttpException, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request & { id?: string | number }>();
    if (response.headersSent) return;
    const body: GoogleErrorBody = {
      statusCode: exception.getStatus(),
      error: exception.code,
      code: exception.code,
      message: exception.message,
      ...(request.id !== undefined ? { requestId: String(request.id) } : {}),
    };
    response.setHeader('Cache-Control', 'no-store');
    response.status(body.statusCode).json(body);
  }
}
