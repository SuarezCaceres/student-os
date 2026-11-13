import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Mail,
  Lock,
  User,
  GraduationCap,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Eye,
  EyeOff,
  Loader2,
  CalendarCheck,
} from 'lucide-react';
import { signInWithGoogleAccount } from '../../services/googleCalendar';

export interface UserSession {
  name: string;
  email: string;
  major?: string;
  provider?: 'google' | 'local' | 'demo';
  avatarUrl?: string;
  isLoggedIn: boolean;
  loginAt: string;
}

interface AuthModalProps {
  isOpen: boolean;
  initialMode?: 'login' | 'register';
  onClose: () => void;
  onSuccess: (user: UserSession) => void;
  onEnterDemo: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  initialMode = 'login',
  onClose,
  onSuccess,
  onEnterDemo,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [major, setMajor] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const modalRef = useRef<HTMLDivElement | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const emailInputRef = useRef<HTMLInputElement | null>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  // Restore focus to opener element when modal closes
  useEffect(() => {
    if (isOpen) {
      previousActiveElementRef.current = document.activeElement as HTMLElement | null;
    } else if (previousActiveElementRef.current) {
      previousActiveElementRef.current.focus?.();
      previousActiveElementRef.current = null;
    }
  }, [isOpen]);

  // Autofocus first input when modal opens or mode changes
  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      if (mode === 'register') {
        nameInputRef.current?.focus();
      } else {
        emailInputRef.current?.focus();
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [isOpen, mode]);

