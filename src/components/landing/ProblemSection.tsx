import React from 'react';
import { AlertCircle, CalendarX2, Dumbbell, Layers } from 'lucide-react';
import { StudentSoloFocusVisual } from './visuals/StudentSoloFocusVisual';

export const ProblemSection: React.FC = () => {
  return (
    <section 
      id="problema" 
      className="relative border-b border-cyan-500/15 bg-[#070b14] py-20 sm:py-28"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Column: Heading + Story + Student Visual with Idea Sun */}
          <div className="lg:col-span-5 flex flex-col">
            <div className="inline-flex items-center gap-2 rounded-md border border-cyan-500/30 bg-cyan-950/40 px-3 py-1 font-mono text-xs font-semibold text-cyan-300 w-fit">
              <AlertCircle className="h-3.5 w-3.5 text-cyan-400" />
              <span>EL DIAGNÓSTICO REAL</span>
            </div>

            <h2 className="mt-4 font-sans text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
              ¿Qué está saboteando <br />
              <span className="text-cyan-400">tu semestre y tu tiempo?</span>
            </h2>

            <p className="mt-4 text-sm sm:text-base text-slate-300 leading-relaxed">
              La mayoría de herramientas tradicionales como Notion, Jira o simples notas de celular están pensadas para empresas corporativas, no para el ritmo salvaje de un ciclo universitario de 16 semanas.
            </p>

            {/* Visual: Student on Laptop with glowing ideas */}
            <div className="mt-8 flex justify-center lg:justify-start">
              <div className="rounded-2xl border border-cyan-500/20 bg-[#091120]/70 p-4 backdrop-blur-sm">
                <StudentSoloFocusVisual />
                <div className="mt-2 text-center font-mono text-[11px] text-slate-400">
                  Estudiante reflexionando antes de descubrir StudentOS
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: 3 Problem Breakdown Cards (Direct inspiration from user's image) */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            
            {/* Problem Card 1 */}
            <div className="group rounded-xl border border-cyan-500/20 bg-[#091222] p-5.5 hover:border-cyan-400/50 hover:bg-[#0c172b] transition-all">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-950/60 text-cyan-400 group-hover:scale-105 transition-transform">
                  <CalendarX2 className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-mono text-sm sm:text-base font-bold text-white group-hover:text-cyan-300 transition-colors">
                      Entregas y semanas académicas invisibles
                    </h3>
                    <span className="font-mono text-xs text-rose-400/90 bg-rose-950/40 border border-rose-500/30 px-2 py-0.5 rounded">
                      Fricción Crítica
                    </span>
                  </div>
                  <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
                    Notion y Google Calendar no tienen idea de qué es la <strong className="text-slate-100">Semana 8 de parciales</strong> ni la <strong className="text-slate-100">Semana 16 de finales</strong>. Registrar una tarea requiere rellenar 6 propiedades, y al final terminas perdiendo fechas clave por desorden.
                  </p>
                </div>
              </div>
            </div>

            {/* Problem Card 2 */}
            <div className="group rounded-xl border border-cyan-500/20 bg-[#091222] p-5.5 hover:border-cyan-400/50 hover:bg-[#0c172b] transition-all">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-950/60 text-cyan-400 group-hover:scale-105 transition-transform">
                  <Dumbbell className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-mono text-sm sm:text-base font-bold text-white group-hover:text-cyan-300 transition-colors">
                      Gym y salud física totalmente aislados
                    </h3>
                    <span className="font-mono text-xs text-amber-400/90 bg-amber-950/40 border border-amber-500/30 px-2 py-0.5 rounded">
                      Inconsistencia
                    </span>
                  </div>
                  <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
                    Tener que abrir una app pesada de fitness en medio de una serie pesada en el gimnasio es frustrante. Terminas dejando de registrar tu sobrecarga progresiva y perdiendo tu disciplina de entrenamiento durante la época de exámenes.
                  </p>
                </div>
              </div>
            </div>

            {/* Problem Card 3 */}
            <div className="group rounded-xl border border-cyan-500/20 bg-[#091222] p-5.5 hover:border-cyan-400/50 hover:bg-[#0c172b] transition-all">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-950/60 text-cyan-400 group-hover:scale-105 transition-transform">
                  <Layers className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-mono text-sm sm:text-base font-bold text-white group-hover:text-cyan-300 transition-colors">
                      Dispersión mental en 5 apps distintas
                    </h3>
                    <span className="font-mono text-xs text-cyan-400/90 bg-cyan-950/40 border border-cyan-500/30 px-2 py-0.5 rounded">
                      Sobrecarga Cognitiva
                    </span>
                  </div>
                  <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
                    Notas de voz en WhatsApp para tareas grupales, Trello para código, Notion para apuntes y notas rápidas en el celular. Esa fragmentación drena tu energía mental antes de que puedas empezar a producir de verdad.
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
};
