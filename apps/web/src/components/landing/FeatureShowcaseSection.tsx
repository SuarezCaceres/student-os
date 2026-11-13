import React, { useState } from 'react';
import { 
  GraduationCap, 
  Dumbbell, 
  Kanban, 
  Calendar, 
  Check, 
  Clock, 
  Flame, 
  Award
} from 'lucide-react';

export const FeatureShowcaseSection: React.FC = () => {
  // Interactive mini gym series state for demo
  const [completedSets, setCompletedSets] = useState<number[]>([1, 2]);

  const toggleSet = (setNum: number) => {
    setCompletedSets((prev) =>
      prev.includes(setNum) ? prev.filter((s) => s !== setNum) : [...prev, setNum]
    );
  };

  return (
    <section 
      id="para-que-sirve" 
      className="relative border-b border-[var(--line)] bg-[var(--bg)] py-20 sm:py-28 transition-colors"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto">
          <h2 className="font-sans text-3xl sm:text-4xl font-semibold tracking-[-0.03em] text-[var(--ink)]">
            ¿Para qué está hecho <span className="text-[var(--action)]">StudentOS</span>?
          </h2>

          <p className="mt-4 text-base text-[var(--muted)] leading-relaxed">
            Elimina el desorden de 5 aplicaciones distintas y reúne en un solo centro de control 
            las dimensiones reales del estudiante universitario:
          </p>
        </div>

        {/* Bento Grid Showcase */}
        <div className="mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6">

          {/* Module 1: Semanas Académicas (Span 7) */}
          <div className="lg:col-span-7 t-card p-6 sm:p-8 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--surface-2)] border border-[var(--line)] text-[var(--action)]">
                    <GraduationCap className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-sans text-xl font-semibold text-[var(--ink)]">
                      Entregas por Semanas (1 a 16)
                    </h3>
                  </div>
                </div>
                <span className="font-mono text-xs text-[var(--action)] bg-[color-mix(in_oklab,var(--action)_12%,transparent)] border border-[color-mix(in_oklab,var(--action)_25%,transparent)] px-2.5 py-1 rounded-full">
                  Semana 5 en Curso
                </span>
              </div>

              <p className="mt-4 text-sm text-[var(--muted)] leading-relaxed">
                Diseñado alrededor de la estructura real del semestre. Destaca automáticamente semanas de <strong className="text-[var(--ink)] font-medium">Exámenes Parciales</strong> y <strong className="text-[var(--ink)] font-medium">Finales</strong>, con semáforo de urgencia y cálculo de nota ponderada.
              </p>

              {/* Live Preview Card */}
              <div className="mt-6 rounded-xl border border-[var(--line)] bg-[var(--surface-2)]/60 p-4 font-mono">
                <div className="flex items-center justify-between text-xs text-[var(--muted)] border-b border-[var(--line)] pb-2">
                  <span>Cálculo Multivariable • 25% Nota</span>
                  <span className="text-[var(--warn)] font-semibold">¡Vence en 2 días!</span>
                </div>
                <div className="mt-2.5 flex items-center justify-between gap-2">
                  <div className="text-sm font-medium text-[var(--ink)]">
                    Proyecto 2: Optimización con Multiplicadores de Lagrange
                  </div>
                  <span className="rounded bg-[color-mix(in_oklab,var(--ok)_14%,transparent)] border border-[color-mix(in_oklab,var(--ok)_30%,transparent)] px-2 py-0.5 text-xs text-[var(--ok)] font-medium">
                    Prioridad Alta
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center gap-2 text-xs font-mono text-[var(--muted)]">
              <Check className="h-4 w-4 text-[var(--ok)]" />
              <span>Calculadora de promedios para saber exactamente cuánto necesitas sacar</span>
            </div>
          </div>

          {/* Module 2: Gym Tracker con Series Interactivas (Span 5) */}
          <div className="lg:col-span-5 t-card p-6 sm:p-8 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[color-mix(in_oklab,var(--gym)_12%,transparent)] border border-[color-mix(in_oklab,var(--gym)_30%,transparent)] text-[var(--gym)]">
                  <Dumbbell className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-sans text-xl font-semibold text-[var(--ink)]">
                    Gym & Fitness Tracker
                  </h3>
                </div>
              </div>

              <p className="mt-4 text-sm text-[var(--muted)] leading-relaxed">
                Registra tus entrenamientos de fuerza sin fricción. Toca para marcar tus series con un solo toque y mantén tu constancia incluso en exámenes.
              </p>

              {/* Interactive Series Demo */}
              <div className="mt-6 rounded-xl border border-[var(--line)] bg-[var(--surface-2)]/60 p-4">
                <div className="flex items-center justify-between text-xs font-mono text-[var(--muted)] mb-2">
                  <span className="font-medium text-[var(--ink)]">Press de Banca Plano</span>
                  <span className="text-[var(--gym)] font-semibold">4x10 • 80kg</span>
                </div>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4].map((set) => {
                    const isDone = completedSets.includes(set);
                    return (
                      <button
                        key={set}
                        type="button"
                        onClick={() => toggleSet(set)}
                        className={`flex-1 py-2 rounded-lg font-mono text-xs font-medium transition-all cursor-pointer border ${
                          isDone
                            ? 'bg-[color-mix(in_oklab,var(--gym)_18%,transparent)] border-[var(--gym)] text-[var(--gym)]'
                            : 'bg-[var(--surface)] text-[var(--muted)] border-[var(--line)] hover:border-[var(--line-strong)] hover:text-[var(--ink)]'
                        }`}
                        title="Haz clic para probar cómo se marca una serie"
                      >
                        S{set} {isDone ? '✓' : ''}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-2 text-xs font-mono text-[var(--muted)] text-center">
                  Toca las series para probar la interacción rápida
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center gap-2 text-xs font-mono text-[var(--muted)]">
              <Flame className="h-4 w-4 text-[var(--gym)]" />
              <span>Contador de Racha Diaria (🔥) para forjar disciplina inquebrantable</span>
            </div>
          </div>

          {/* Module 3: Kanban Ágil de Proyectos (Span 6) */}
          <div className="lg:col-span-6 t-card p-6 sm:p-8 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--surface-2)] border border-[var(--line)] text-[var(--action)]">
                  <Kanban className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-sans text-xl font-semibold text-[var(--ink)]">
                    Tablero Kanban Ágil
                  </h3>
                </div>
              </div>

              <p className="mt-4 text-sm text-[var(--muted)] leading-relaxed">
                Gestiona tus proyectos de software, tareas freelance y compromisos con columnas ágiles: <strong className="text-[var(--ink)] font-medium">Por Hacer</strong>, <strong className="text-[var(--ink)] font-medium">En Progreso</strong> y <strong className="text-[var(--ink)] font-medium">Completado</strong> con inserción instantánea.
              </p>

              {/* Kanban Visual Pill Preview */}
              <div className="mt-6 grid grid-cols-3 gap-2 font-mono text-xs">
                <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-2)]/60 p-2.5">
                  <div className="text-[var(--muted)] font-medium mb-1">Por Hacer</div>
                  <div className="rounded bg-[var(--surface)] border border-[var(--line)] p-1.5 text-xs text-[var(--ink)]">
                    API REST con FastAPI
                  </div>
                </div>
                <div className="rounded-lg border border-[color-mix(in_oklab,var(--action)_30%,transparent)] bg-[color-mix(in_oklab,var(--action)_8%,transparent)] p-2.5">
                  <div className="text-[var(--action)] font-medium mb-1">En Progreso</div>
                  <div className="rounded bg-[var(--surface)] border border-[color-mix(in_oklab,var(--action)_30%,transparent)] p-1.5 text-xs text-[var(--action)]">
                    Modelo de Base de Datos
                  </div>
                </div>
                <div className="rounded-lg border border-[color-mix(in_oklab,var(--ok)_30%,transparent)] bg-[color-mix(in_oklab,var(--ok)_8%,transparent)] p-2.5">
                  <div className="text-[var(--ok)] font-medium mb-1">Completado</div>
                  <div className="rounded bg-[var(--surface)] border border-[color-mix(in_oklab,var(--ok)_30%,transparent)] p-1.5 text-xs text-[var(--ok)]">
                    Diagrama ERD ✓
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center gap-2 text-xs font-mono text-[var(--muted)]">
              <Award className="h-4 w-4 text-[var(--action)]" />
              <span>Celebración con confeti al completar tareas importantes</span>
            </div>
          </div>

          {/* Module 4: Horario Semanal Cronológico (Span 6) */}
          <div className="lg:col-span-6 t-card p-6 sm:p-8 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--surface-2)] border border-[var(--line)] text-[var(--action)]">
                  <Calendar className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-sans text-xl font-semibold text-[var(--ink)]">
                    Horario Semanal Inteligente
                  </h3>
                </div>
              </div>

              <p className="mt-4 text-sm text-[var(--muted)] leading-relaxed">
                Visualización que detecta automáticamente el día <strong className="text-[var(--action)] font-medium">HOY</strong> y agrupa clases, bloques de entrenamiento y estudio en código de color semántico.
              </p>

              {/* Live Preview Schedule snippet */}
              <div className="mt-6 rounded-xl border border-[var(--line)] bg-[var(--surface-2)]/60 p-4 font-mono text-xs">
                <div className="flex items-center justify-between text-[var(--muted)] border-b border-[var(--line)] pb-2">
                  <span className="text-[var(--action)] font-semibold">HOY • MIÉRCOLES</span>
                  <span className="text-[var(--ink)]">3 Bloques Programados</span>
                </div>
                <div className="mt-2.5 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between rounded bg-[color-mix(in_oklab,var(--action)_10%,transparent)] border border-[color-mix(in_oklab,var(--action)_25%,transparent)] px-2.5 py-1.5 text-[var(--action)]">
                    <span>08:00 - 10:00 • Arquitectura de Software</span>
                    <span className="text-xs text-[var(--muted)]">Clase</span>
                  </div>
                  <div className="flex items-center justify-between rounded bg-[color-mix(in_oklab,var(--gym)_10%,transparent)] border border-[color-mix(in_oklab,var(--gym)_25%,transparent)] px-2.5 py-1.5 text-[var(--gym)]">
                    <span>17:00 - 18:30 • Entrenamiento Torso Power</span>
                    <span className="text-xs text-[var(--muted)]">Gym</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center gap-2 text-xs font-mono text-[var(--muted)]">
              <Clock className="h-4 w-4 text-[var(--action)]" />
              <span>Exportación instantánea a archivo .ICS para sincronizar con tu Google Calendar</span>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
};