  // Handle ESC key, focus trap and body scroll lock
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      // Trap focus inside modal
      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
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

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsGoogleLoading(true);
    try {
      const result = await signInWithGoogleAccount();
      const displayName =
        result.user.name ||
        result.user.email?.split('@')[0] ||
        result.meta.userName ||
        'Estudiante';
      const userProfile: UserSession = {
        name: displayName,
        email: result.user.email || result.meta.email || 'google@studentos.app',
        major: 'Ingeniería / Tecnología',
        provider: 'google',
        avatarUrl: result.user.avatarUrl,
        isLoggedIn: true,
        loginAt: new Date().toISOString(),
      };

      try {
        localStorage.setItem('student_os_user_session', JSON.stringify(userProfile));
      } catch (err) {
        console.error('No se pudo guardar la sesión en localStorage:', err);
      }

      onSuccess(userProfile);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo completar el inicio de sesión con Google.'
      );
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Basic Validation
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Por favor, ingresa tu correo electrónico.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Por favor, ingresa un correo electrónico válido (ej. usuario@universidad.edu).');
      return;
    }
    if (!password || password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (mode === 'register' && !name.trim()) {
      setError('Por favor, ingresa tu nombre o apodo para saludarte en el Dashboard.');
      return;
    }

    setIsSubmitting(true);

    // Simulate swift authentic local processing
    setTimeout(() => {
      setIsSubmitting(false);
      const userProfile: UserSession = {
        name: mode === 'register' ? name.trim() : (trimmedEmail.split('@')[0] || 'Estudiante'),
        email: trimmedEmail,
        major: major.trim() || 'Ingeniería / Tecnología',
        provider: 'local',
        isLoggedIn: true,
        loginAt: new Date().toISOString(),
      };

      try {
        localStorage.setItem('student_os_user_session', JSON.stringify(userProfile));
      } catch (err) {
        console.error('No se pudo guardar la sesión en localStorage:', err);
      }

      onSuccess(userProfile);
    }, 300);
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
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 t-btn t-btn-ghost t-btn-icon !min-w-[44px] !min-h-[44px] rounded-xl text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer"
          aria-label="Cerrar ventana de autenticación"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Modal Header */}
        <div className="text-center mb-5">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--surface-2)] border border-[var(--line)] text-[var(--action)]">
            <GraduationCap className="h-6 w-6" />
          </div>
          <h2 id="auth-modal-title" className="font-sans text-2xl font-semibold tracking-[-0.025em] text-[var(--ink)]">
            {mode === 'login' ? 'Iniciar Sesión' : 'Crear tu Cuenta'}
          </h2>
          <p className="mt-1 text-[13px] text-[var(--muted)]">
            {mode === 'login'
              ? 'Vincula tu Google Calendar y tus rutinas de StudentOS'
              : 'Únete con Google en 1 clic o crea acceso local'}
          </p>
        </div>

        {/* Unified Google Sign-In CTA (OAuth 2.0 + Calendar Scopes) */}
        <div className="space-y-2.5 mb-5">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isGoogleLoading || isSubmitting}
            className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-[var(--line-strong)] bg-[var(--surface-2)] hover:border-[var(--action)] hover:bg-[var(--surface)] text-[var(--ink)] text-[14px] font-semibold flex items-center justify-center gap-2.5 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isGoogleLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-[var(--action)]" aria-hidden="true" />
            ) : (
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                />
              </svg>
            )}
            <span>
              {isGoogleLoading ? 'Conectando con Google...' : 'Continuar con Google'}
            </span>
            <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[13px] font-medium bg-[var(--surface)] border border-[var(--line)] text-[var(--action)]">
              <CalendarCheck className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Calendar</span>
            </span>
          </button>
        </div>

        {/* Visual Divider */}
        <div className="relative mb-5 flex items-center">
          <div className="flex-grow border-t border-[var(--line)]" />
          <span className="mx-3 shrink text-[13px] text-[var(--muted)]">
            o accede con correo
          </span>
          <div className="flex-grow border-t border-[var(--line)]" />
        </div>

        {/* Mode Toggle Pills */}
        <div className="grid grid-cols-2 rounded-xl bg-[var(--surface-2)] p-1 mb-5 border border-[var(--line)] text-[13px]">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            className={`min-h-[44px] py-2 px-3 rounded-lg font-semibold transition-all cursor-pointer flex items-center justify-center ${
              mode === 'login'
                ? 'bg-[var(--action)] text-[var(--action-ink)] shadow-sm'
                : 'text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            Iniciar Sesión
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError(null);
            }}
            className={`min-h-[44px] py-2 px-3 rounded-lg font-semibold transition-all cursor-pointer flex items-center justify-center ${
              mode === 'register'
                ? 'bg-[var(--action)] text-[var(--action-ink)] shadow-sm'
                : 'text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            Registrarte
          </button>
        </div>

        {/* Error message alert */}
        {error && (
          <div
            role="alert"
            aria-live="assertive"
            className="mb-4 rounded-xl border border-[color-mix(in_oklab,var(--danger)_30%,transparent)] bg-[color-mix(in_oklab,var(--danger)_12%,transparent)] px-3.5 py-2.5 text-[13px] text-[var(--danger)] flex items-start gap-2"
          >
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label 
                htmlFor="auth-input-name"
                className="block text-[13px] font-medium text-[var(--ink)] mb-1.5"
              >
                Tu Nombre o Apodo
              </label>
              <div className="relative">
                <User className="absolute left-3 top-3.5 h-4 w-4 text-[var(--muted)] pointer-events-none" aria-hidden="true" />
                <input
                  id="auth-input-name"
                  ref={nameInputRef}
                  type="text"
                  autoComplete="name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ej. Mateo C."
                  className="w-full min-h-[44px] rounded-xl border border-[var(--line-strong)] bg-[var(--surface-2)] pl-9 pr-3.5 py-2.5 text-sm text-[var(--ink)] placeholder-[var(--muted)] focus:border-[var(--action)] focus:bg-[var(--surface)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklab,var(--action)_25%,transparent)] transition-colors"
                />
              </div>
            </div>
          )}

          <div>
            <label 
              htmlFor="auth-input-email"
              className="block text-[13px] font-medium text-[var(--ink)] mb-1.5"
            >
              Correo Electrónico
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-3.5 h-4 w-4 text-[var(--muted)] pointer-events-none" aria-hidden="true" />
              <input
                id="auth-input-email"
                ref={emailInputRef}
                type="email"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                inputMode="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="estudiante@universidad.edu"
                className="w-full min-h-[44px] rounded-xl border border-[var(--line-strong)] bg-[var(--surface-2)] pl-9 pr-3.5 py-2.5 text-sm text-[var(--ink)] placeholder-[var(--muted)] focus:border-[var(--action)] focus:bg-[var(--surface)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklab,var(--action)_25%,transparent)] transition-colors"
              />
            </div>
          </div>

          <div>
            <label 
              htmlFor="auth-input-password"
              className="block text-[13px] font-medium text-[var(--ink)] mb-1.5"
            >
              Contraseña
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-3.5 h-4 w-4 text-[var(--muted)] pointer-events-none" aria-hidden="true" />
              <input
                id="auth-input-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full min-h-[44px] rounded-xl border border-[var(--line-strong)] bg-[var(--surface-2)] pl-9 pr-12 py-2.5 text-sm text-[var(--ink)] placeholder-[var(--muted)] focus:border-[var(--action)] focus:bg-[var(--surface)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklab,var(--action)_25%,transparent)] transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                aria-pressed={showPassword}
                className="absolute right-1 top-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {mode === 'register' && (
            <div>
              <label 
                htmlFor="auth-input-major"
                className="block text-[13px] font-medium text-[var(--ink)] mb-1.5"
              >
                Carrera / Universidad (Opcional)
              </label>
              <input
                id="auth-input-major"
                type="text"
                autoComplete="organization-title"
                value={major}
                onChange={(e) => setMajor(e.target.value)}
                placeholder="ej. Ingeniería de Sistemas"
                className="w-full min-h-[44px] rounded-xl border border-[var(--line-strong)] bg-[var(--surface-2)] px-3.5 py-2.5 text-sm text-[var(--ink)] placeholder-[var(--muted)] focus:border-[var(--action)] focus:bg-[var(--surface)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklab,var(--action)_25%,transparent)] transition-colors"
              />
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || isGoogleLoading}
            className="w-full mt-2 t-btn t-btn-primary min-h-[48px] text-sm font-semibold flex items-center justify-center gap-2 rounded-xl transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
          >
            <span>{isSubmitting ? 'Procesando...' : mode === 'login' ? 'Entrar a StudentOS' : 'Crear Cuenta Gratis'}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        {/* Divider & Guest Demo Button */}
        <div className="mt-5 pt-4 border-t border-[var(--line)] text-center">
          <p className="text-[13px] text-[var(--muted)] mb-2">
            ¿Solo quieres explorar sin registrarte?
          </p>
          <button
            type="button"
            onClick={onEnterDemo}
            className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3 py-1 text-[13px] font-semibold text-[var(--action)] hover:underline cursor-pointer"
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            <span>Entrar al Workspace en Modo Demo (1 Clic)</span>
          </button>
        </div>

        {/* Privacy Note */}
        <div className="mt-4 flex items-center justify-center gap-1.5 text-[13px] text-[var(--muted)] text-center">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--action)]" aria-hidden="true" />
          <span>Tus datos locales + tu calendario se sincronizan bajo tu control</span>
        </div>
      </div>
    </div>
  );
};
