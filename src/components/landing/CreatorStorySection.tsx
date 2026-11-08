import React from 'react';
import { HeartHandshake, ShieldCheck, Terminal, Award } from 'lucide-react';

export const CreatorStorySection: React.FC = () => {
  return (
    <section 
      id="manifiesto" 
      className="relative border-b border-cyan-500/15 bg-[#080d18] py-20 sm:py-28"
    >
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-md border border-cyan-500/30 bg-cyan-950/40 px-3 py-1 font-mono text-xs font-semibold text-cyan-300">
            <HeartHandshake className="h-3.5 w-3.5 text-cyan-400" />
            <span>EL ORIGEN • DETRÁS DEL CÓDIGO</span>
          </div>

          <h2 className="mt-4 font-sans text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            ¿Por qué decidí hacer <span className="text-cyan-400">este proyecto</span>?
          </h2>
        </div>

        {/* The Manifest Story Card */}
        <div className="mt-12 rounded-3xl border border-cyan-500/30 bg-[#091325]/90 p-8 sm:p-12 shadow-[0_12px_48px_rgba(0,0,0,0.6)] backdrop-blur-md relative overflow-hidden">
          
          {/* Subtle background circuit watermark */}
          <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 opacity-5 pointer-events-none select-none text-cyan-300">
            <Terminal className="h-96 w-96" />
          </div>

          <div className="relative z-10 space-y-6 text-slate-300 font-sans text-base sm:text-lg leading-relaxed">
            <p>
              <strong className="text-white font-semibold">Todo comenzó durante una semana de exámenes parciales.</strong> Tenía 6 pestañas abiertas en el navegador: una plantilla sobrecargada de Notion que tardaba 4 segundos en abrirse, un tablero de Trello con tareas atrasadas, hojas de cálculo con porcentajes confusos y una app de gimnasio que me cobraba una suscripción mensual solo por registrar cuántos kilos levantaba en press de banca.
            </p>

            <blockquote className="border-l-4 border-cyan-400 pl-5 py-2 my-6 font-mono text-base text-cyan-200 italic bg-cyan-950/20 rounded-r-xl">
              "Ninguna herramienta en el mercado entendía la realidad de un estudiante universitario: semanas de 1 a 16, parciales implacables, proyectos de código y el deseo inquebrantable de no abandonar el gimnasio."
            </blockquote>

            <p>
              Estaba harto de la fricción. Harto de perder 15 minutos configurando bases de datos en lugar de estudiar o programar. Y sobre todo, harto de sentir que para ser disciplinado en la universidad tenías que sacrificar tu salud física y tu tiempo libre.
            </p>

            <p>
              Por eso decidí programar <strong className="text-white font-semibold">StudentOS</strong>:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-6 font-mono text-xs sm:text-sm text-slate-200">
              <div className="flex items-start gap-3 rounded-xl border border-cyan-500/20 bg-[#060c18] p-4">
                <ShieldCheck className="h-5 w-5 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block font-semibold mb-1">100% Offline & Privado</strong>
                  Tus calificaciones y rutinas son tuyas. Se guardan en tu navegador sin rastreadores ni venta de datos.
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-cyan-500/20 bg-[#060c18] p-4">
                <Award className="h-5 w-5 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block font-semibold mb-1">Cero Fricción (2 clics)</strong>
                  Añade una entrega o marca una serie en 1 toque. Si una herramienta te hace perder tiempo, no sirve.
                </div>
              </div>
            </div>

            <p>
              StudentOS está hecho con la mentalidad de quien está en las trincheras del aula, del laboratorio y de la sala de pesas. Es una herramienta abierta, creada para ayudarte a rendir al máximo nivel sin perder tu tranquilidad mental en el camino.
            </p>

            {/* Author Signature & Note */}
            <div className="mt-10 pt-6 border-t border-cyan-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="font-mono text-sm font-bold text-white">
                  Desarrollado con dedicación para la comunidad estudiantil
                </div>
                <div className="font-mono text-xs text-cyan-400 mt-0.5">
                  StudentOS Core Team • Open Source bajo Licencia MIT
                </div>
              </div>

              <div className="font-mono text-xs text-slate-400 bg-cyan-950/40 border border-cyan-500/30 px-3 py-1.5 rounded-lg">
                🚀 Hecho para universitarios imparables
              </div>
            </div>

          </div>

        </div>

      </div>
    </section>
  );
};
