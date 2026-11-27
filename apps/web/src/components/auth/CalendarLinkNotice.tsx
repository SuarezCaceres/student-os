import React from 'react';
import { clearCalendarLinkState, useCalendarLinkState } from '../../services/googleLogin';
import { signInWithGoogle } from '../../services/supabase';

/**
 * Aviso de la landing cuando el login con Google se cierra porque Calendar no quedo vinculado (spec 009, C9): por ejemplo,
 * el usuario desmarco el permiso de Calendar en la pantalla de Google. Calendar forma parte del login, asi que no se
 * entra a la app; se explica el motivo y se ofrece volver a intentarlo. No muestra nada si no hubo fallo.
 */
export const CalendarLinkNotice: React.FC = () => {
  const link = useCalendarLinkState();
  const [retrying, setRetrying] = React.useState(false);
  if (link.status !== 'failed') return null;

  const retry = async () => {
    setRetrying(true);
    try {
      await signInWithGoogle();
    } catch {
      setRetrying(false);
    }
  };

  return (
    <div
      role="alert"
      className="mx-auto mt-4 flex max-w-3xl flex-col gap-3 rounded-[14px] border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-[var(--ink)] sm:flex-row sm:items-center sm:justify-between"
    >
      <p>{link.message}</p>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={retry}
          disabled={retrying}
          className="min-h-[44px] rounded-[10px] bg-[var(--action)] px-4 font-semibold text-white disabled:opacity-60"
        >
          {retrying ? 'Abriendo Google…' : 'Continuar con Google'}
        </button>
        <button
          type="button"
          onClick={clearCalendarLinkState}
          className="min-h-[44px] rounded-[10px] border border-[var(--border)] px-4"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
};
