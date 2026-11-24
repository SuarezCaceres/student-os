import React, { useState, useEffect, useRef } from 'react';
import { X, GraduationCap, Loader2, CalendarCheck } from 'lucide-react';
import { isSupabaseConfigured, signInWithGoogle as signInWithSupabaseGoogle } from '../../services/supabase';

/** Sesion que usa `App.tsx`. El unico proveedor de acceso es Google (spec 009). */
export interface UserSession {
  name: string;
  email: string;
  major?: string;
  provider?: 'google';
  avatarUrl?: string;
  isLoggedIn: boolean;
  loginAt: string;
}

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Fuerza que haya (o no) nube configurada. Por defecto: hay variables de entorno de Supabase. */
  cloudAuth?: boolean;
  /** Sustituye el inicio de sesion (pruebas). Por defecto: OAuth de Supabase con redireccion a Google. */
  onCloudSignIn?: () => Promise<void>;
}

/**
 * Unica forma de entrar: "Continuar con Google". En ese mismo consentimiento se conceden los permisos de Calendar, asi que
 * Calendar queda vinculado sin ningun paso mas (spec 009). No hay registro con correo, ni demo, ni modo local.
 */
export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, cloudAuth, onCloudSignIn }) => {
  const available = cloudAuth ?? isSupabaseConfigured();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const modalRef = useRef<HTMLDivElement | null>(null);
  const loginButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  // Devuelve el foco al elemento que abrio el modal al cerrarlo
  useEffect(() => {
    if (isOpen) {
      previousActiveElementRef.current = document.activeElement as HTMLElement | null;
    } else if (previousActiveElementRef.current) {
      previousActiveElementRef.current.focus?.();
      previousActiveElementRef.current = null;
    }
  }, [isOpen]);

  // Foco inicial en el boton de Google
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => loginButtonRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, [isOpen]);

  // ESC, trampa de foco y bloqueo del scroll
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSignIn = async () => {
    setError(null);
    setIsLoading(true);
    try {
      // Redirige a Google; al volver, la sesion de Supabase se detecta sola (ver useAuthState).
      await (onCloudSignIn ?? signInWithSupabaseGoogle)();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión con Google.');
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={modalRef}
        className="relative w-full max-w-md max-h-[92vh] overflow-y-auto rounded-[20px] border border-[var(--line-strong)] bg-[var(--surface)] p-6 sm:p-8 shadow-2xl backdrop-blur-xl text-[var(--ink)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 t-btn t-btn-ghost t-btn-icon !min-w-[44px] !min-h-[44px] rounded-xl text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer"
          aria-label="Cerrar ventana de autenticación"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="text-center mb-6">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--surface-2)] border border-[var(--line)] text-[var(--action)]">
            <GraduationCap className="h-6 w-6" />
          </div>
          <h2 id="auth-modal-title" className="font-sans text-2xl font-semibold tracking-[-0.025em] text-[var(--ink)]">
            Entrar a StudentOS
          </h2>
          <p className="mt-1 text-[13px] text-[var(--muted)]">
            Un solo paso: entras con tu cuenta de Google y tu Google Calendar queda conectado.
          </p>
        </div>

        <div className="space-y-3">
          <button
            ref={loginButtonRef}
            type="button"
            onClick={handleSignIn}
            disabled={isLoading || !available}
            className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-[var(--line-strong)] bg-[var(--surface-2)] hover:border-[var(--action)] hover:bg-[var(--surface)] text-[var(--ink)] text-[14px] font-semibold flex items-center justify-center gap-2.5 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-[var(--action)]" aria-hidden="true" />
            ) : (
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z" />
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z" />
                <path fill="#FBBC05" d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z" />
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z" />
              </svg>
            )}
            <span>{isLoading ? 'Abriendo Google...' : 'Continuar con Google'}</span>
            <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[13px] font-medium bg-[var(--surface)] border border-[var(--line)] text-[var(--action)]">
              <CalendarCheck className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Calendar</span>
            </span>
          </button>

          {!available && (
            <p role="alert" className="text-center text-[13px] text-[var(--warn,var(--muted))]">
              El inicio de sesión no está disponible en este momento.
            </p>
          )}
          {error && (
            <p role="alert" className="text-center text-[13px] text-[var(--danger,var(--ink))]">
              {error}
            </p>
          )}
        </div>

        <p className="mt-5 text-center text-[13px] text-[var(--muted)]">
          Google te pedirá permiso para ver y editar los eventos de tu calendario. Tus datos se guardan en tu cuenta y los ves en todos tus dispositivos.
        </p>
      </div>
    </div>
  );
};
