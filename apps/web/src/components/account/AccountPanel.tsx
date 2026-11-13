import React, { useId, useState } from 'react';
import { Download, Loader2, Trash2 } from 'lucide-react';
import { getApiClient } from '../../services/api';
import { isSyncConfigured, signOut, useSupabaseSession } from '../../services/supabase';
import { clearSyncDataOnSignOut } from '../../utils/accountDataCleanup';
import { ModalShell } from '../common/ModalShell';
import {
  DELETE_CONFIRMATION,
  deleteAccountOnServer,
  describeAccountError,
  downloadTextFile,
  fetchAccountExport,
} from './accountApi';

export interface AccountPanelProps {
  className?: string;
  /** Se llama cuando la cuenta ya se borró en el servidor y se cerró la sesión. */
  onAccountDeleted?: () => void;
  /**
   * Si se pasa, el modal ofrece borrar también lo guardado en este dispositivo y llama a esta función
   * solo cuando la persona lo marcó. Debe reiniciar el estado local de la app (lo conecta el Integrador).
   */
  onClearLocalData?: () => void;
}

type Feedback = { tone: 'ok' | 'error'; text: string } | null;

/**
 * Tus datos y tu cuenta: descargar una copia en JSON y borrar la cuenta (con confirmación escrita).
 * No se muestra si la nube no está configurada o si no hay sesión iniciada, así que es seguro montarlo siempre.
 */
