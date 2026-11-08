import React from 'react';
import { ArrowUp } from 'lucide-react';

const CURRENT_YEAR = new Date().getFullYear();

interface LandingFooterProps {
  onOpenAuth: (mode: 'login' | 'register') => void;
  onEnterAppDemo: () => void;
}

export const LandingFooter: React.FC<LandingFooterProps> = ({
  onOpenAuth,
  onEnterAppDemo,
}) => {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="border-t border-[var(--line)] bg-[var(--surface)] py-14 text-[var(--muted)] transition-colors">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* Main Footer Row */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pb-12 border-b border-[var(--line)]">
          
          {/* Brand Info (Span 5) */}
          <div className="md:col-span-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-[8px] overflow-hidden border border-[var(--line)] bg-[var(--surface-2)] flex items-center justify-center shrink-0">
                  <img
                    src="/logo.png"
                    alt="Logo de StudentOS"
                    className="w-full h-full object-cover"
                  />
                </div>
                <span className="text-base font-semibold text-[var(--ink)]">
                  StudentOS PRO MAX
                </span>
              </div>
              <p className="mt-3 text-sm text-[var(--muted)] max-w-sm leading-relaxed">
                El centro de control unificado y reactivo para organizar tus entregas académicas, entrenamientos y proyectos en un solo lugar.
              </p>
            </div>

            <div className="mt-6 flex items-center gap-2 text-xs font-mono text-[var(--muted)]">
              <span>Construido para estudiantes de alto rendimiento</span>
            </div>
          </div>

          {/* Navigation Links (Span 3) */}
          <div className="md:col-span-3 font-mono text-xs">
            <h4 className="font-semibold text-[var(--ink)] uppercase tracking-wider mb-3">
              Navegación
            </h4>
            <nav aria-label="Navegación del pie de página">
              <ul className="space-y-1">
                <li>
                  <a 
                    href="#inicio" 
                    className="hover:text-[var(--ink)] transition-colors py-1.5 inline-flex items-center min-h-[36px]"
                    aria-label="Ir al inicio de la página"
                  >
                    Inicio
                  </a>
                </li>
                <li>
                  <a 
                    href="#problema" 
                    className="hover:text-[var(--ink)] transition-colors py-1.5 inline-flex items-center min-h-[36px]"
                    aria-label="Ir a la sección de diagnóstico del problema"
                  >
                    Diagnóstico del Problema
                  </a>
                </li>
                <li>
                  <a 
                    href="#para-que-sirve" 
                    className="hover:text-[var(--ink)] transition-colors py-1.5 inline-flex items-center min-h-[36px]"
                    aria-label="Ir a la sección ¿Para qué sirve?"
                  >
                    ¿Para qué sirve?
                  </a>
                </li>
                <li>
                  <a 
                    href="#para-quienes" 
                    className="hover:text-[var(--ink)] transition-colors py-1.5 inline-flex items-center min-h-[36px]"
                    aria-label="Ir a la sección ¿Para quiénes está hecho?"
                  >
                    ¿Para quiénes está hecho?
                  </a>
                </li>
                <li>
                  <a 
                    href="#manifiesto" 
                    className="hover:text-[var(--ink)] transition-colors py-1.5 inline-flex items-center min-h-[36px]"
                    aria-label="Ir a la sección del manifiesto del creador"
                  >
                    ¿Por qué se creó?
                  </a>
                </li>
              </ul>
            </nav>
          </div>

          {/* Quick Access (Span 4) */}
          <div className="md:col-span-4 font-mono text-xs">
            <h4 className="font-semibold text-[var(--ink)] uppercase tracking-wider mb-3">
              Acceso Inmediato
            </h4>
            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => onOpenAuth('register')}
                className="t-btn t-btn-primary w-full min-h-[44px] text-xs font-medium"
                aria-label="Crear cuenta en StudentOS con tu correo electrónico"
              >
                Crear Cuenta con tu Correo
              </button>
              <button
                type="button"
                onClick={onEnterAppDemo}
                className="t-btn t-btn-secondary w-full min-h-[44px] text-xs font-medium"
                aria-label="Probar demo interactiva de StudentOS sin registrarte"
              >
                Probar Demo sin Registro
              </button>
            </div>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono">
          <div className="flex items-center gap-3 text-[var(--muted)]">
            <span>
              © {CURRENT_YEAR} StudentOS.{' '}
              <a
                href="https://opensource.org/licenses/MIT"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[var(--ink)] underline underline-offset-2 transition-colors"
                aria-label="Ver Licencia MIT de código abierto (abre en una pestaña nueva)"
              >
                Licencia MIT
              </a>
              .
            </span>
            <span>•</span>
            <span className="text-[var(--action)] font-medium">100% Offline-First</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={scrollToTop}
              className="t-btn t-btn-ghost min-h-[44px] px-3 text-xs inline-flex items-center gap-1.5"
              aria-label="Volver arriba al inicio de la página"
              title="Volver arriba"
            >
              <span>Subir</span>
              <ArrowUp className="h-3 w-3" />
            </button>
          </div>
        </div>

      </div>
    </footer>
  );
};
