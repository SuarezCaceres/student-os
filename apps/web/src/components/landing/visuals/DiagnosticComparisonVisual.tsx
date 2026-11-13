import React from 'react';
import { 
  XCircle, 
  CheckCircle2, 
  Zap,
  Calendar,
  Dumbbell,
  GraduationCap
} from 'lucide-react';

interface DiagnosticComparisonVisualProps {
  className?: string;
}

export const DiagnosticComparisonVisual: React.FC<DiagnosticComparisonVisualProps> = ({
  className = '',
}) => {
  return (
    <div className={`w-full select-none ${className}`}>
      <div className="rounded-2xl border border-[var(--line-strong)] bg-[var(--surface)] text-[var(--ink)] shadow-[0_12px_32px_rgba(0,0,0,0.4)] overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-[var(--line)] bg-[var(--surface-2)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-[#ff5f56]" />
            <span className="h-3 w-3 rounded-full bg-[#ffbd2e]" />
            <span className="h-3 w-3 rounded-full bg-[#27c93f]" />
            <span className="ml-2 font-mono text-xs text-[var(--muted)]">
              diagnostico / comparativa-de-flujo
            </span>
          </div>
          <span className="font-mono text-xs text-[var(--action)] font-medium">
            ZERO BUROCRACIA
          </span>
        </div>

        {/* Content Comparison Grid */}
        <div className="p-4 sm:p-5 space-y-4">
          {/* Traditional Way (Problem) */}
          <div className="rounded-xl border border-[color-mix(in_oklab,var(--danger)_35%,transparent)] bg-[color-mix(in_oklab,var(--danger)_6%,var(--surface-2))] p-3.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--danger)] mb-2">
              <XCircle className="w-4 h-4 shrink-0" />
              <span>El Enfoque Tradicional: 5 aplicaciones fragmentadas</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-[var(--muted)]">
              <div className="flex items-start gap-1.5 p-2 rounded-lg bg-[var(--surface)]/80 border border-[var(--line)]">
                <span className="text-[var(--danger)] font-bold">✕</span>
                <span>Notion / Jira: 6 propiedades que llenar para una sola tarea</span>
              </div>
              <div className="flex items-start gap-1.5 p-2 rounded-lg bg-[var(--surface)]/80 border border-[var(--line)]">
                <span className="text-[var(--danger)] font-bold">✕</span>
                <span>Google Calendar: No sabe qué es Semana 8 ni Semana 16</span>
              </div>
              <div className="flex items-start gap-1.5 p-2 rounded-lg bg-[var(--surface)]/80 border border-[var(--line)]">
                <span className="text-[var(--danger)] font-bold">✕</span>
                <span>Apps de Fitness: Pesadas, con suscripciones y sin vínculo académico</span>
              </div>
              <div className="flex items-start gap-1.5 p-2 rounded-lg bg-[var(--surface)]/80 border border-[var(--line)]">
                <span className="text-[var(--danger)] font-bold">✕</span>
                <span>Excel de Notas: Desfasado, sin predicción de nota mínima</span>
              </div>
            </div>
          </div>

          {/* StudentOS Way (Solution) */}
          <div className="rounded-xl border border-[color-mix(in_oklab,var(--ok)_40%,transparent)] bg-[color-mix(in_oklab,var(--ok)_8%,var(--surface-2))] p-3.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--ok)] mb-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>La Solución StudentOS: Un único centro reactivo</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-[var(--ink)]">
              <div className="flex items-start gap-1.5 p-2 rounded-lg bg-[var(--surface)] border border-[var(--line)]">
                <GraduationCap className="w-3.5 h-3.5 text-[var(--action)] shrink-0 mt-0.5" />
                <span>Semanas académicas reales (1 a 16) con GPA y predicción 0-20</span>
              </div>
              <div className="flex items-start gap-1.5 p-2 rounded-lg bg-[var(--surface)] border border-[var(--line)]">
                <Dumbbell className="w-3.5 h-3.5 text-[var(--gym)] shrink-0 mt-0.5" />
                <span>Marcado de series (S1..S4) en 1 clic y cronómetro flotante</span>
              </div>
              <div className="flex items-start gap-1.5 p-2 rounded-lg bg-[var(--surface)] border border-[var(--line)]">
                <Zap className="w-3.5 h-3.5 text-[var(--action)] shrink-0 mt-0.5" />
                <span>Entradas inline con Enter y backup instantáneo en .json</span>
              </div>
              <div className="flex items-start gap-1.5 p-2 rounded-lg bg-[var(--surface)] border border-[var(--line)]">
                <Calendar className="w-3.5 h-3.5 text-[var(--ok)] shrink-0 mt-0.5" />
                <span>Detección de colisiones de horario y exportador a .ics</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-[var(--line)] bg-[var(--surface-2)] flex items-center justify-between text-xs font-mono text-[var(--muted)]">
          <span>Tiempo ahorrado: ~45 min por semana</span>
          <span className="text-[var(--ok)] font-medium">100% Privado y Offline</span>
        </div>
      </div>
    </div>
  );
};