export const AccountPanel: React.FC<AccountPanelProps> = ({ className = '', onAccountDeleted, onClearLocalData }) => {
  const session = useSupabaseSession();
  const headingId = useId();
  const inputId = useId();
  const clearLocalId = useId();

  const [exporting, setExporting] = useState(false);
  const [exportFeedback, setExportFeedback] = useState<Feedback>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [clearLocal, setClearLocal] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (!isSyncConfigured() || session.status !== 'signedIn') return null;

  const confirmed = typed.trim() === DELETE_CONFIRMATION;

  const handleExport = async () => {
    const client = getApiClient();
    if (!client || exporting) return;
    setExporting(true);
    setExportFeedback(null);
    try {
      const result = await fetchAccountExport(client);
      downloadTextFile(result.fileName, result.text);
      setExportFeedback({
        tone: 'ok',
        text: `Listo: se descargó ${result.fileName} con ${result.total} ${result.total === 1 ? 'registro' : 'registros'}.`,
      });
    } catch (error) {
      setExportFeedback({ tone: 'error', text: describeAccountError(error, 'export') });
    } finally {
      setExporting(false);
    }
  };

  const closeConfirm = () => {
    if (deleting) return;
    setConfirmOpen(false);
    setTyped('');
    setDeleteError(null);
  };

  const handleDelete = async () => {
    const client = getApiClient();
    if (!client || !confirmed || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteAccountOnServer(client);
    } catch (error) {
      setDeleteError(describeAccountError(error, 'delete'));
      setDeleting(false);
      return;
    }
    // Servidor limpio: cerrar sesión YA para que el motor de sync no vuelva a subir nada.
    try {
      await clearSyncDataOnSignOut(session.user?.id ?? null);
      await signOut();
    } catch {
      // Si el cierre de sesión falla, los datos del servidor ya están borrados; la sesión caducará sola.
    }
    if (onClearLocalData && clearLocal) onClearLocalData();
    setDeleting(false);
    setConfirmOpen(false);
    setTyped('');
    onAccountDeleted?.();
  };

  return (
    <section aria-labelledby={headingId} className={`t-card p-5 sm:p-6 ${className}`}>
      <h2 id={headingId} className="text-lg font-semibold text-[var(--ink)]">
        Tus datos y tu cuenta
      </h2>
      <p className="mt-1 max-w-[60ch] text-[0.9375rem] leading-relaxed text-[var(--muted)]">
        Tus tareas, entrenos y horario son tuyos. Puedes llevarte una copia cuando quieras o borrar tu cuenta y todo lo
        que guardamos en la nube.
      </p>

      <div className="mt-4">
        <div className="t-row flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[0.9375rem] font-medium text-[var(--ink)]">Descargar mis datos</p>
            <p className="text-sm text-[var(--muted)]">Un archivo JSON con tu perfil y todo lo que has sincronizado.</p>
          </div>
          <button
            type="button"
            className="t-btn t-btn-secondary shrink-0"
            onClick={handleExport}
            disabled={exporting}
            aria-busy={exporting}
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Download className="h-4 w-4" aria-hidden="true" />
            )}
            <span>{exporting ? 'Preparando archivo…' : 'Descargar mis datos'}</span>
          </button>
        </div>
        {exportFeedback && (
          <p
            role={exportFeedback.tone === 'error' ? 'alert' : 'status'}
            className={`mt-3 text-sm ${exportFeedback.tone === 'error' ? 'text-[var(--danger)]' : 'text-[var(--ok)]'}`}
          >
            {exportFeedback.text}
          </p>
        )}

        <div className="t-row flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[0.9375rem] font-medium text-[var(--ink)]">Borrar mi cuenta</p>
            <p className="text-sm text-[var(--muted)]">
              Elimina tus datos de la nube y desconecta Google Calendar. No se puede deshacer.
            </p>
          </div>
          <button
            type="button"
            className="t-btn t-btn-secondary shrink-0 !border-[var(--danger)] !text-[var(--danger)]"
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            <span>Borrar mi cuenta</span>
          </button>
        </div>
      </div>

      <ModalShell
        isOpen={confirmOpen}
        onClose={closeConfirm}
        title="¿Borrar tu cuenta?"
        subtitle="Esta acción no se puede deshacer."
        icon={<Trash2 className="h-5 w-5" aria-hidden="true" />}
        maxWidth="md"
        footer={
          <>
            <button type="button" className="t-btn t-btn-secondary" onClick={closeConfirm} disabled={deleting}>
              Cancelar
            </button>
            <button
              type="button"
              className="t-btn t-btn-primary !bg-[var(--danger)] !text-[var(--action-ink)]"
              onClick={handleDelete}
              disabled={!confirmed || deleting}
              aria-busy={deleting}
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              <span>{deleting ? 'Borrando…' : 'Borrar para siempre'}</span>
            </button>
          </>
        }
      >
        <div className="space-y-4 text-[0.9375rem] leading-relaxed text-[var(--ink)]">
          <p>Vamos a eliminar de la nube tus tareas, entregas, entrenos, horario y perfil, y a desconectar Google Calendar.</p>
          <p className="text-[var(--muted)]">
            Tu inicio de sesión con Google puede quedar registrado en nuestro proveedor de acceso; si quieres que también
            se elimine, escríbenos al correo de contacto de la política de privacidad.
          </p>
          {onClearLocalData && (
            <label htmlFor={clearLocalId} className="flex min-h-[44px] cursor-pointer items-center gap-3">
              <input
                id={clearLocalId}
                type="checkbox"
                checked={clearLocal}
                onChange={(event) => setClearLocal(event.target.checked)}
                className="h-5 w-5 shrink-0 accent-[var(--action)]"
              />
              <span>Borrar también lo guardado en este dispositivo</span>
            </label>
          )}
          <div>
            <label htmlFor={inputId} className="t-label">
              Escribe {DELETE_CONFIRMATION} para confirmar
            </label>
            <input
              id={inputId}
              type="text"
              className="t-input"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              disabled={deleting}
              aria-describedby={deleteError ? `${inputId}-error` : undefined}
            />
          </div>
          {deleteError && (
            <p id={`${inputId}-error`} role="alert" className="text-sm text-[var(--danger)]">
              {deleteError}
            </p>
          )}
        </div>
      </ModalShell>
    </section>
  );
};
