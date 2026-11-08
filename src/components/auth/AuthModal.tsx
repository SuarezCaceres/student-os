import React, { useState, useEffect, useRef } from 'react';
import { X, Mail, Lock, User, GraduationCap, ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react';

export interface UserSession {
  name: string;
  email: string;
  major?: string;
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
  const [name, setName] = useState('');
  const [major, setMajor] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        isLoggedIn: true,
        loginAt: new Date().toISOString(),
      };

      try {
        localStorage.setItem('student_os_user_session', JSON.stringify(userProfile));
      } catch (err) {
        console.error('No se pudo guardar la sesión en localStorage:', err);
      }

      onSuccess(userProfile);
    }, 400);
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
        className="relative w-full max-w-md rounded-[20px] border border-[var(--line-strong)] bg-[var(--surface)] p-6 sm:p-8 shadow-2xl backdrop-blur-xl text-[var(--ink)]"
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
        <div className="text-center mb-6">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--surface-2)] border border-[var(--line)] text-[var(--action)]">
            <GraduationCap className="h-6 w-6" />
          </div>
          <h2 id="auth-modal-title" className="font-sans text-2xl font-semibold tracking-[-0.025em] text-[var(--ink)]">
            {mode === 'login' ? 'Iniciar Sesión' : 'Crear tu Cuenta'}
          </h2>
          <p className="mt-1 text-xs text-[var(--muted)] font-mono">
            {mode === 'login'
              ? 'Accede a tus entregas y rutinas de StudentOS'
              : 'Únete a miles de estudiantes con control total'}
          </p>
        </div>

        {/* Mode Toggle Pills */}
        <div className="grid grid-cols-2 rounded-xl bg-[var(--surface-2)] p-1 mb-5 border border-[var(--line)] font-mono text-xs">
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
          <div className="mb-4 rounded-xl border border-[color-mix(in_oklab,var(--danger)_30%,transparent)] bg-[color-mix(in_oklab,var(--danger)_12%,transparent)] px-3.5 py-2.5 text-xs text-[var(--danger)] font-mono flex items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label 
                htmlFor="auth-input-name"
                className="block text-xs font-mono font-medium text-[var(--ink)] mb-1.5"
              >
                Tu Nombre o Apodo
              </label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-[var(--muted)] pointer-events-none" />
                <input
                  id="auth-input-name"
                  ref={nameInputRef}
                  type="text"
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
              className="block text-xs font-mono font-medium text-[var(--ink)] mb-1.5"
            >
              Correo Electrónico
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-[var(--muted)] pointer-events-none" />
              <input
                id="auth-input-email"
                ref={emailInputRef}
                type="email"
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
              className="block text-xs font-mono font-medium text-[var(--ink)] mb-1.5"
            >
              Contraseña
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-[var(--muted)] pointer-events-none" />
              <input
                id="auth-input-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full min-h-[44px] rounded-xl border border-[var(--line-strong)] bg-[var(--surface-2)] pl-9 pr-3.5 py-2.5 text-sm text-[var(--ink)] placeholder-[var(--muted)] focus:border-[var(--action)] focus:bg-[var(--surface)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklab,var(--action)_25%,transparent)] transition-colors"
              />
            </div>
          </div>

          {mode === 'register' && (
            <div>
              <label 
                htmlFor="auth-input-major"
                className="block text-xs font-mono font-medium text-[var(--ink)] mb-1.5"
              >
                Carrera / Universidad (Opcional)
              </label>
              <input
                id="auth-input-major"
                type="text"
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
            disabled={isSubmitting}
            className="w-full mt-2 t-btn t-btn-primary min-h-[48px] font-mono text-sm font-semibold flex items-center justify-center gap-2 rounded-xl transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
          >
            <span>{isSubmitting ? 'Procesando...' : mode === 'login' ? 'Entrar a StudentOS' : 'Crear Cuenta Gratis'}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        {/* Divider & Guest Demo Button */}
        <div className="mt-5 pt-4 border-t border-[var(--line)] text-center">
          <p className="text-xs text-[var(--muted)] font-mono mb-2">
            ¿Solo quieres explorar sin registrarte?
          </p>
          <button
            type="button"
            onClick={onEnterDemo}
            className="inline-flex items-center justify-center gap-1.5 min-h-[44px] py-1 text-xs font-mono font-semibold text-[var(--action)] hover:underline cursor-pointer"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Entrar al Workspace en Modo Demo (1 Clic)</span>
          </button>
        </div>

        {/* Privacy Note */}
        <div className="mt-4 flex items-center justify-center gap-1.5 text-xs font-mono text-[var(--muted)] text-center">
          <CheckCircle2 className="h-3.5 w-3.5 text-[var(--action)]" />
          <span>Tus datos se guardan 100% en tu navegador (Offline-First)</span>
        </div>
      </div>
    </div>
  );
};
