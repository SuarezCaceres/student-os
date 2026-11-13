import type { SyncBackup } from './types';

/** Nombre de archivo del respaldo: `studentos-respaldo-local-20261113-1530.json`. */
export function backupFileName(backup: SyncBackup): string {
  const stamp = backup.createdAt.replace(/[-:]/g, '').replace('T', '-').slice(0, 13);
  return `studentos-respaldo-${backup.kind === 'local' ? 'local' : 'nube'}-${stamp}.json`;
}

/** Descarga el respaldo como JSON. Lanza si el navegador no puede hacerlo (la operacion se cancela). */
export function downloadBackup(backup: SyncBackup): void {
  if (typeof document === 'undefined') throw new Error('No hay documento para descargar el respaldo.');
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = backupFileName(backup);
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
