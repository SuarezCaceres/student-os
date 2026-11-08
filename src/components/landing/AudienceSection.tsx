import React from 'react';
import { Code2, Dumbbell, Laptop, Target } from 'lucide-react';

export const AudienceSection: React.FC = () => {
  const personas = [
    {
      icon: Code2,
      category: 'Software & Ingeniería',
      title: 'Estudiantes de Software, Sistemas y Ciencias',
      description:
        'Para quienes tienen entregas de código, proyectos de laboratorio y semanas de parciales donde cada porcentaje cuenta.',
      highlights: [
        'Tablero Kanban con soporte para proyectos de programación',
        'Separación clara entre materias teóricas y proyectos prácticos',
        'Cero latencia y atajos de teclado ágiles',
      ],
      badge: 'Foco Tech',
    },
    {
      icon: Dumbbell,
      category: 'Atletas & Rendimiento',
      title: 'Estudiantes que entrenan fuerza y priorizan su salud',
      description:
        'El rendimiento intelectual y el entrenamiento van de la mano. Registra tus series y descansos en segundos sin distraerte.',
      highlights: [
        'Rutinas de Lunes a Domingo (Push/Pull/Legs o Torso/Pierna)',
        'Burbujas de series (S1..S4) con peso en kg y repeticiones',
        'Racha de días de entrenamiento para no perder la disciplina',
      ],
      badge: 'Constancia',
    },
    {
      icon: Laptop,
      category: 'Builders & Proyectos',
      title: 'Jóvenes que estudian y trabajan o emprenden',
      description:
        'Si además de tus clases tienes clientes freelance o proyectos personales, necesitas una separación nítida para no colapsar.',
      highlights: [
        'Filtro por categorías: Universidad, Trabajo, Gym y Personal',
        'Semáforo visual de entregas críticas que vencen en 48 horas',
        'Exportación rápida a formato de calendario universal .ics',
      ],
      badge: 'Alto Rendimiento',
    },
  ];

  return (
    <section 
      id="para-quienes" 
      className="relative border-b border-[var(--line)] bg-[var(--surface)] py-20 sm:py-28 transition-colors"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto">
          <h2 className="font-sans text-3xl sm:text-4xl font-semibold tracking-[-0.03em] text-[var(--ink)]">
            ¿Para quiénes está hecho <span className="text-[var(--action)]">StudentOS</span>?
          </h2>

          <p className="mt-4 text-base text-[var(--muted)] leading-relaxed">
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
                className="t-card p-6 sm:p-7 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--surface-2)] border border-[var(--line)] text-[var(--action)]">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="font-mono text-xs text-[var(--action)] bg-[color-mix(in_oklab,var(--action)_12%,transparent)] border border-[color-mix(in_oklab,var(--action)_25%,transparent)] px-2.5 py-0.5 rounded-full">
                      {p.badge}
                    </span>
                  </div>

                  <span className="font-mono text-xs font-medium text-[var(--muted)] uppercase tracking-wider">
                    {p.category}
                  </span>

                  <h3 className="mt-1.5 font-sans text-lg font-semibold text-[var(--ink)] leading-snug">
                    {p.title}
                  </h3>

                  <p className="mt-3 text-sm text-[var(--muted)] leading-relaxed">
                    {p.description}
                  </p>

                  <div className="mt-5 space-y-2 border-t border-[var(--line)] pt-4">
                    {p.highlights.map((h, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs font-mono text-[var(--muted)]">
                        <Target className="h-3.5 w-3.5 text-[var(--action)] shrink-0 mt-0.5" />
                        <span>{h}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-[var(--line)] flex items-center justify-between font-mono text-xs text-[var(--muted)]">
                  <span>Diseñado para tu ritmo</span>
                  <span className="text-[var(--action)]">Zero burocracia</span>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};
