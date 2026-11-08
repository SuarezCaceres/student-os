import React, { useState, useEffect } from 'react';
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

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-md rounded-2xl border border-cyan-500/30 bg-[#091122] p-6 sm:p-8 shadow-[0_16px_60px_rgba(0,0,0,0.8)] backdrop-blur-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
          aria-label="Cerrar ventana de autenticación"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Modal Header */}
        <div className="text-center mb-6">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-950 border border-cyan-500/40 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
            <GraduationCap className="h-6 w-6" />
          </div>
          <h2 id="auth-modal-title" className="font-sans text-2xl font-bold text-white">
            {mode === 'login' ? 'Iniciar Sesión' : 'Crear tu Cuenta'}
          </h2>
          <p className="mt-1 text-xs text-slate-300 font-mono">
            {mode === 'login'
              ? 'Accede a tus entregas y rutinas de StudentOS'
              : 'Únete a miles de estudiantes con control total'}
          </p>
        </div>

        {/* Mode Toggle Pills */}
        <div className="grid grid-cols-2 rounded-xl bg-slate-900/90 p-1 mb-5 border border-slate-800 font-mono text-xs">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            className={`py-2 rounded-lg font-semibold transition-all cursor-pointer ${
              mode === 'login'
                ? 'bg-cyan-500 text-black shadow-[0_0_12px_rgba(6,182,212,0.4)]'
                : 'text-slate-400 hover:text-white'
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
            className={`py-2 rounded-lg font-semibold transition-all cursor-pointer ${
              mode === 'register'
                ? 'bg-cyan-500 text-black shadow-[0_0_12px_rgba(6,182,212,0.4)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Registrarte
          </button>
        </div>

        {/* Error message alert */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-500/40 bg-red-950/40 px-3 py-2 text-xs text-red-300 font-mono flex items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label className="block text-xs font-mono font-medium text-slate-300 mb-1">
                Tu Nombre o Apodo
              </label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ej. Mateo C."
                  className="w-full rounded-xl border border-slate-700 bg-[#060c18] pl-9 pr-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-mono font-medium text-slate-300 mb-1">
              Correo Electrónico
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="estudiante@universidad.edu"
                className="w-full rounded-xl border border-slate-700 bg-[#060c18] pl-9 pr-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono font-medium text-slate-300 mb-1">
              Contraseña
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full rounded-xl border border-slate-700 bg-[#060c18] pl-9 pr-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
              />
            </div>
          </div>

          {mode === 'register' && (
            <div>
              <label className="block text-xs font-mono font-medium text-slate-300 mb-1">
                Carrera / Universidad (Opcional)
              </label>
              <input
                type="text"
                value={major}
                onChange={(e) => setMajor(e.target.value)}
                placeholder="ej. Ingeniería de Sistemas"
                className="w-full rounded-xl border border-slate-700 bg-[#060c18] px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
              />
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl border border-cyan-400 bg-cyan-400 py-3 font-mono text-sm font-bold text-black shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:bg-cyan-300 active:scale-98 transition-all cursor-pointer disabled:opacity-50"
          >
            <span>{isSubmitting ? 'Procesando...' : mode === 'login' ? 'Entrar a StudentOS' : 'Crear Cuenta Gratis'}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        {/* Divider & Guest Demo Button */}
        <div className="mt-5 pt-4 border-t border-slate-800 text-center">
          <p className="text-xs text-slate-400 font-mono mb-2">
            ¿Solo quieres explorar sin registrarte?
          </p>
          <button
            type="button"
            onClick={onEnterDemo}
            className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-cyan-400 hover:text-cyan-300 hover:underline cursor-pointer"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Entrar al Dashboard en Modo Demo (1 Clic)</span>
          </button>
        </div>

        {/* Privacy Note */}
        <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] font-mono text-slate-500 text-center">
          <CheckCircle2 className="h-3 w-3 text-cyan-500" />
          <span>Tus datos se guardan 100% en tu navegador (Offline-First)</span>
        </div>
      </div>
    </div>
  );
};
