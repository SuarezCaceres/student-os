import React from 'react';
import { LogOut } from 'lucide-react';
import { ModalShell } from '../common/ModalShell';

interface ConfirmLogoutDialogProps {
  isOpen: boolean;
  /** Cambios que siguen sin subir a la cuenta. */
  pending: number;
  /** El servidor no respondio a tiempo (en vez de no haber conexion). */
  timedOut: boolean;
  /** Se esta cerrando la sesion: los botones quedan bloqueados. */
  isLeaving?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Aviso al cerrar sesion con cambios que no se pudieron subir (spec 010, C8): nunca se descarta trabajo en silencio.
 * La persona puede cancelar (y seguir sincronizando) o cerrar igualmente asumiendo la perdida.
 */
export const ConfirmLogoutDialog: React.FC<ConfirmLogoutDialogProps> = ({ isOpen, pending, timedOut, isLeaving = false, onCancel, onConfirm }) => (
  <ModalShell
    isOpen={isOpen}
    onClose={isLeaving ? () => undefined : onCancel}
    title="Hay cambios sin guardar en tu cuenta"
    subtitle="Todavía no se subieron a la nube."
    icon={<LogOut className="w-5 h-5" />}
    maxWidth="md"
    footer={
      <>
        <button type="button" onClick={onCancel} disabled={isLeaving} className="t-btn t-btn-secondary">
          Cancelar
        </button>
        <button type="button" onClick={onConfirm} disabled={isLeaving} className="t-btn t-btn-primary !bg-[var(--danger)] !text-[var(--action-ink)]">
          {isLeaving ? 'Cerrando sesión…' : 'Cerrar sesión de todos modos'}
        </button>
      </>
    }
  >
    <div className="space-y-3 text-[14px] text-[var(--muted)]">
      <p>
        <strong className="text-[var(--ink)]">
          {pending === 1 ? '1 cambio' : `${pending} cambios`}
        </strong>{' '}
        no {pending === 1 ? 'se pudo' : 'se pudieron'} subir a tu cuenta
        {timedOut ? ': el servidor tardó demasiado en responder.' : ' (puede que no tengas conexión).'}
      </p>
      <p>Si cierras sesión ahora, {pending === 1 ? 'se perderá' : 'se perderán'}. Puedes cancelar y esperar a que se sincronicen.</p>
    </div>
  </ModalShell>
);
