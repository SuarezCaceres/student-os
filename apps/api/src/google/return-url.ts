/**
 * Validacion anti open-redirect de la URL a la que se vuelve tras el consentimiento de Google.
 *
 * Reglas: solo http(s); el ORIGEN debe coincidir EXACTAMENTE con uno de `WEB_ORIGINS`; sin credenciales
 * (`user:pass@`); sin barras invertidas; de la URL solo se conserva `origin + pathname` (se descartan query y hash,
 * donde podria colarse algo). Devuelve `null` si no es valida.
 */
export function resolveReturnUrl(candidate: string | undefined | null, allowedOrigins: readonly string[]): string | null {
  if (allowedOrigins.length === 0) return null;
  if (candidate === undefined || candidate === null || candidate === '') {
    return `${allowedOrigins[0]}/`;
  }
  if (typeof candidate !== 'string' || candidate.length > 2048 || candidate.includes('\\')) return null;
  // Caracteres de control / espacios al inicio: algunos navegadores los ignoran y cambiarian el destino.
  if (hasControlOrSpace(candidate)) return null;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (url.username !== '' || url.password !== '') return null;
  if (!allowedOrigins.includes(url.origin)) return null;
  // `//evil.com` como ruta seguiria en el mismo origen, pero se normaliza para no dejar ambiguedades.
  const pathname = url.pathname.replace(/^\/{2,}/, '/');
  return `${url.origin}${pathname}`;
}

/** Anade `google=<resultado>` (y opcionalmente `reason`) a una URL ya validada. */
export function withGoogleResult(validatedUrl: string, result: 'connected' | 'error', reason?: string): string {
  const url = new URL(validatedUrl);
  url.searchParams.set('google', result);
  if (reason) url.searchParams.set('reason', reason);
  return url.toString();
}

function hasControlOrSpace(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code <= 0x20 || code === 0x7f) return true;
  }
  return false;
}
