import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';

interface ErrorBody {
  statusCode: number;
  error: string;
  message: string | string[];
  requestId?: string;
}

const GENERIC_SERVER_MESSAGE = 'Error interno del servidor';

/**
 * Errores 4xx que NO son `HttpException` pero que Express/body-parser marcan como seguros de exponer
 * (`expose: true`): cuerpo demasiado grande (413), JSON malformado (400), charset no soportado (415)...
 */
function exposedClientStatus(exception: unknown): number | undefined {
  if (typeof exception !== 'object' || exception === null) return undefined;
  const { status, expose } = exception as { status?: unknown; expose?: unknown };
  if (expose === true && typeof status === 'number' && status >= 400 && status < 500) return status;
  return undefined;
}

const CLIENT_ERROR_MESSAGES: Record<number, string> = {
  400: 'Solicitud invalida',
  413: 'La solicitud es demasiado grande',
  415: 'Tipo de contenido no soportado',
};

/**
 * Filtro global de errores. Nunca expone stack, mensajes de excepciones internas (Prisma, red,
 * etc.) ni secretos: los 5xx devuelven un mensaje generico y el detalle va solo al log.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') {
      return;
    }
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request & { id?: string | number }>();

    const exposedStatus = exposedClientStatus(exception);
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : (exposedStatus ?? HttpStatus.INTERNAL_SERVER_ERROR);
    const requestId = request.id !== undefined ? String(request.id) : undefined;

    if (status >= 500) {
      this.logger.error(
        { err: exception, requestId, path: request.url },
        exception instanceof Error ? exception.message : 'Excepcion no controlada',
      );
    }

    const body: ErrorBody = {
      statusCode: status,
      error: HttpStatus[status] ?? 'Error',
      message: status >= 500 ? GENERIC_SERVER_MESSAGE : this.clientMessage(exception),
      ...(requestId ? { requestId } : {}),
    };

    if (response.headersSent) {
      return;
    }
    response.status(status).json(body);
  }

  private clientMessage(exception: unknown): string | string[] {
    if (!(exception instanceof HttpException)) {
      const exposedStatus = exposedClientStatus(exception);
      return exposedStatus ? (CLIENT_ERROR_MESSAGES[exposedStatus] ?? 'Solicitud invalida') : GENERIC_SERVER_MESSAGE;
    }
    const payload = exception.getResponse();
    if (typeof payload === 'string') {
      return payload;
    }
    const message = (payload as { message?: unknown }).message;
    if (typeof message === 'string') return message;
    if (Array.isArray(message) && message.every((item) => typeof item === 'string')) return message;
    return exception.message;
  }
}
