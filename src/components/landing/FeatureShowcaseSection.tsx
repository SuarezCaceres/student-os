import React, { useState } from 'react';
import { 
  GraduationCap, 
  Dumbbell, 
  Kanban, 
  Calendar, 
  Check, 
  Clock, 
  Flame, 
  Sparkles,
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
      className="relative border-b border-cyan-500/15 bg-[#080e1c] py-20 sm:py-28"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-md border border-cyan-500/30 bg-cyan-950/40 px-3 py-1 font-mono text-xs font-semibold text-cyan-300">
            <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
            <span>SOLUCIÓN ARQUITECTÓNICA</span>
          </div>

          <h2 className="mt-4 font-sans text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            ¿Para qué está hecho <span className="text-cyan-400">StudentOS</span>?
          </h2>

          <p className="mt-4 text-base text-slate-300 leading-relaxed">
            Elimina el desorden de 5 aplicaciones distintas y reúne en un solo centro de control 
            las 4 dimensiones reales del estudiante moderno:
          </p>
        </div>

        {/* Bento Grid Showcase */}
        <div className="mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6">

          {/* Module 1: Semanas Académicas (Span 7) */}
          <div className="lg:col-span-7 rounded-2xl border border-cyan-500/20 bg-[#091326] p-6 sm:p-8 flex flex-col justify-between hover:border-cyan-400/50 transition-all">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-950 border border-cyan-500/30 text-cyan-400">
                    <GraduationCap className="h-6 w-6" />
                  </div>
                  <div>
                    <span className="font-mono text-xs font-bold uppercase tracking-wider text-cyan-400">
                      Módulo 01
                    </span>
                    <h3 className="font-sans text-xl font-bold text-white">
                      Entregas por Semanas (1 a 16)
                    </h3>
                  </div>
                </div>
                <span className="font-mono text-xs text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 px-2.5 py-1 rounded-full">
                  Semana 8 en Curso
                </span>
              </div>

              <p className="mt-4 text-sm text-slate-300 leading-relaxed">
                Diseñado alrededor de la estructura real del semestre. Destaca automáticamente semanas de <strong className="text-cyan-300">Exámenes Parciales</strong> y <strong className="text-cyan-300">Finales</strong>, con semáforo de urgencia y cálculo de nota ponderada.
              </p>

              {/* Live Preview Card */}
              <div className="mt-6 rounded-xl border border-cyan-500/30 bg-[#060c18] p-4 font-mono">
                <div className="flex items-center justify-between text-xs text-slate-400 border-b border-cyan-500/10 pb-2">
                  <span>Cálculo Multivariable • 25% Nota</span>
                  <span className="text-amber-400 font-semibold">¡Vence en 2 días!</span>
                </div>
                <div className="mt-2.5 flex items-center justify-between">
                  <div className="text-sm font-bold text-white">
                    Proyecto 2: Optimización con Multiplicadores de Lagrange
                  </div>
                  <span className="rounded bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-xs text-emerald-400 font-semibold">
                    Prioridad Alta
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center gap-2 text-xs font-mono text-slate-400">
              <Check className="h-4 w-4 text-cyan-400" />
              <span>Calculadora de promedios para saber exactamente cuánto necesitas sacar</span>
            </div>
          </div>

          {/* Module 2: Gym Tracker con Series Interactivas (Span 5) */}
          <div className="lg:col-span-5 rounded-2xl border border-cyan-500/20 bg-[#091326] p-6 sm:p-8 flex flex-col justify-between hover:border-cyan-400/50 transition-all">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-950/60 border border-orange-500/30 text-orange-400">
                  <Dumbbell className="h-6 w-6" />
                </div>
                <div>
                  <span className="font-mono text-xs font-bold uppercase tracking-wider text-orange-400">
                    Módulo 02
                  </span>
                  <h3 className="font-sans text-xl font-bold text-white">
                    Gym & Fitness Tracker
                  </h3>
                </div>
              </div>

              <p className="mt-4 text-sm text-slate-300 leading-relaxed">
                Registra tus entrenamientos de fuerza sin fricción. Toca para marcar tus series con un solo toque y mantén tu constancia incluso en exámenes.
              </p>

              {/* Interactive Series Demo */}
              <div className="mt-6 rounded-xl border border-orange-500/20 bg-[#070e1b] p-4">
                <div className="flex items-center justify-between text-xs font-mono text-slate-300 mb-2">
                  <span className="font-bold text-white">Press de Banca Inclinado</span>
                  <span className="text-orange-400 font-semibold">4x10 • 70kg</span>
                </div>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4].map((set) => {
                    const isDone = completedSets.includes(set);
                    return (
                      <button
                        key={set}
                        type="button"
                        onClick={() => toggleSet(set)}
                        className={`flex-1 py-2 rounded-lg font-mono text-xs font-bold transition-all cursor-pointer ${
                          isDone
                            ? 'bg-orange-500 text-black shadow-[0_0_12px_rgba(249,115,22,0.4)]'
                            : 'bg-slate-800/80 text-slate-400 border border-slate-700 hover:border-orange-500/50'
                        }`}
                        title="Haz clic para probar cómo se marca una serie"
                      >
                        S{set} {isDone ? '✓' : ''}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-2 text-[11px] font-mono text-slate-400 text-center">
                  💡 Haz clic en las series para probar la interacción rápida
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center gap-2 text-xs font-mono text-slate-400">
              <Flame className="h-4 w-4 text-orange-400" />
              <span>Contador de Racha Diaria (🔥) para forjar disciplina inquebrantable</span>
            </div>
          </div>

          {/* Module 3: Kanban Ágil de Proyectos (Span 6) */}
          <div className="lg:col-span-6 rounded-2xl border border-cyan-500/20 bg-[#091326] p-6 sm:p-8 flex flex-col justify-between hover:border-cyan-400/50 transition-all">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-950 border border-cyan-500/30 text-cyan-400">
                  <Kanban className="h-6 w-6" />
                </div>
                <div>
                  <span className="font-mono text-xs font-bold uppercase tracking-wider text-cyan-400">
                    Módulo 03
                  </span>
                  <h3 className="font-sans text-xl font-bold text-white">
                    Tablero Kanban Ágil
                  </h3>
                </div>
              </div>

              <p className="mt-4 text-sm text-slate-300 leading-relaxed">
                Gestiona tus proyectos de software, tareas freelance y compromisos con columnas ágiles: <strong className="text-white">Por Hacer</strong>, <strong className="text-white">En Progreso</strong> y <strong className="text-white">Completado</strong> con inserción instantánea.
              </p>

              {/* Kanban Visual Pill Preview */}
              <div className="mt-6 grid grid-cols-3 gap-2 font-mono text-xs">
                <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-2.5">
                  <div className="text-slate-400 font-bold mb-1">Por Hacer</div>
                  <div className="rounded bg-slate-800 p-1.5 text-[11px] text-slate-200">
                    API REST con FastAPI
                  </div>
                </div>
                <div className="rounded-lg border border-cyan-500/30 bg-cyan-950/20 p-2.5">
                  <div className="text-cyan-400 font-bold mb-1">En Progreso</div>
                  <div className="rounded bg-cyan-900/40 border border-cyan-500/30 p-1.5 text-[11px] text-cyan-100">
                    Modelo de Base de Datos
                  </div>
                </div>
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-2.5">
                  <div className="text-emerald-400 font-bold mb-1">Completado</div>
                  <div className="rounded bg-emerald-900/40 border border-emerald-500/30 p-1.5 text-[11px] text-emerald-100">
                    Diagrama ERD ✓
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center gap-2 text-xs font-mono text-slate-400">
              <Award className="h-4 w-4 text-cyan-400" />
              <span>Celebración con confeti al completar tareas importantes</span>
            </div>
          </div>

          {/* Module 4: Horario Semanal Cronológico (Span 6) */}
          <div className="lg:col-span-6 rounded-2xl border border-cyan-500/20 bg-[#091326] p-6 sm:p-8 flex flex-col justify-between hover:border-cyan-400/50 transition-all">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-950 border border-cyan-500/30 text-cyan-400">
                  <Calendar className="h-6 w-6" />
                </div>
                <div>
                  <span className="font-mono text-xs font-bold uppercase tracking-wider text-cyan-400">
                    Módulo 04
                  </span>
                  <h3 className="font-sans text-xl font-bold text-white">
                    Horario Semanal Inteligente
                  </h3>
                </div>
              </div>

              <p className="mt-4 text-sm text-slate-300 leading-relaxed">
                Visualización de 7 columnas que detecta automáticamente el día <strong className="text-cyan-400">HOY</strong> y agrupa clases, bloques de entrenamiento y estudio en código de color semántico.
              </p>

              {/* Live Preview Schedule snippet */}
              <div className="mt-6 rounded-xl border border-cyan-500/20 bg-[#060c18] p-4 font-mono text-xs">
                <div className="flex items-center justify-between text-slate-400 border-b border-cyan-500/10 pb-2">
                  <span className="text-cyan-400 font-bold">HOY • MIÉRCOLES</span>
                  <span className="text-slate-300">3 Bloques Programados</span>
                </div>
                <div className="mt-2.5 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between rounded bg-blue-950/40 border border-blue-500/30 px-2.5 py-1.5 text-blue-200">
                    <span>08:00 - 10:00 • Arquitectura de Software</span>
                    <span className="text-[10px] text-blue-400">Clase</span>
                  </div>
                  <div className="flex items-center justify-between rounded bg-orange-950/40 border border-orange-500/30 px-2.5 py-1.5 text-orange-200">
                    <span>17:00 - 18:30 • Entrenamiento Torso Power</span>
                    <span className="text-[10px] text-orange-400">Gym</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center gap-2 text-xs font-mono text-slate-400">
              <Clock className="h-4 w-4 text-cyan-400" />
              <span>Exportación instantánea a archivo .ICS para sincronizar con tu Google Calendar</span>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
};
