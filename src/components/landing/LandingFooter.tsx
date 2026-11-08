import React from 'react';
import { ArrowUp, Heart, Terminal } from 'lucide-react';

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
    <footer className="border-t border-cyan-500/15 bg-[#050912] py-14 text-slate-400">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* Main Footer Row */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pb-12 border-b border-cyan-500/10">
          
          {/* Brand Info (Span 5) */}
          <div className="md:col-span-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-950 border border-cyan-500/40 text-cyan-400">
                  <Terminal className="h-4 w-4" />
                </div>
                <span className="font-mono text-base font-bold text-white">
                  STUDENT<span className="text-cyan-400">OS</span> PRO
                </span>
              </div>
              <p className="mt-3 text-xs sm:text-sm text-slate-400 max-w-sm leading-relaxed">
                El centro de control unificado, ágil y moderno para organizar tus entregas académicas, entrenamientos y proyectos en un solo lugar.
              </p>
            </div>

            <div className="mt-6 flex items-center gap-2 text-xs font-mono text-slate-500">
              <span>Construido con</span>
              <Heart className="h-3.5 w-3.5 text-rose-500 fill-rose-500" />
              <span>para estudiantes universitarios</span>
            </div>
          </div>

          {/* Navigation Links (Span 3) */}
          <div className="md:col-span-3 font-mono text-xs">
            <h4 className="font-bold text-white uppercase tracking-wider mb-3">
              Navegación
            </h4>
            <ul className="space-y-2">
              <li>
                <a href="#inicio" className="hover:text-cyan-400 transition-colors">
                  Inicio
                </a>
              </li>
              <li>
                <a href="#problema" className="hover:text-cyan-400 transition-colors">
                  Diagnóstico del Problema
                </a>
              </li>
              <li>
                <a href="#para-que-sirve" className="hover:text-cyan-400 transition-colors">
                  ¿Para qué sirve?
                </a>
              </li>
              <li>
                <a href="#para-quienes" className="hover:text-cyan-400 transition-colors">
                  ¿Para quiénes está hecho?
                </a>
              </li>
              <li>
                <a href="#manifiesto" className="hover:text-cyan-400 transition-colors">
                  ¿Por qué se creó?
                </a>
              </li>
            </ul>
          </div>

          {/* Quick Access (Span 4) */}
          <div className="md:col-span-4 font-mono text-xs">
            <h4 className="font-bold text-white uppercase tracking-wider mb-3">
              Acceso Inmediato
            </h4>
            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => onOpenAuth('register')}
                className="w-full text-center rounded-lg border border-cyan-400 bg-cyan-500/10 px-4 py-2 font-semibold text-cyan-300 hover:bg-cyan-500 hover:text-black transition-all cursor-pointer"
              >
                Crear Cuenta con tu Correo
              </button>
              <button
                type="button"
                onClick={onEnterAppDemo}
                className="w-full text-center rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-2 text-slate-300 hover:border-slate-500 hover:text-white transition-all cursor-pointer"
              >
                Probar Demo sin Registro
              </button>
            </div>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono">
          <div className="flex items-center gap-4 text-slate-500">
            <span>© {CURRENT_YEAR} StudentOS. Licencia MIT.</span>
            <span>•</span>
            <span className="text-cyan-400/80">100% Offline-First</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={scrollToTop}
              className="flex items-center gap-1.5 rounded border border-cyan-500/30 bg-[#091220] px-2.5 py-1 text-slate-300 hover:text-cyan-400 hover:border-cyan-400 transition-all cursor-pointer"
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
