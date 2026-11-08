import React from 'react';
import { ArrowRight, CheckCircle2, ShieldCheck, Zap, Target } from 'lucide-react';
import { WorkspaceInteractiveMockup } from './visuals/WorkspaceInteractiveMockup';
import { AcademicCadenceHubVisual } from './visuals/AcademicCadenceHubVisual';

interface HeroSectionProps {
  onOpenAuth: (mode: 'login' | 'register') => void;
  onEnterAppDemo: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  onOpenAuth,
  onEnterAppDemo,
}) => {
  return (
    <section 
      id="inicio" 
      className="relative overflow-hidden border-b border-[var(--line)] bg-[var(--bg)] pt-12 pb-20 sm:pt-16 sm:pb-28 transition-colors"
    >
      {/* Subtle structural grid line background */}
      <div 
        className="absolute inset-0 bg-[linear-gradient(to_right,rgba(233,237,243,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(233,237,243,0.03)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_25%,#000_70%,transparent_100%)] pointer-events-none" 
        aria-hidden="true" 
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Main Hero Header */}
        <div className="max-w-3xl">
          <h1 className="font-sans text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-[-0.032em] text-[var(--ink)] leading-[1.12]">
            Menos caos manual. <br />
            <span className="text-[var(--action)]">
              Más tiempo para crecer.
            </span>
          </h1>

          <p className="mt-5 text-base sm:text-lg text-[var(--muted)] max-w-2xl font-normal leading-relaxed">
            Unificamos tus <strong className="text-[var(--ink)] font-medium">entregas por semanas (1..16)</strong>, tus <strong className="text-[var(--ink)] font-medium">rutinas de gimnasio</strong> y tus <strong className="text-[var(--ink)] font-medium">proyectos de código</strong> en un único centro de comando ágil, 100% offline y sin burocracia de formularios.
          </p>

          {/* CTAs */}
          <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5">
            <button
              type="button"
              onClick={() => onOpenAuth('register')}
              className="t-btn t-btn-primary px-6 py-3 font-medium text-sm rounded-xl cursor-pointer shadow-sm hover:shadow-md"
            >
              <span>Comenzar Ahora • Es Gratis</span>
              <ArrowRight className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={onEnterAppDemo}
              className="t-btn t-btn-secondary px-6 py-3 font-medium text-sm rounded-xl cursor-pointer"
            >
              <Zap className="h-4 w-4 text-[var(--action)]" />
              <span>Explorar Demo en Vivo</span>
            </button>
          </div>

          {/* Micro trust indicators */}
          <div className="mt-6 flex flex-wrap items-center gap-4 text-xs font-mono text-[var(--muted)]">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-[var(--ok)]" />
              100% Privado (Tus datos en tu navegador)
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-[var(--action)]" />
              Sin suscripciones ni cobros ocultos
            </span>
          </div>
        </div>

        {/* Visuals Showcase Split Grid: 100% Real Product UI, Zero Cartoon SVGs */}
        <div className="mt-14 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Visual: The Live Interactive Workspace Interface */}
          <div className="lg:col-span-6 flex flex-col items-center w-full">
            <WorkspaceInteractiveMockup onEnterApp={onEnterAppDemo} />
          </div>

          {/* Right Visual: The Academic Cadence & Dual Engine Matrix */}
          <div className="lg:col-span-6 flex flex-col items-center w-full">
            <AcademicCadenceHubVisual />
          </div>
        </div>

        {/* ---------------- 3 VALUE PILLS ROW: AUTHENTIC ICONS & REASONED TYPOGRAPHY ---------------- */}
        <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="t-card p-5 flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-2)] border border-[var(--line)] text-[var(--action)]">
              <Target className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[var(--ink)]">
                Escalar sin quemarte (Anti-Burnout)
              </h3>
              <p className="mt-1 text-xs text-[var(--muted)] leading-relaxed">
                Llega a tus exámenes parciales y finales con notas ponderadas calculadas y entrenamientos cumplidos.
              </p>
            </div>
          </div>

          <div className="t-card p-5 flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-2)] border border-[var(--line)] text-[var(--action)]">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[var(--ink)]">
                Automatización Zero-Burocracia
              </h3>
              <p className="mt-1 text-xs text-[var(--muted)] leading-relaxed">
                Escribe en el encabezado de Kanban y presiona Enter. Marca tus series en 1 tap sin llenar formularios.
              </p>
            </div>
          </div>

          <div className="t-card p-5 flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-2)] border border-[var(--line)] text-[var(--ok)]">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[var(--ink)]">
                Control Total y Soberanía Local
              </h3>
              <p className="mt-1 text-xs text-[var(--muted)] leading-relaxed">
                Rachas diarias de consistencia, horario sincronizado y respaldo local inmediato en archivo .json.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
