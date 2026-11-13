import { isApiError, type ApiClient } from '../../services/api';

/** Palabra que hay que escribir para confirmar el borrado (la API exige exactamente esta cadena). */
export const DELETE_CONFIRMATION = 'BORRAR';

/** Lo unico que necesitamos del cliente HTTP (facilita las pruebas). */
export type AccountRequester = Pick<ApiClient, 'request'>;

export interface AccountExportResult {
  fileName: string;
  /** JSON legible (con sangria), listo para descargar. */
  text: string;
  /** Registros incluidos en la descarga. */
  total: number;
}

/** `studentos-datos-2026-11-13.json` (fecha local del dispositivo). */
export function exportFileName(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `studentos-datos-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.json`;
}

/** Pide a la API todos los datos del usuario (`GET /account/export`). */
export async function fetchAccountExport(client: AccountRequester, now: Date = new Date()): Promise<AccountExportResult> {
  const payload = await client.request<{ counts?: { total?: unknown } } | null>('/account/export');
  if (payload === null || typeof payload !== 'object') {
    throw new Error('La respuesta de exportación no tiene el formato esperado.');
  }
  const total = typeof payload.counts?.total === 'number' ? payload.counts.total : 0;
  return { fileName: exportFileName(now), text: JSON.stringify(payload, null, 2), total };
}

/** Borra la cuenta en el servidor (`DELETE /account`). Idempotente: se puede reintentar. */
export async function deleteAccountOnServer(client: AccountRequester): Promise<void> {
  await client.request('/account', { method: 'DELETE', body: { confirm: DELETE_CONFIRMATION } });
}

const MODULE_LABELS: Record<string, string> = {
  google: 'Google Calendar',
  calendar: 'Calendario',
  gym: 'Gym',
};

/** Nombres legibles de los servicios que fallaron en un borrado interrumpido (HTTP 424). */
export function failedModules(error: unknown): string[] {
  if (!isApiError(error) || error.status !== 424) return [];
  const message = (error.body as { message?: unknown } | undefined)?.message;
  if (!Array.isArray(message)) return [];
  const names: string[] = [];
  for (const line of message) {
    const match = typeof line === 'string' ? /^([a-z0-9-]+): fallo/i.exec(line) : null;
    if (match) names.push(MODULE_LABELS[match[1].toLowerCase()] ?? match[1]);
  }
  return names;
}

function minutesText(ms: number | undefined): string {
  if (!ms || ms <= 0) return 'unos minutos';
  const minutes = Math.max(1, Math.ceil(ms / 60_000));
  return minutes === 1 ? '1 minuto' : `${minutes} minutos`;
}

/** Mensaje en espanol natural para mostrar al usuario; nunca incluye detalles tecnicos ni datos suyos. */
export function describeAccountError(error: unknown, action: 'export' | 'delete'): string {
  const verb = action === 'export' ? 'descargar tus datos' : 'borrar tu cuenta';
  if (isApiError(error)) {
    switch (error.kind) {
      case 'offline':
        return `No hay conexión a internet. Conéctate y vuelve a intentar ${verb}.`;
      case 'rate_limit':
        return `Has hecho esta acción varias veces seguidas. Espera ${minutesText(error.retryAfterMs)} y vuelve a intentarlo.`;
      case 'auth':
        return 'Tu sesión expiró. Inicia sesión otra vez y repite la acción.';
      case 'timeout':
      case 'network':
      case 'server':
        return `El servidor no respondió (puede estar despertando). Espera un momento y vuelve a intentar ${verb}.`;
      case 'not_configured':
        return 'La nube no está configurada en esta versión de StudentOS.';
      case 'client': {
        if (error.status === 424) {
          const names = failedModules(error);
          const who = names.length > 0 ? names.join(', ') : 'un servicio externo';
          return `No pudimos desconectar ${who}, así que no se borró nada. Inténtalo de nuevo en unos minutos.`;
        }
        break;
      }
      default:
        break;
    }
  }
  return `No se pudo ${action === 'export' ? 'descargar tus datos' : 'borrar tu cuenta'}. Inténtalo de nuevo en unos minutos.`;
}

/** Descarga un texto como archivo en el navegador (sin dependencias). */
export function downloadTextFile(fileName: string, text: string, mime = 'application/json'): void {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Dar tiempo al navegador a iniciar la descarga antes de liberar el blob.
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
