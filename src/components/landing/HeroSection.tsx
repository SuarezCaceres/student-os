import React from 'react';
import { ArrowRight, CheckCircle2, ShieldCheck, Zap } from 'lucide-react';
import { StudentLaptopDuoVisual } from './visuals/StudentLaptopDuoVisual';
import { LabFlaskNucleusVisual } from './visuals/LabFlaskNucleusVisual';

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
      className="relative overflow-hidden border-b border-cyan-500/15 bg-[#080d18] pt-12 pb-20 sm:pt-16 sm:pb-28"
    >
      {/* Ambient background glow grid */}
      <div 
        className="absolute inset-0 bg-[linear-gradient(to_right,#00f0ff08_1px,transparent_1px),linear-gradient(to_bottom,#00f0ff08_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_30%,#000_70%,transparent_100%)] pointer-events-none" 
        aria-hidden="true" 
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Top Status Capsule Pill */}
        <div className="flex justify-center sm:justify-start mb-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-950/40 px-3.5 py-1 text-xs font-mono text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.25)]">
            <span className="flex h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
            <span>Versión 2.0 • Diseñado por y para universitarios</span>
          </div>
        </div>

        {/* Main Hero Header */}
        <div className="max-w-3xl">
          <h1 className="font-sans text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.12]">
            Menos caos manual. <br />
            <span className="bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-400 bg-clip-text text-transparent drop-shadow-[0_4px_24px_rgba(6,182,212,0.4)]">
              Más tiempo para crecer.
            </span>
          </h1>
          <p className="mt-5 text-base sm:text-lg text-slate-300 max-w-2xl font-normal leading-relaxed">
            Unificamos tus <strong className="text-white font-semibold">entregas académicas por semanas (1..16)</strong>, tus <strong className="text-white font-semibold">rutinas de gimnasio</strong> y tus <strong className="text-white font-semibold">proyectos de código</strong> en un único centro de comando ágil, 100% offline y sin formularios lentos.
          </p>

          {/* CTAs */}
          <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5">
            <button
              type="button"
              onClick={() => onOpenAuth('register')}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-400 bg-cyan-400 px-6 py-3 font-mono text-sm font-bold text-black shadow-[0_0_24px_rgba(6,182,212,0.45)] hover:bg-cyan-300 hover:shadow-[0_0_32px_rgba(6,182,212,0.7)] active:scale-98 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
            >
              <span>Comenzar Ahora • Es Gratis</span>
              <ArrowRight className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={onEnterAppDemo}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900/80 px-6 py-3 font-mono text-sm font-semibold text-slate-200 hover:border-cyan-500/60 hover:bg-slate-800 hover:text-white transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              <Zap className="h-4 w-4 text-cyan-400" />
              <span>Explorar Demo en Vivo</span>
            </button>
          </div>

          {/* Micro trust indicators */}
          <div className="mt-6 flex flex-wrap items-center gap-4 text-xs font-mono text-slate-400">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-cyan-400" />
              100% Privado (Tus datos en tu navegador)
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-cyan-400" />
              Sin suscripciones ni cobros ocultos
            </span>
          </div>
        </div>

        {/* Visuals Showcase Split Grid (Jóvenes en laptop + Matraz) */}
        <div className="mt-14 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Visual: Two Students Coding with Laptops and Headphones */}
          <div className="lg:col-span-6 flex flex-col items-center">
            <div className="w-full rounded-2xl border border-cyan-500/20 bg-[#070d18]/80 p-5 shadow-[0_8px_32px_rgba(0,0,0,0.6)] backdrop-blur-sm relative group hover:border-cyan-500/40 transition-all">
              <div className="flex items-center justify-between pb-3 border-b border-cyan-500/15 mb-4">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
                  <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/80" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
                  <span className="font-mono text-xs text-slate-400 ml-2">workspace/students.dev</span>
                </div>
                <span className="font-mono text-[11px] text-cyan-400 font-semibold bg-cyan-950/60 border border-cyan-500/30 px-2 py-0.5 rounded">
                  EN FOCO
                </span>
              </div>
              <StudentLaptopDuoVisual />
              <div className="mt-3 flex items-center justify-between text-xs font-mono text-slate-400 border-t border-cyan-500/10 pt-3">
                <span className="text-slate-300 font-medium">Arquitectura de alto rendimiento</span>
                <span className="text-cyan-400">0.0s latencia</span>
              </div>
            </div>
          </div>

          {/* Right Visual: The High-Tech Science Flask (Problem, Analysis, Solution) */}
          <div className="lg:col-span-6 flex flex-col items-center">
            <div className="w-full rounded-2xl border border-cyan-500/20 bg-[#070d18]/80 p-5 shadow-[0_8px_32px_rgba(0,0,0,0.6)] backdrop-blur-sm relative group hover:border-cyan-500/40 transition-all">
              <div className="flex items-center justify-between pb-3 border-b border-cyan-500/15 mb-4">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-slate-400">laboratorio/nucleo-productivo</span>
                </div>
                <span className="font-mono text-[11px] text-sky-400 font-semibold bg-sky-950/60 border border-sky-500/30 px-2 py-0.5 rounded">
                  ALGORITMO ACADÉMICO
                </span>
              </div>
              <LabFlaskNucleusVisual />
              <div className="mt-3 text-center text-xs font-mono text-slate-400 border-t border-cyan-500/10 pt-3">
                Transforma el caos desestructurado en un flujo de trabajo continuo
              </div>
            </div>
          </div>
        </div>

        {/* ---------------- 3 VALUE PILLS ROW (DIRECT MATCH FROM USER PHOTO) ---------------- */}
        <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-start gap-3.5 rounded-xl border border-cyan-500/20 bg-[#0a1120] p-4.5 hover:border-cyan-500/40 hover:-translate-y-0.5 transition-all">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan-950/80 border border-cyan-500/30 text-cyan-400">
              <span className="font-mono font-bold text-sm">01</span>
            </div>
            <div>
              <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-cyan-400">
                Misión
              </h3>
              <p className="mt-0.5 text-sm font-semibold text-white">
                Escalar sin quemarte (Anti-Burnout)
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Llega a tus exámenes finales con notas calculadas y entrenamientos cumplidos.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5 rounded-xl border border-cyan-500/20 bg-[#0a1120] p-4.5 hover:border-cyan-500/40 hover:-translate-y-0.5 transition-all">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan-950/80 border border-cyan-500/30 text-cyan-400">
              <Zap className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-cyan-400">
                Automatización
              </h3>
              <p className="mt-0.5 text-sm font-semibold text-white">
                Cero formularios pesados
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Escribe en el encabezado de Kanban y presiona Enter. Marca tus series en 1 tap.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5 rounded-xl border border-cyan-500/20 bg-[#0a1120] p-4.5 hover:border-cyan-500/40 hover:-translate-y-0.5 transition-all">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan-950/80 border border-cyan-500/30 text-cyan-400">
              <span className="font-mono font-bold text-sm">03</span>
            </div>
            <div>
              <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-cyan-400">
                Control Total
              </h3>
              <p className="mt-0.5 text-sm font-semibold text-white">
                Seguimiento continuo en tiempo real
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Rachas diarias de consistencia, horario sincronizado y respaldo local inmediato.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
