import React from 'react';
import { ShieldCheck, Award } from 'lucide-react';

export const CreatorStorySection: React.FC = () => {
  return (
    <section 
      id="manifiesto" 
      className="relative border-b border-[var(--line)] bg-[var(--bg)] py-20 sm:py-28 transition-colors"
    >
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="font-sans text-3xl sm:text-4xl font-semibold tracking-[-0.03em] text-[var(--ink)]">
            ¿Por qué decidí hacer <span className="text-[var(--action)]">este proyecto</span>?
          </h2>
        </div>

        {/* The Manifest Story Card */}
        <div className="mt-12 t-card p-8 sm:p-12 relative overflow-hidden">
          <div className="relative z-10 space-y-6 text-[var(--muted)] font-sans text-base sm:text-lg leading-relaxed">
            <p>
              <strong className="text-[var(--ink)] font-semibold">Todo comenzó durante una semana de exámenes parciales.</strong> Tenía 6 pestañas abiertas en el navegador: una plantilla sobrecargada de Notion que tardaba 4 segundos en abrirse, un tablero con tareas atrasadas, hojas de cálculo con porcentajes confusos y una app de gimnasio que cobraba suscripción mensual solo por registrar cuántos kilos levantaba en press de banca.
            </p>

            <blockquote className="p-4 my-6 font-mono text-sm text-[var(--action)] italic bg-[var(--surface-2)] rounded-xl border border-[var(--line)]">
              &ldquo;Ninguna herramienta en el mercado entendía la realidad de un estudiante universitario: semanas de 1 a 16, parciales implacables, proyectos de código y el deseo inquebrantable de no abandonar el gimnasio.&rdquo;
            </blockquote>

            <p>
              Estaba harto de la fricción. Harto de perder 15 minutos configurando bases de datos en lugar de estudiar o programar. Y sobre todo, harto de sentir que para ser disciplinado en la universidad tenías que sacrificar tu salud física y tu tiempo libre.
            </p>

            <p>
              Por eso decidí programar <strong className="text-[var(--ink)] font-semibold">StudentOS</strong>:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-6 font-mono text-xs sm:text-sm">
              <div className="flex items-start gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface-2)]/60 p-4">
                <ShieldCheck className="h-5 w-5 text-[var(--ok)] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-[var(--ink)] block font-semibold mb-1">100% Offline & Privado</strong>
                  <span className="text-[var(--muted)]">Tus calificaciones y rutinas son tuyas. Se guardan en tu navegador sin rastreadores ni venta de datos.</span>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface-2)]/60 p-4">
                <Award className="h-5 w-5 text-[var(--action)] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-[var(--ink)] block font-semibold mb-1">Cero Fricción (2 clics)</strong>
                  <span className="text-[var(--muted)]">Añade una entrega o marca una serie en 1 toque. Si una herramienta te hace perder tiempo, no sirve.</span>
                </div>
              </div>
            </div>

            <p>
              StudentOS está hecho con la mentalidad de quien está en las trincheras del aula, del laboratorio y de la sala de pesas. Es una herramienta abierta, creada para ayudarte a rendir al máximo nivel sin perder tu tranquilidad mental en el camino.
            </p>

            {/* Author Signature & Note */}
            <div className="mt-10 pt-6 border-t border-[var(--line)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 font-mono text-xs">
              <div>
                <div className="font-semibold text-[var(--ink)]">
                  Desarrollado con rigor para la comunidad estudiantil
                </div>
                <div className="text-[var(--action)] mt-0.5">
                  StudentOS Core Team • Open Source bajo Licencia MIT
                </div>
              </div>

              <div className="text-[var(--muted)] bg-[var(--surface-2)] border border-[var(--line)] px-3 py-1.5 rounded-lg">
                Hecho para universitarios disciplinados
              </div>
            </div>

          </div>

        </div>

      </div>
    </section>
  );
};
