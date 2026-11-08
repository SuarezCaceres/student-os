import React from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';

interface LandingNavbarProps {
  onOpenAuth: (mode: 'login' | 'register') => void;
  onEnterAppDemo: () => void;
}

export const LandingNavbar: React.FC<LandingNavbarProps> = ({
  onOpenAuth,
  onEnterAppDemo,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-[var(--line)] bg-[var(--surface)]/90 backdrop-blur-md transition-colors">
      <div className="mx-auto flex h-16 sm:h-18 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand Logo & Tag */}
        <a 
          href="#inicio" 
          className="flex items-center gap-2.5 group focus-visible:outline-2 focus-visible:outline-[var(--action)] rounded-xl"
        >
          <div className="w-9 h-9 rounded-[10px] overflow-hidden border border-[var(--line)] bg-[var(--surface-2)] flex items-center justify-center shrink-0">
            <img
              src="/logo.png"
              alt="Logo de StudentOS"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-base sm:text-lg font-semibold tracking-[-0.025em] text-[var(--ink)]">
                StudentOS
              </span>
              <span className="rounded border border-[color-mix(in_oklab,var(--action)_30%,transparent)] bg-[color-mix(in_oklab,var(--action)_10%,transparent)] px-1.5 py-0.5 font-mono text-xs font-semibold text-[var(--action)]">
                PRO
              </span>
            </div>
            <span className="text-xs text-[var(--muted)]">Life, Gym & College Hub</span>
          </div>
        </a>

        {/* Section Navigation Links (Desktop) */}
        <nav className="hidden md:flex items-center gap-6 font-sans text-sm text-[var(--muted)]" aria-label="Navegación principal">
          <a 
            href="#problema" 
            className="hover:text-[var(--ink)] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--action)] rounded px-1.5 py-1"
          >
            Diagnóstico
          </a>
          <a 
            href="#para-que-sirve" 
            className="hover:text-[var(--ink)] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--action)] rounded px-1.5 py-1"
          >
            ¿Para qué sirve?
          </a>
          <a 
            href="#para-quienes" 
            className="hover:text-[var(--ink)] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--action)] rounded px-1.5 py-1"
          >
            ¿Para quiénes?
          </a>
          <a 
            href="#manifiesto" 
            className="hover:text-[var(--ink)] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--action)] rounded px-1.5 py-1"
          >
            ¿Por qué se creó?
          </a>
        </nav>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onEnterAppDemo}
            className="hidden sm:inline-flex items-center gap-1.5 t-btn t-btn-secondary !h-9 !px-3 text-xs"
            title="Explorar la aplicación completa sin registro"
          >
            <Sparkles className="h-3.5 w-3.5 text-[var(--action)]" />
            <span>Ver Demo</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenAuth('login')}
            className="t-btn t-btn-ghost !h-9 !px-3 text-xs"
          >
            Iniciar Sesión
          </button>

          <button
            type="button"
            onClick={() => onOpenAuth('register')}
            className="t-btn t-btn-primary !h-9 !px-3.5 text-xs font-medium"
          >
            <span>Crear Cuenta</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
