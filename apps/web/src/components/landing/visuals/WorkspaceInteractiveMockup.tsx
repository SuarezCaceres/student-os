import React, { useState } from 'react';
import { 
  CheckCircle2, 
  Dumbbell, 
  GraduationCap, 
  ArrowRight,
  Plus
} from 'lucide-react';

interface WorkspaceInteractiveMockupProps {
  className?: string;
  onEnterApp?: () => void;
}

type MockTab = 'hoy' | 'universidad' | 'gym';

export const WorkspaceInteractiveMockup: React.FC<WorkspaceInteractiveMockupProps> = ({
  className = '',
  onEnterApp,
}) => {
  const [activeTab, setActiveTab] = useState<MockTab>('hoy');
  
  // Interactive mini-states so visitors can interact with the live mockup!
  const [taskDone, setTaskDone] = useState(false);
  const [completedSets, setCompletedSets] = useState<number[]>([0, 1]); // sets 1 & 2 completed
  const [quickNote, setQuickNote] = useState('');
  const [addedNote, setAddedNote] = useState<string | null>(null);

  const toggleSet = (idx: number) => {
    setCompletedSets((prev) =>
      prev.includes(idx) ? prev.filter((s) => s !== idx) : [...prev, idx]
    );
  };

  const handleAddQuickNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickNote.trim()) return;
    setAddedNote(quickNote.trim());
    setQuickNote('');
  };

  return (
    <div className={`w-full select-none ${className}`}>
      {/* Real Window Shell */}
      <div className="rounded-2xl border border-[var(--line-strong)] bg-[var(--surface)] text-[var(--ink)] overflow-hidden transition-all">
        {/* Top Window Titlebar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--line)] bg-[var(--surface-2)]">
          <div className="flex items-center gap-2.5">
            <div className="w-5 h-5 rounded-[6px] overflow-hidden border border-[var(--line)] bg-[var(--surface)] flex items-center justify-center shrink-0">
              <img src="/logo.png" alt="StudentOS" className="w-full h-full object-cover" />
            </div>
            <span className="text-xs font-medium text-[var(--ink)] tracking-[-0.01em]">
              student-os / workspace / semana-05
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-[var(--ok)] bg-[color-mix(in_oklab,var(--ok)_12%,transparent)] border border-[color-mix(in_oklab,var(--ok)_25%,transparent)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--ok)]" />
              100% Offline
            </span>
            <span className="px-2.5 py-1 rounded-full text-xs font-medium text-[var(--action)] bg-[color-mix(in_oklab,var(--action)_14%,transparent)] border border-[color-mix(in_oklab,var(--action)_28%,transparent)]">
              En vivo
            </span>
          </div>
        </div>

        {/* View Switcher Tabs inside Window */}
        <div className="px-4 pt-3 border-b border-[var(--line)] bg-[var(--surface)] flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('hoy')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                activeTab === 'hoy'
                  ? 'bg-[var(--surface-2)] text-[var(--ink)] border border-[var(--line)] shadow-xs'
                  : 'text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('universidad')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                activeTab === 'universidad'
                  ? 'bg-[var(--surface-2)] text-[var(--ink)] border border-[var(--line)] shadow-xs'
                  : 'text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              Universidad
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('gym')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                activeTab === 'gym'
                  ? 'bg-[var(--surface-2)] text-[var(--ink)] border border-[var(--line)] shadow-xs'
                  : 'text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              Gym
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-xs text-[var(--muted)]">
            <span>Racha: <strong className="text-[var(--gym)] font-medium t-num">🔥 24d</strong></span>
            <span>·</span>
            <span>GPA: <strong className="text-[var(--action)] font-medium t-num">17.8</strong></span>
          </div>
        </div>

        {/* Tab Content Display */}
        <div className="p-4 sm:p-5 bg-[var(--surface)] min-h-[300px]">
          {activeTab === 'hoy' && (
            <div className="space-y-3.5">
              {/* Card 1: Live Academic Task */}
              <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)]/60 p-3.5">
                <div className="flex items-center justify-between text-xs text-[var(--muted)] pb-1.5 mb-1.5 border-b border-[var(--line)]">
                  <div className="flex items-center gap-1.5">
                    <GraduationCap className="w-3.5 h-3.5 text-[var(--action)]" />
                    <span className="font-medium text-[var(--ink)]">Cálculo Multivariable</span>
                    <span>· Sem. 5</span>
                  </div>
                  <span className="t-badge t-badge-warn text-xs">
                    Vence en 2 días
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 mt-1">
                  <div className="min-w-0">
                    <div className={`text-sm font-medium transition-all truncate ${taskDone ? 'line-through text-[var(--muted)]' : 'text-[var(--ink)]'}`}>
                      Lab 3: Multiplicadores de Lagrange y Gradiente
                    </div>
                    <div className="text-xs text-[var(--muted)] mt-0.5">
                      Ponderación: <span className="t-num">20%</span> nota final · Rúbrica <span className="t-num">4/4</span> criterios
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTaskDone(!taskDone)}
                    className={`min-h-[44px] px-3.5 rounded-lg text-xs font-medium border inline-flex items-center gap-1.5 cursor-pointer transition-all ${
                      taskDone
                        ? 'bg-[color-mix(in_oklab,var(--ok)_16%,transparent)] border-[var(--ok)] text-[var(--ok)]'
                        : 'bg-[var(--surface)] border-[var(--line-strong)] text-[var(--ink)] hover:border-[var(--action)]'
                    }`}
                    title="Haz clic para probar la interacción real"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{taskDone ? 'Listo' : 'Marcar'}</span>
                  </button>
                </div>
              </div>

              {/* Card 2: Live Gym Series Tracker */}
              <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)]/60 p-3.5">
                <div className="flex items-center justify-between text-xs text-[var(--muted)] pb-1.5 mb-1.5 border-b border-[var(--line)]">
                  <div className="flex items-center gap-1.5">
                    <Dumbbell className="w-3.5 h-3.5 text-[var(--gym)]" />
                    <span className="font-medium text-[var(--ink)]">Entrenamiento de hoy</span>
                    <span>· Push Power</span>
                  </div>
                  <span className="t-badge t-badge-gym text-xs t-num">
                    Rest Timer: 60s
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mt-1">
                  <div>
                    <div className="text-sm font-medium text-[var(--ink)]">
                      Press de Banca Plano
                    </div>
                    <div className="text-xs text-[var(--muted)] mt-0.5">
                      <span className="t-num">80 kg</span> · <span className="t-num">4</span> series de <span className="t-num">8-10 reps</span> · 1RM: <span className="t-num">104 kg</span>
                    </div>
                  </div>

                  {/* Interactive Series Buttons */}
                  <div className="flex items-center gap-1.5">
                    {[0, 1, 2, 3].map((idx) => {
                      const isDone = completedSets.includes(idx);
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => toggleSet(idx)}
                          className={`min-h-[44px] min-w-[44px] rounded-lg t-num text-xs font-medium border inline-flex items-center justify-center cursor-pointer transition-all ${
                            isDone
                              ? 'bg-[color-mix(in_oklab,var(--gym)_18%,transparent)] border-[var(--gym)] text-[var(--gym)] shadow-xs'
                              : 'bg-[var(--surface)] border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)] hover:border-[var(--line-strong)]'
                          }`}
                          title={`Serie ${idx + 1}: Haz clic para alternar`}
                        >
                          S{idx + 1}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Added note or Inline Add Bar */}
              {addedNote ? (
                <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 flex items-center justify-between text-xs text-[var(--ink)]">
                  <span className="truncate">✓ Recordatorio registrado: &ldquo;{addedNote}&rdquo;</span>
                  <button
                    type="button"
                    onClick={() => setAddedNote(null)}
                    className="text-[var(--muted)] hover:text-[var(--ink)] text-xs ml-2 shrink-0 cursor-pointer min-h-[44px] inline-flex items-center px-2"
                  >
                    Borrar
                  </button>
                </div>
              ) : (
                <form onSubmit={handleAddQuickNote} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={quickNote}
                    onChange={(e) => setQuickNote(e.target.value)}
                    placeholder="+ Escribe un pendiente rápido y presiona Enter..."
                    className="t-input min-h-[44px] py-2 text-xs flex-1"
                  />
                  <button
                    type="submit"
                    className="t-btn t-btn-secondary min-h-[44px] text-xs px-3.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Guardar</span>
                  </button>
                </form>
              )}
            </div>
          )}

          {activeTab === 'universidad' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-[var(--muted)] pb-2 border-b border-[var(--line)]">
                <span>Ciclo Académico 2026-II · 4 Cursos Registrados</span>
                <span className="text-[var(--action)] font-semibold t-num">Semana 5 de 16</span>
              </div>

              <div className="space-y-2">
                {[
                  { name: 'Cálculo Multivariable', code: 'MAT-301', note: '18.5', weight: '25%', state: 'Al día' },
                  { name: 'Arquitectura de Software', code: 'INF-402', note: '17.0', weight: '30%', state: 'Proyecto S6' },
                  { name: 'Estructuras de Datos II', code: 'INF-301', note: '19.0', weight: '25%', state: 'Al día' },
                  { name: 'Física Computacional', code: 'FIS-204', note: '16.8', weight: '20%', state: 'Lab 2 Pendiente' },
                ].map((c) => (
                  <div
                    key={c.code}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-[var(--line)] bg-[var(--surface-2)]/50 text-xs"
                  >
                    <div>
                      <div className="font-medium text-[var(--ink)]">{c.name}</div>
                      <div className="text-xs text-[var(--muted)]">{c.code} · Ponderación <span className="t-num">{c.weight}</span></div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs px-2 py-0.5 rounded bg-[var(--surface)] border border-[var(--line)] text-[var(--muted)]">
                        {c.state}
                      </span>
                      <span className="t-num font-semibold text-sm text-[var(--action)]">
                        {c.note}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-2 flex items-center justify-between text-xs border-t border-[var(--line)]">
                <span className="text-[var(--muted)]">Promedio Ponderado Acumulado (GPA):</span>
                <span className="t-num font-bold text-sm text-[var(--ink)]">17.82 / 20.00</span>
              </div>
            </div>
          )}

          {activeTab === 'gym' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-[var(--muted)] pb-2 border-b border-[var(--line)]">
                <span>Rutina de Hoy · Push Power (Pecho, Hombro, Tríceps)</span>
                <span className="text-[var(--gym)] font-semibold t-num">Semana 5 · Día 1</span>
              </div>

              <div className="space-y-2">
                {[
                  { name: 'Press de Banca Plano', load: '80 kg', reps: '4 x 8-10', target: 'Pecho / 1RM 104kg' },
                  { name: 'Press Militar con Barra', load: '50 kg', reps: '3 x 10', target: 'Deltoides anterior' },
                  { name: 'Fondos en Paralelas Lastrados', load: '+20 kg', reps: '3 x 12', target: 'Tríceps & Pectoral' },
                  { name: 'Elevaciones Laterales en Polea', load: '12 kg', reps: '4 x 15', target: 'Deltoides lateral' },
                ].map((ex) => (
                  <div
                    key={ex.name}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-[var(--line)] bg-[var(--surface-2)]/50 text-xs"
                  >
                    <div>
                      <div className="font-medium text-[var(--ink)]">{ex.name}</div>
                      <div className="text-xs text-[var(--muted)]">{ex.target}</div>
                    </div>
                    <div className="text-right">
                      <div className="t-num font-semibold text-[var(--gym)]">{ex.load}</div>
                      <div className="text-xs text-[var(--muted)]">{ex.reps}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-2 flex items-center justify-between text-xs border-t border-[var(--line)]">
                <span className="text-[var(--muted)]">Calculadora 1RM (Epley): 80kg × (1 + 10/30) =</span>
                <span className="t-num font-bold text-sm text-[var(--gym)]">104.0 kg</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer info bar */}
        <div className="px-4 py-2.5 border-t border-[var(--line)] bg-[var(--surface-2)] flex items-center justify-between text-xs text-[var(--muted)]">
          <div className="flex items-center gap-2">
            <span className="text-[var(--ink)] font-medium">Arquitectura Zero-Burocracia</span>
            <span>·</span>
            <span className="t-num">0.0s latencia</span>
          </div>

          {onEnterApp && (
            <button
              type="button"
              onClick={onEnterApp}
              className="inline-flex items-center gap-1 text-[var(--action)] hover:underline cursor-pointer font-sans text-xs font-medium"
            >
              <span>Abrir App Completa</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
