import React from 'react';
import { Code2, Dumbbell, Laptop, Users, Target, Zap } from 'lucide-react';

export const AudienceSection: React.FC = () => {
  const personas = [
    {
      icon: Code2,
      tag: '01 / TECH & INGENIERÍA',
      title: 'Estudiantes de Software, Sistemas y Ciencias',
      description:
        'Ideal para quienes tienen entregas de código, proyectos de laboratorio y semanas de parciales donde cada porcentaje cuenta.',
      highlights: [
        'Tablero Kanban con soporte para proyectos de programación',
        'Separación clara entre materias teóricas y proyectos prácticos',
        'Cero latencia y atajos de teclado ágiles',
      ],
      badge: 'Foco Tech',
    },
    {
      icon: Dumbbell,
      tag: '02 / UNIVERSITARIO FITNESS',
      title: 'Estudiantes que entrenan fuerza y no negocian su salud',
      description:
        'Para quienes saben que el rendimiento académico y el entrenamiento van de la mano. Registra tus series en 1 segundo sin distraerte.',
      highlights: [
        'Rutinas de Lunes a Domingo (Push/Pull/Legs o Torso/Pierna)',
        'Burbujas de series (S1..S4) con peso en kg y repeticiones',
        'Racha de días de entrenamiento para no perder la disciplina',
      ],
      badge: 'Cero Excusas',
    },
    {
      icon: Laptop,
      tag: '03 / FREELANCER & BUILDER',
      title: 'Jóvenes que estudian y trabajan o emprenden',
      description:
        'Si además de tus clases tienes clientes freelance o proyectos personales, necesitas una separación nítida para no colapsar.',
      highlights: [
        'Filtro por categorías: Universidad, Trabajo, Gym y Personal',
        'Semáforo visual de entregas críticas que vencen en 48 horas',
        'Exportación rápida a formato de calendario universal',
      ],
      badge: 'Alto Impacto',
    },
  ];

  return (
    <section 
      id="para-quienes" 
      className="relative border-b border-cyan-500/15 bg-[#070b15] py-20 sm:py-28"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-md border border-cyan-500/30 bg-cyan-950/40 px-3 py-1 font-mono text-xs font-semibold text-cyan-300">
            <Users className="h-3.5 w-3.5 text-cyan-400" />
            <span>PÚBLICO OBJETIVO</span>
          </div>

          <h2 className="mt-4 font-sans text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            ¿Para quiénes está hecho <span className="text-cyan-400">StudentOS</span>?
          </h2>

          <p className="mt-4 text-base text-slate-300 leading-relaxed">
            No es un software corporativo genérico. Está calibrado a la medida de los perfiles que se exigen al máximo tanto en el aula como en su vida diaria.
          </p>
        </div>

        {/* Personas Grid */}
        <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-6">
          {personas.map((p, idx) => {
            const Icon = p.icon;
            return (
              <div 
                key={idx}
                className="group flex flex-col justify-between rounded-2xl border border-cyan-500/20 bg-[#091326] p-6 sm:p-7 hover:border-cyan-400/60 hover:-translate-y-1 transition-all shadow-[0_8px_24px_rgba(0,0,0,0.4)]"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-950 border border-cyan-500/30 text-cyan-400 group-hover:scale-105 transition-transform">
                      <Icon className="h-6 w-6" />
                    </div>
                    <span className="font-mono text-xs text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 px-2 py-0.5 rounded-full">
                      {p.badge}
                    </span>
                  </div>

                  <span className="font-mono text-[11px] font-bold text-cyan-400 tracking-wider">
                    {p.tag}
                  </span>

                  <h3 className="mt-1.5 font-sans text-lg font-bold text-white group-hover:text-cyan-300 transition-colors">
                    {p.title}
                  </h3>

                  <p className="mt-3 text-sm text-slate-300 leading-relaxed">
                    {p.description}
                  </p>

                  <div className="mt-5 space-y-2 border-t border-cyan-500/10 pt-4">
                    {p.highlights.map((h, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs font-mono text-slate-300">
                        <Target className="h-3.5 w-3.5 text-cyan-400 shrink-0 mt-0.5" />
                        <span>{h}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-cyan-500/10 flex items-center justify-between font-mono text-xs text-cyan-400">
                  <span className="text-slate-400">Diseñado para tu ritmo</span>
                  <Zap className="h-3.5 w-3.5" />
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};
