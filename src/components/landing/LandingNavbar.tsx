import React from 'react';
import { ArrowRight, Sparkles, Terminal } from 'lucide-react';

interface LandingNavbarProps {
  onOpenAuth: (mode: 'login' | 'register') => void;
  onEnterAppDemo: () => void;
}

export const LandingNavbar: React.FC<LandingNavbarProps> = ({
  onOpenAuth,
  onEnterAppDemo,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-cyan-500/15 bg-[#090d16]/85 backdrop-blur-md transition-all">
      <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand Logo & Tag */}
        <a 
          href="#inicio" 
          className="flex items-center gap-3 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 rounded-lg"
        >
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-sky-700 p-0.5 shadow-[0_0_15px_rgba(6,182,212,0.4)] group-hover:shadow-[0_0_22px_rgba(6,182,212,0.7)] transition-all">
            <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-[#070c16]">
              <Terminal className="h-5 w-5 text-cyan-400 group-hover:scale-110 transition-transform" />
            </div>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-base font-bold tracking-tight text-white group-hover:text-cyan-300 transition-colors">
                STUDENT<span className="text-cyan-400">OS</span>
              </span>
              <span className="rounded border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.2 font-mono text-[10px] font-semibold text-cyan-300">
                PRO
              </span>
            </div>
            <span className="text-[11px] text-slate-400">Life, Gym & College Hub</span>
          </div>
        </a>

        {/* Section Navigation Links (Desktop) */}
        <nav className="hidden md:flex items-center gap-6 font-mono text-xs text-slate-300" aria-label="Navegación principal">
          <a 
            href="#problema" 
            className="hover:text-cyan-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 rounded px-1.5 py-1"
          >
            Diagnóstico
          </a>
          <a 
            href="#para-que-sirve" 
            className="hover:text-cyan-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 rounded px-1.5 py-1"
          >
            ¿Para qué sirve?
          </a>
          <a 
            href="#para-quienes" 
            className="hover:text-cyan-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 rounded px-1.5 py-1"
          >
            ¿Para quiénes?
          </a>
          <a 
            href="#manifiesto" 
            className="hover:text-cyan-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 rounded px-1.5 py-1"
          >
            ¿Por qué se creó?
          </a>
        </nav>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onEnterAppDemo}
            className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-slate-700/80 bg-slate-800/40 px-3 py-1.5 font-mono text-xs font-medium text-slate-300 hover:border-cyan-500/50 hover:bg-slate-800 hover:text-white transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            title="Explorar la aplicación completa sin registro"
          >
            <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
            <span>Ver Demo</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenAuth('login')}
            className="rounded-lg border border-slate-700/60 bg-transparent px-3 py-1.5 font-mono text-xs font-medium text-slate-200 hover:border-slate-500 hover:text-white transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            Iniciar Sesión
          </button>

          <button
            type="button"
            onClick={() => onOpenAuth('register')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-400 bg-cyan-500 px-3.5 py-1.5 font-mono text-xs font-semibold text-black hover:bg-cyan-400 hover:shadow-[0_0_16px_rgba(6,182,212,0.6)] active:scale-95 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          >
            <span>Crear Cuenta</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
