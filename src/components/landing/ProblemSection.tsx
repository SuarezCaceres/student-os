import React from 'react';
import { CalendarX2, Dumbbell, Layers } from 'lucide-react';
import { DiagnosticComparisonVisual } from './visuals/DiagnosticComparisonVisual';

export const ProblemSection: React.FC = () => {
  return (
    <section 
      id="problema" 
      className="relative border-b border-[var(--line)] bg-[var(--surface)] py-20 sm:py-28 transition-colors"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Column: Heading + Story + Diagnostic Flow Visual */}
          <div className="lg:col-span-5 flex flex-col">
            <h2 className="font-sans text-3xl sm:text-4xl font-semibold tracking-[-0.03em] text-[var(--ink)] leading-tight">
              ¿Qué está saboteando <br />
              <span className="text-[var(--danger)]">tu semestre y tu tiempo?</span>
            </h2>

            <p className="mt-4 text-sm sm:text-base text-[var(--muted)] leading-relaxed">
              Las herramientas tradicionales como Notion, Jira o simples notas de celular están diseñadas para empresas corporativas, no para el ritmo exigente de un ciclo universitario de 16 semanas con entrenamientos diarios de fuerza.
            </p>

            {/* Visual: Diagnostic Architecture Comparison */}
            <div className="mt-8">
              <DiagnosticComparisonVisual />
            </div>
          </div>

          {/* Right Column: 3 Problem Breakdown Cards */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            
            {/* Problem Card 1 */}
            <div className="t-card p-6 flex items-start gap-4 hover:border-[var(--line-strong)] transition-colors">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[color-mix(in_oklab,var(--danger)_30%,transparent)] bg-[color-mix(in_oklab,var(--danger)_10%,transparent)] text-[var(--danger)]">
                <CalendarX2 className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-base font-semibold text-[var(--ink)]">
                    Entregas y semanas académicas invisibles
                  </h3>
                  <span className="font-mono text-xs text-[var(--danger)] bg-[color-mix(in_oklab,var(--danger)_12%,transparent)] border border-[color-mix(in_oklab,var(--danger)_30%,transparent)] px-2 py-0.5 rounded">
                    Fricción Crítica
                  </span>
                </div>
                <p className="mt-2 text-sm text-[var(--muted)] leading-relaxed">
                  Notion y Google Calendar no tienen idea de qué es la <strong className="text-[var(--ink)] font-medium">Semana 8 de parciales</strong> ni la <strong className="text-[var(--ink)] font-medium">Semana 16 de finales</strong>. Registrar una tarea requiere rellenar 6 propiedades, y al final terminas perdiendo fechas clave por desorden.
                </p>
              </div>
            </div>

            {/* Problem Card 2 */}
            <div className="t-card p-6 flex items-start gap-4 hover:border-[var(--line-strong)] transition-colors">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[color-mix(in_oklab,var(--warn)_30%,transparent)] bg-[color-mix(in_oklab,var(--warn)_10%,transparent)] text-[var(--warn)]">
                <Dumbbell className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-base font-semibold text-[var(--ink)]">
                    Gym y disciplina física totalmente aislados
                  </h3>
                  <span className="font-mono text-xs text-[var(--warn)] bg-[color-mix(in_oklab,var(--warn)_12%,transparent)] border border-[color-mix(in_oklab,var(--warn)_30%,transparent)] px-2 py-0.5 rounded">
                    Inconsistencia
                  </span>
                </div>
                <p className="mt-2 text-sm text-[var(--muted)] leading-relaxed">
                  Tener que abrir una app pesada de fitness en medio de una serie intensa es incómodo. Terminas descuidando el registro de tu sobrecarga progresiva y perdiendo tu constancia deportiva justo en épocas de exámenes.
                </p>
              </div>
            </div>

            {/* Problem Card 3 */}
            <div className="t-card p-6 flex items-start gap-4 hover:border-[var(--line-strong)] transition-colors">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--line-strong)] bg-[var(--surface-2)] text-[var(--action)]">
                <Layers className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-base font-semibold text-[var(--ink)]">
                    Dispersión mental en 5 apps distintas
                  </h3>
                  <span className="font-mono text-xs text-[var(--action)] bg-[color-mix(in_oklab,var(--action)_12%,transparent)] border border-[color-mix(in_oklab,var(--action)_30%,transparent)] px-2 py-0.5 rounded">
                    Sobrecarga Cognitiva
                  </span>
                </div>
                <p className="mt-2 text-sm text-[var(--muted)] leading-relaxed">
                  Notas sueltas en mensajería para proyectos de grupo, tableros lentos para código, Notion para apuntes y recordatorios en el móvil. Esa fragmentación agota tu foco antes de que puedas empezar a estudiar de verdad.
                </p>
              </div>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
};
