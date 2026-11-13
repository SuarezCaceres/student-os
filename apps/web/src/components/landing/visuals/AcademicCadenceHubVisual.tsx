import React from 'react';
import { 
  GraduationCap, 
  Dumbbell, 
  Flame, 
  Calendar
} from 'lucide-react';

interface AcademicCadenceHubVisualProps {
  className?: string;
}

export const AcademicCadenceHubVisual: React.FC<AcademicCadenceHubVisualProps> = ({
  className = '',
}) => {
  const currentWeek = 5;
  const totalWeeks = 16;

  return (
    <div className={`w-full select-none ${className}`}>
      {/* Real Window Shell */}
      <div className="rounded-2xl border border-[var(--line-strong)] bg-[var(--surface)] text-[var(--ink)] shadow-[0_16px_40px_-12px_rgba(0,0,0,0.5)] overflow-hidden transition-all">
        {/* Top Window Titlebar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--line)] bg-[var(--surface-2)]">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-[#ff5f56] inline-block border border-[#e0443e]" />
            <span className="h-3 w-3 rounded-full bg-[#ffbd2e] inline-block border border-[#dea123]" />
            <span className="h-3 w-3 rounded-full bg-[#27c93f] inline-block border border-[#1aab29]" />
            <span className="ml-2 font-mono text-xs text-[var(--muted)] truncate">
              cadencia / calendario-semestral (1..16)
            </span>
          </div>

          <span className="px-2 py-0.5 rounded text-xs font-mono font-medium text-[var(--action)] bg-[color-mix(in_oklab,var(--action)_14%,transparent)] border border-[color-mix(in_oklab,var(--action)_28%,transparent)]">
            MOTOR DUAL
          </span>
        </div>

        {/* Interior Command Matrix */}
        <div className="p-4 sm:p-5 space-y-4 bg-[var(--surface)]">
          {/* 16-Week Academic Cadence Grid */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-xs font-medium text-[var(--ink)]">
                <Calendar className="w-3.5 h-3.5 text-[var(--action)]" />
                <span>Cadencia Semestral 1 a 16</span>
              </div>
              <span className="font-mono text-xs text-[var(--action)] font-medium">
                Semana 5 (En Curso)
              </span>
            </div>

            {/* 16 Week Grid Nodes */}
            <div className="grid grid-cols-8 sm:grid-cols-16 gap-1 sm:gap-1.5 p-2 rounded-xl bg-[var(--surface-2)]/60 border border-[var(--line)]">
              {Array.from({ length: totalWeeks }).map((_, i) => {
                const weekNum = i + 1;
                const isPast = weekNum < currentWeek;
                const isCurrent = weekNum === currentWeek;
                const isMidterm = weekNum === 8;
                const isFinals = weekNum === 16;

                let badgeClass = 'bg-[var(--surface)] text-[var(--muted)] border-[var(--line)]';
                if (isPast) {
                  badgeClass = 'bg-[color-mix(in_oklab,var(--ok)_12%,transparent)] text-[var(--ok)] border-[color-mix(in_oklab,var(--ok)_30%,transparent)]';
                } else if (isCurrent) {
                  badgeClass = 'bg-[var(--action)] text-[var(--action-ink)] border-[var(--action)] shadow-sm scale-105 font-bold';
                } else if (isMidterm || isFinals) {
                  badgeClass = 'bg-[color-mix(in_oklab,var(--warn)_14%,transparent)] text-[var(--warn)] border-[color-mix(in_oklab,var(--warn)_35%,transparent)] font-semibold';
                }

                return (
                  <div
                    key={weekNum}
                    className={`h-8 sm:h-9 rounded-md border flex flex-col items-center justify-center font-mono text-xs transition-all ${badgeClass}`}
                    title={`Semana ${weekNum}${isMidterm ? ' · Parciales' : isFinals ? ' · Finales' : isCurrent ? ' · Semana actual' : ''}`}
                  >
                    <span>S{weekNum}</span>
                    {isCurrent && (
                      <span className="h-1 w-1 rounded-full bg-[var(--action-ink)] animate-ping" />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between text-xs text-[var(--muted)] mt-1.5 px-0.5">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-[var(--ok)]" /> S1..S4 Pasadas
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-[var(--action)]" /> S5 Actual
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-[var(--warn)]" /> S8 Parciales & S16 Finales
              </span>
            </div>
          </div>

          {/* Dual Engine Metrics Split (Brain & Muscle) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[var(--line)]">
            {/* Brain Metric Block */}
            <div className="p-3.5 rounded-xl border border-[var(--line)] bg-[var(--surface-2)]/50 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-[var(--action)]" />
                  <span className="text-xs font-medium text-[var(--ink)]">Calculadora GPA</span>
                </div>
                <span className="font-mono text-xs font-bold text-[var(--action)]">
                  17.82 / 20.0
                </span>
              </div>
              <p className="text-xs text-[var(--muted)] mt-2 leading-relaxed">
                Predicción activa: requieres nota ≥ 13.5 en exámenes parciales (S8) para sostener tercio superior.
              </p>
              <div className="mt-2.5 pt-2 border-t border-[var(--line)] flex items-center justify-between text-xs font-mono">
                <span className="text-[var(--muted)]">4 cursos matriculados</span>
                <span className="text-[var(--ok)] font-medium">100% al día</span>
              </div>
            </div>

            {/* Muscle Metric Block */}
            <div className="p-3.5 rounded-xl border border-[var(--line)] bg-[var(--surface-2)]/50 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Dumbbell className="w-4 h-4 text-[var(--gym)]" />
                  <span className="text-xs font-medium text-[var(--ink)]">Sobrecarga y Racha</span>
                </div>
                <span className="font-mono text-xs font-bold text-[var(--gym)] flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5" /> 24 días
                </span>
              </div>
              <p className="text-xs text-[var(--muted)] mt-2 leading-relaxed">
                Récord personal (PR) actualizado: Press Militar 50kg × 10 reps (1RM estimado 66.7 kg).
              </p>
              <div className="mt-2.5 pt-2 border-t border-[var(--line)] flex items-center justify-between text-xs font-mono">
                <span className="text-[var(--muted)]">Rest Timer: 60s</span>
                <span className="text-[var(--gym)] font-medium">Push Power activo</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer info bar */}
        <div className="px-4 py-2.5 border-t border-[var(--line)] bg-[var(--surface-2)] flex items-center justify-between text-xs text-[var(--muted)] font-mono">
          <span>Sincronización bidireccional local</span>
          <span className="text-[var(--action)] font-medium">Zero burocracia de base de datos</span>
        </div>
      </div>
    </div>
  );
};
