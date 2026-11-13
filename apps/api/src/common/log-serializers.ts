/**
 * Serializadores de `pino-http`.
 *
 * El callback de OAuth de Google recibe `?code=...&state=...` en la query. Aunque el codigo es de un solo
 * uso y esta atado a PKCE + client secret, la regla del proyecto es no registrarlo: se recorta SIEMPRE la
 * query string de la URL antes de loguear (tambien evita filtrar cualquier otro parametro sensible).
 */
export function stripQuery(url: unknown): string {
  return String(url ?? '').split('?')[0] ?? '';
}

interface LoggedRequest {
  id?: unknown;
  method?: unknown;
  url?: unknown;
  remoteAddress?: unknown;
}

export function serializeRequest(req: LoggedRequest): Record<string, unknown> {
  return { id: req.id, method: req.method, url: stripQuery(req.url), remoteAddress: req.remoteAddress };
}
