/**
 * Marca persistente "este usuario ya importo sus datos locales" (una sola vez por usuario).
 * Vive en localStorage y SOBREVIVE al cierre de sesion: asi, al volver a entrar, subir lo local a una
 * nube vacia no vuelve a preguntar. Los casos con datos en ambos lados siempre se preguntan.
 */
export const IMPORT_MARKER_PREFIX = 'student_os_sync_imported_v1:';

export function hasImportedBefore(userId: string): boolean {
  try {
    return window.localStorage.getItem(IMPORT_MARKER_PREFIX + userId) !== null;
  } catch {
    return false;
  }
}

export function markImported(userId: string): void {
  try {
    window.localStorage.setItem(IMPORT_MARKER_PREFIX + userId, new Date().toISOString());
  } catch {
    // ignore
  }
}
