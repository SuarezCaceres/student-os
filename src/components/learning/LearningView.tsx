import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  BatteryMedium,
  BookOpen,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileText,
  Flame,
  GraduationCap,
  Lightbulb,
  Palmtree,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import type {
  GymRoutine,
  LearningResource,
  ReflectionMood,
  ResourceType,
  UniversityAssignment,
  WeeklyReflection,
} from '../../types';
import type { NavTab } from '../layout/Navbar';
import { triggerConfetti } from '../../utils/confetti';
import { SectionHeader } from '../common/SectionHeader';
import { YoutubeIcon } from '../common/YoutubeIcon';
import { FreeWeekCelebrationCard } from './FreeWeekCelebrationCard';

interface LearningViewProps {
  currentAcademicWeek: number;
  assignments: UniversityAssignment[];
  gymRoutines: GymRoutine[];
  weeklyReflections?: { [week: number]: WeeklyReflection };
  onSaveReflection: (reflection: WeeklyReflection) => void;
  onNavigateTab?: (tab: NavTab) => void;
}

interface WeekDraftPatch {
  learnings?: string;
  keyConcepts?: string[];
  resources?: LearningResource[];
  mood?: ReflectionMood;
}

interface FeynmanPrompt {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  template: string;
}

const FEYNMAN_PROMPTS: FeynmanPrompt[] = [
  {
    id: 'simple',
    label: 'Explicación simple a un colega',
    icon: Lightbulb,
    template: '💡 En palabras simples a un compañero:\n',
  },
  {
    id: 'bug',
    label: 'Desafío técnico superado',
    icon: Wrench,
    template: '🛠️ Desafío técnico o bug que resolví:\n',
  },
  {
    id: 'analogy',
    label: 'Analogía del mundo real',
    icon: Sparkles,
    template: '⚡ Analogía del mundo real:\n',
  },
  {
    id: 'exam',
    label: 'Pregunta típica de examen',
    icon: GraduationCap,
    template: '🎯 Si esto viniera en el examen, respondería:\n',
  },
];

const MOOD_OPTIONS: Array<{
  id: ReflectionMood;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'increible', label: 'Con energía', Icon: Flame },
  { id: 'productivo', label: 'Enfocado', Icon: Zap },
  { id: 'despejado', label: 'En calma', Icon: Palmtree },
  { id: 'cansado', label: 'Cansado', Icon: BatteryMedium },
];

const RESOURCE_TYPE_LABEL: Record<ResourceType, string> = {
  youtube: 'YouTube',
  documentacion: 'Documentación',
  articulo: 'Artículo',
  libro: 'Libro / PDF',
  texto: 'Apunte propio',
};

export const LearningView: React.FC<LearningViewProps> = ({
  currentAcademicWeek,
  assignments,
  weeklyReflections = {},
  onSaveReflection,
  onNavigateTab,
}) => {
  const uid = useId();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const [selectedWeek, setSelectedWeek] = useState<number>(currentAcademicWeek);
  const [draftsByWeek, setDraftsByWeek] = useState<Record<number, WeekDraftPatch>>({});
  const [isSavedRecently, setIsSavedRecently] = useState<boolean>(false);
  const [copiedSummary, setCopiedSummary] = useState<boolean>(false);

  // Concept & resource inputs
  const [newConceptInput, setNewConceptInput] = useState<string>('');
  const [showAddResource, setShowAddResource] = useState<boolean>(false);
  const [newResTitle, setNewResTitle] = useState<string>('');
  const [newResUrl, setNewResUrl] = useState<string>('');
  const [newResType, setNewResType] = useState<ResourceType>('youtube');
  const [newResNotes, setNewResNotes] = useState<string>('');

  const saved = weeklyReflections[selectedWeek];
  const patch = draftsByWeek[selectedWeek];

  const learnings = patch?.learnings ?? saved?.learnings ?? '';
  const keyConcepts = patch?.keyConcepts ?? saved?.keyConcepts ?? [];
  const resources = patch?.resources ?? saved?.resources ?? [];
  const mood: ReflectionMood = patch?.mood ?? saved?.mood ?? 'productivo';

  // Detect unsaved changes
  const hasUnsavedChanges = Boolean(
    patch &&
      ((patch.learnings !== undefined && patch.learnings !== (saved?.learnings ?? '')) ||
        (patch.keyConcepts !== undefined &&
          JSON.stringify(patch.keyConcepts) !== JSON.stringify(saved?.keyConcepts ?? [])) ||
        (patch.resources !== undefined &&
          JSON.stringify(patch.resources) !== JSON.stringify(saved?.resources ?? [])) ||
        (patch.mood !== undefined && patch.mood !== (saved?.mood ?? 'productivo')))
  );

  const updatePatch = useCallback(
    (next: WeekDraftPatch) => {
      setDraftsByWeek((prev) => ({
        ...prev,
        [selectedWeek]: {
          ...prev[selectedWeek],
          ...next,
        },
      }));
    },
    [selectedWeek]
  );

  // Free week detection based on pending assignments
  const weekAssignments = assignments.filter((a) => a.week === selectedWeek);
  const pendingWeekAssignments = weekAssignments.filter((a) => a.status !== 'entregado');
  const isFreeWeek = weekAssignments.length > 0 && pendingWeekAssignments.length === 0;

  // Save handler
  const handleSave = useCallback(() => {
    const reflection: WeeklyReflection = {
      week: selectedWeek,
      learnings: learnings.trim(),
      keyConcepts,
      resources,
      gymReflection: saved?.gymReflection, // preserve previous if existed
      mood,
      updatedAt: new Date().toISOString().split('T')[0],
    };

    onSaveReflection(reflection);
    setDraftsByWeek((prev) => {
      const next = { ...prev };
      delete next[selectedWeek];
      return next;
    });

    setIsSavedRecently(true);
    setTimeout(() => setIsSavedRecently(false), 2400);
    triggerConfetti();
  }, [selectedWeek, learnings, keyConcepts, resources, mood, saved, onSaveReflection]);

  // Global Keyboard shortcut: Ctrl + S / Cmd + S to save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  // Inyectar prompt guiado de Feynman en el textarea
  const handleInsertPrompt = (prompt: FeynmanPrompt) => {
    const prefix = learnings.trim() ? `${learnings.trim()}\n\n` : '';
    const newText = `${prefix}${prompt.template}`;
    updatePatch({ learnings: newText });

    if (textareaRef.current) {
      textareaRef.current.focus();
      const endPos = newText.length;
      textareaRef.current.setSelectionRange(endPos, endPos);
    }
  };

  // Agregar concepto con Enter directo
  const handleAddConcept = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = newConceptInput.trim().replace(/^#+/, '').trim();
    if (!cleaned) return;

    const alreadyExists = keyConcepts.some(
      (c) => c.replace(/^#+/, '').toLowerCase() === cleaned.toLowerCase()
    );
    if (!alreadyExists) {
      updatePatch({ keyConcepts: [...keyConcepts, cleaned] });
    }
    setNewConceptInput('');
  };

  const handleDeleteConcept = (conceptToDelete: string) => {
    updatePatch({
      keyConcepts: keyConcepts.filter((c) => c !== conceptToDelete),
    });
  };

  // Agregar recurso de estudio (detección automática de YouTube)
  const handleAddResource = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = newResTitle.trim();
    if (!cleanTitle) return;

    const cleanUrl = newResUrl.trim();
    let detectedType: ResourceType = newResType;
    if (
      cleanUrl &&
      (cleanUrl.includes('youtube.com') || cleanUrl.includes('youtu.be'))
    ) {
      detectedType = 'youtube';
    }

    const newRes: LearningResource = {
      id: `res-${Date.now()}`,
      title: cleanTitle,
      url: cleanUrl || undefined,
      type: detectedType,
      notes: newResNotes.trim() || undefined,
    };

    updatePatch({ resources: [...resources, newRes] });
    setNewResTitle('');
    setNewResUrl('');
    setNewResNotes('');
    setShowAddResource(false);
  };

  const handleDeleteResource = (resId: string) => {
    updatePatch({
      resources: resources.filter((r) => r.id !== resId),
    });
  };

  // Copiar resumen de la semana al portapapeles
  const handleCopySummary = async () => {
    const textToCopy = [
      `📘 StudentOS — Síntesis de Aprendizaje (Semana ${selectedWeek})`,
      `Estado: ${MOOD_OPTIONS.find((m) => m.id === mood)?.label || mood}`,
      '',
      '--- Resumen Feynman ---',
      learnings || '(Sin notas registradas)',
      '',
      keyConcepts.length > 0 ? `Conceptos: ${keyConcepts.map((c) => `#${c}`).join(' ')}` : '',
      '',
      resources.length > 0
        ? `Fuentes de estudio (${resources.length}):\n` +
          resources.map((r) => `• [${RESOURCE_TYPE_LABEL[r.type]}] ${r.title}${r.url ? ` (${r.url})` : ''}`).join('\n')
        : '',
    ]
      .filter(Boolean)
      .join('\n');

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2000);
    } catch {
      // Fallback silencioso si el navegador restringe el portapapeles
    }
  };

  // Conteo de semanas documentadas en el semestre
  const completedWeeksCount = Array.from({ length: 16 }, (_, i) => i + 1).filter((w) => {
    const wSaved = weeklyReflections[w];
    const wPatch = draftsByWeek[w];
    return Boolean(
      wPatch?.learnings?.trim() ||
        wSaved?.learnings?.trim() ||
        (wPatch?.resources?.length ?? wSaved?.resources?.length ?? 0) > 0
    );
  }).length;

  return (
    <div className="space-y-6">
      {/* 1. Header con Indicador de Estado y Botón de Guardado con Ctrl+S */}
      <SectionHeader
        title="Lo que aprendiste esta semana"
        badge={
          <span className="t-badge t-badge-accent t-num">
            Semana {selectedWeek}
          </span>
        }
        subtitle="Consolida conceptos técnicos con la técnica Feynman, guarda recursos de estudio y cierra tu semana."
        actions={
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleSave}
              className={`t-btn min-h-[44px] transition-all cursor-pointer ${
                isSavedRecently
                  ? 't-btn-secondary !text-[var(--ok)] !border-[var(--ok)]'
                  : hasUnsavedChanges
                    ? 't-btn-primary shadow-sm'
                    : 't-btn-secondary text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
              title="Guardar semana (Atajo: Ctrl + S)"
              aria-label={`Guardar reflexiones de la semana ${selectedWeek}`}
            >
              {isSavedRecently ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-[var(--ok)]" />
                  <span className="font-medium text-xs sm:text-sm">¡Guardado!</span>
                </>
              ) : hasUnsavedChanges ? (
                <>
                  <Save className="w-4 h-4" />
                  <span className="font-medium text-xs sm:text-sm">
                    Guardar semana <span className="t-num">{selectedWeek}</span>
                  </span>
                  <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono bg-white/20 text-white leading-none">
                    Ctrl+S
                  </span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span className="font-medium text-xs sm:text-sm">
                    Semana <span className="t-num">{selectedWeek}</span> al día
                  </span>
                </>
              )}
            </button>
          </div>
        }
      />

      {/* 2. Timeline Semestral Compacto con Hitos (S1..S16) */}
      <section 
        className="t-card p-4 sm:p-5 space-y-3"
        aria-label="Línea de tiempo del semestre académico"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono text-[var(--muted)]">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[var(--ink)]">Progreso del Semestre</span>
            <span>•</span>
            <span>
              Semana actual: <strong className="text-[var(--action)]">Semana {currentAcademicWeek}</strong>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span>
              <strong className="text-[var(--ink)] t-num">{completedWeeksCount}</strong> de 16 semanas documentadas
            </span>
          </div>
        </div>

        {/* Track de Semanas Interactivas */}
        <div 
          role="tablist"
          aria-label="Seleccionar semana académica (1 a 16)"
          className="grid grid-cols-8 sm:grid-cols-16 gap-1.5 pt-1"
        >
          {Array.from({ length: 16 }, (_, i) => i + 1).map((w) => {
            const isSelected = selectedWeek === w;
            const isCurrent = currentAcademicWeek === w;
            const isMidterm = w === 8;
            const isFinals = w === 16;
            const wSaved = weeklyReflections[w];
            const wPatch = draftsByWeek[w];
            const hasNotes = Boolean(
              wPatch?.learnings?.trim() ||
                wSaved?.learnings?.trim() ||
                (wPatch?.resources?.length ?? wSaved?.resources?.length ?? 0) > 0
            );

            return (
              <button
                key={w}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => setSelectedWeek(w)}
                className={`min-h-[44px] py-1.5 px-1 rounded-xl flex flex-col items-center justify-center relative cursor-pointer border transition-colors select-none focus-visible:outline-2 focus-visible:outline-[var(--action)] ${
                  isSelected
                    ? 'bg-[var(--action)] text-[var(--action-ink)] border-[var(--action)] shadow-sm'
                    : isCurrent
                      ? 'bg-[var(--surface-2)] text-[var(--ink)] border-[var(--action)]'
                      : 'bg-[var(--surface)] text-[var(--muted)] border-[var(--line)] hover:text-[var(--ink)] hover:border-[var(--line-strong)]'
                }`}
                title={`Semana ${w}${isMidterm ? ' (Exámenes Parciales)' : isFinals ? ' (Exámenes Finales)' : ''}${hasNotes ? ' • Con apuntes' : ''}`}
                aria-label={`Semana ${w}${isMidterm ? ', Parciales' : isFinals ? ', Finales' : ''}`}
              >
                <div className="flex items-center gap-0.5">
                  <span className="t-num text-xs font-semibold">
                    {w}
                  </span>
                  {hasNotes && (
                    <span
                      aria-hidden="true"
                      className={`w-1.5 h-1.5 rounded-full ${
                        isSelected ? 'bg-[var(--action-ink)]' : 'bg-[var(--action)]'
                      }`}
                    />
                  )}
                </div>

                {/* Subetiqueta para hitos especiales */}
                {isMidterm ? (
                  <span className={`text-xs font-mono font-medium leading-none mt-0.5 ${
                    isSelected ? 'text-[var(--action-ink)]' : 'text-[var(--warn)]'
                  }`}>
                    Parcial
                  </span>
                ) : isFinals ? (
                  <span className={`text-xs font-mono font-medium leading-none mt-0.5 ${
                    isSelected ? 'text-[var(--action-ink)]' : 'text-[var(--danger)]'
                  }`}>
                    Final
                  </span>
                ) : isCurrent ? (
                  <span className={`text-xs font-mono font-medium leading-none mt-0.5 ${
                    isSelected ? 'text-[var(--action-ink)]' : 'text-[var(--action)]'
                  }`}>
                    Hoy
                  </span>
                ) : (
                  <span className="text-xs font-mono opacity-60 leading-none mt-0.5">
                    S{w}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* 3. Tarjeta de Celebración de Semana Libre (si aplica) */}
      {isFreeWeek && (
        <FreeWeekCelebrationCard
          week={selectedWeek}
          onNavigateGym={() => onNavigateTab?.('gym')}
          onNavigateKanban={() => onNavigateTab?.('kanban')}
        />
      )}

      {/* 4. Grilla Principal de 2 Columnas (100% Académica y de Estudio) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Columna Izquierda: Síntesis Feynman, Prompts y Conceptos (Span 7) */}
        <section className="lg:col-span-7 t-card p-6 space-y-6">
          
          {/* Header del bloque Feynman */}
          <div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-[var(--ink)]">
                  Resumen con tus palabras (Técnica Feynman)
                </h3>
                <p className="text-sm text-[var(--muted)] mt-1 leading-relaxed">
                  ¿Qué entendiste realmente en la semana <span className="t-num font-semibold text-[var(--ink)]">{selectedWeek}</span> sin mirar tus notas?
                </p>
              </div>

              {learnings.trim() && (
                <button
                  type="button"
                  onClick={handleCopySummary}
                  className="t-btn t-btn-ghost !min-h-[40px] px-2.5 text-xs text-[var(--muted)] hover:text-[var(--ink)] shrink-0"
                  title="Copiar resumen al portapapeles"
                  aria-label="Copiar resumen semanal al portapapeles"
                >
                  {copiedSummary ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[var(--ok)]" />
                      <span className="text-[var(--ok)]">Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Copiar</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Píldoras de Prompts Guiados Feynman */}
            <div className="mt-3.5 pt-3 border-t border-[var(--line)]">
              <span className="block text-xs font-mono font-medium text-[var(--muted)] mb-2">
                Prompts guiados para activar tu memoria:
              </span>
              <div className="flex flex-wrap gap-2">
                {FEYNMAN_PROMPTS.map((prompt) => {
                  const Icon = prompt.icon;
                  return (
                    <button
                      key={prompt.id}
                      type="button"
                      onClick={() => handleInsertPrompt(prompt)}
                      className="min-h-[38px] px-3 py-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] text-xs text-[var(--muted)] hover:text-[var(--ink)] hover:border-[var(--line-strong)] hover:bg-[var(--surface)] transition-all flex items-center gap-1.5 cursor-pointer text-left"
                      title="Insertar este prompt en tu resumen"
                    >
                      <Icon className="w-3.5 h-3.5 text-[var(--action)] shrink-0" />
                      <span>{prompt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Textarea Principal de Aprendizaje */}
          <div className="space-y-1.5">
            <textarea
              id={`${uid}-learnings`}
              ref={textareaRef}
              rows={8}
              value={learnings}
              onChange={(e) => updatePatch({ learnings: e.target.value })}
              placeholder="Explica aquí el concepto central como si se lo enseñaras a alguien más. Si te trabas en algún punto, ese es tu vacío de conocimiento a repasar..."
              className="t-input min-h-[190px] resize-y font-sans leading-relaxed"
              aria-label={`Resumen de aprendizaje de la semana ${selectedWeek}`}
            />
            <div className="flex items-center justify-between text-xs font-mono text-[var(--muted)] pt-1">
              <span>Consejo: Usa oraciones directas y analogías claras</span>
              <span className="t-num">
                {learnings.trim() ? `${learnings.trim().split(/\s+/).length} palabras` : '0 palabras'}
              </span>
            </div>
          </div>

          {/* Selector de Estado Cognitivo / Energía */}
          <div className="border-t border-[var(--line)] pt-5 space-y-3">
            <div>
              <span className="block text-xs font-mono font-medium text-[var(--muted)] mb-1">
                ¿Cómo estuvo tu enfoque y energía esta semana?
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {MOOD_OPTIONS.map(({ id, label, Icon }) => {
                const isSelected = mood === id;
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => updatePatch({ mood: id })}
                    className={`min-h-[44px] px-3 py-2 rounded-xl border text-xs font-medium flex items-center justify-center gap-2 cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-[var(--action)] ${
                      isSelected
                        ? 'bg-[color-mix(in_oklab,var(--action)_14%,var(--surface))] border-[var(--action)] text-[var(--ink)] font-semibold shadow-xs'
                        : 'bg-[var(--surface-2)] border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)] hover:border-[var(--line-strong)]'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isSelected ? 'text-[var(--action)]' : 'text-[var(--muted)]'
                      }`}
                    />
                    <span className="truncate">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Conceptos Clave (#tags con Enter directo) */}
          <div className="border-t border-[var(--line)] pt-5 space-y-3">
            <label htmlFor={`${uid}-concept`} className="block text-xs font-mono font-medium text-[var(--muted)]">
              Conceptos clave que dominas (#{keyConcepts.length})
            </label>

            {keyConcepts.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {keyConcepts.map((concept) => {
                  const displayConcept = concept.replace(/^#+/, '').trim();
                  return (
                    <span
                      key={concept}
                      className="t-badge pl-3 pr-1 py-1 min-h-[38px] text-[var(--ink)] bg-[var(--surface-2)] border-[var(--line-strong)] flex items-center gap-1.5"
                    >
                      <span className="text-xs font-mono font-medium">#{displayConcept}</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteConcept(concept)}
                        className="w-7 h-7 min-w-[28px] min-h-[28px] rounded-md inline-flex items-center justify-center text-[var(--muted)] hover:text-[var(--danger)] hover:bg-[var(--surface)] transition-colors cursor-pointer"
                        aria-label={`Eliminar concepto ${displayConcept}`}
                        title="Quitar concepto"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            <form onSubmit={handleAddConcept} className="flex gap-2.5">
              <input
                id={`${uid}-concept`}
                type="text"
                placeholder="Escribe un concepto y pulsa Enter (ej. Sharding con Hash Key)"
                value={newConceptInput}
                onChange={(e) => setNewConceptInput(e.target.value)}
                className="t-input flex-1 min-h-[44px] text-sm"
              />
              <button
                type="submit"
                className="t-btn t-btn-secondary min-h-[44px] shrink-0 text-xs font-medium"
              >
                <Plus className="w-4 h-4" />
                <span>Agregar</span>
              </button>
            </form>
          </div>
        </section>

        {/* Columna Derecha: Bóveda de Videos y Lecturas (Span 5) */}
        <section className="lg:col-span-5 t-card p-6 space-y-6">
          
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <YoutubeIcon className="w-5 h-5 text-[#FF0000] shrink-0" />
                <h3 className="text-lg font-semibold text-[var(--ink)]">
                  Videos y lecturas de estudio
                </h3>
              </div>
              <p className="text-sm text-[var(--muted)] mt-1">
                Bóveda de recursos técnicos para repasar antes de parciales y finales.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowAddResource((v) => !v)}
              className="t-btn t-btn-secondary min-h-[40px] px-3 text-xs font-medium shrink-0"
              aria-label={showAddResource ? 'Cancelar agregar fuente' : 'Guardar nueva fuente de estudio'}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{showAddResource ? 'Cerrar' : 'Guardar fuente'}</span>
            </button>
          </div>

          {/* Formulario Rápido Desplegable */}
          {showAddResource && (
            <form
              onSubmit={handleAddResource}
              className="border-y border-[var(--line)] py-4 space-y-3 animate-in fade-in duration-150"
            >
              <div>
                <label htmlFor={`${uid}-res-title`} className="block text-xs font-mono font-medium text-[var(--muted)] mb-1">
                  Título del video o lectura *
                </label>
                <input
                  id={`${uid}-res-title`}
                  type="text"
                  required
                  placeholder="Ej. Sharding en MongoDB explicado en 10 minutos"
                  value={newResTitle}
                  onChange={(e) => setNewResTitle(e.target.value)}
                  className="t-input min-h-[44px] text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor={`${uid}-res-type`} className="block text-xs font-mono font-medium text-[var(--muted)] mb-1">
                    Formato de recurso
                  </label>
                  <select
                    id={`${uid}-res-type`}
                    value={newResType}
                    onChange={(e) => setNewResType(e.target.value as ResourceType)}
                    className="t-input min-h-[44px] text-sm cursor-pointer"
                  >
                    <option value="youtube">YouTube</option>
                    <option value="documentacion">Documentación Oficial</option>
                    <option value="articulo">Artículo / Blog Técnico</option>
                    <option value="libro">Libro / PDF</option>
                    <option value="texto">Apunte propio</option>
                  </select>
                </div>

                <div>
                  <label htmlFor={`${uid}-res-notes`} className="block text-xs font-mono font-medium text-[var(--muted)] mb-1">
                    Minuto o idea clave (opcional)
                  </label>
                  <input
                    id={`${uid}-res-notes`}
                    type="text"
                    placeholder="Ej. Min 04:20 compara réplicas vs shards"
                    value={newResNotes}
                    onChange={(e) => setNewResNotes(e.target.value)}
                    className="t-input min-h-[44px] text-sm"
                  />
                </div>
              </div>

              <div>
                <label htmlFor={`${uid}-res-url`} className="block text-xs font-mono font-medium text-[var(--muted)] mb-1">
                  Enlace URL (opcional)
                </label>
                <input
                  id={`${uid}-res-url`}
                  type="url"
                  placeholder="https://www.youtube.com/watch?v=... o https://docs..."
                  value={newResUrl}
                  onChange={(e) => setNewResUrl(e.target.value)}
                  className="t-input min-h-[44px] text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddResource(false)}
                  className="t-btn t-btn-ghost min-h-[40px] px-3 text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="t-btn t-btn-primary min-h-[40px] px-4 text-xs font-medium"
                >
                  Guardar a semana {selectedWeek}
                </button>
              </div>
            </form>
          )}

          {/* Lista de Fuentes (.t-row limpias sin anidación de cajas grises) */}
          {resources.length === 0 ? (
            <div className="py-8 text-center border border-dashed border-[var(--line)] rounded-xl p-6">
              <BookOpen className="w-8 h-8 text-[var(--muted)] mx-auto mb-2 opacity-50" />
              <p className="text-sm text-[var(--muted)] font-medium">
                No tienes videos ni lecturas guardadas en la semana <span className="t-num">{selectedWeek}</span>.
              </p>
              <p className="text-xs text-[var(--muted)] mt-1 opacity-80">
                Guarda enlaces con minutos clave para repasarlos rápidamente antes de tus exámenes.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--line)]">
              {resources.map((res) => {
                const isYouTube =
                  res.type === 'youtube' ||
                  Boolean(
                    res.url &&
                      (res.url.includes('youtube.com') || res.url.includes('youtu.be'))
                  );
                const normalizedResUrl = res.url
                  ? res.url.startsWith('http://') || res.url.startsWith('https://')
                    ? res.url
                    : `https://${res.url}`
                  : null;

                return (
                  <div
                    key={res.id}
                    className="py-3.5 first:pt-0 last:pb-0 flex items-start justify-between gap-3 group"
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <span className="mt-1 shrink-0">
                        {isYouTube ? (
                          <YoutubeIcon className="w-5 h-5 text-[#FF0000]" />
                        ) : res.type === 'documentacion' || res.type === 'libro' ? (
                          <BookOpen className="w-4 h-4 text-[var(--action)]" />
                        ) : (
                          <FileText className="w-4 h-4 text-[var(--muted)]" />
                        )}
                      </span>

                      <div className="min-w-0 flex-1">
                        {normalizedResUrl ? (
                          <a
                            href={normalizedResUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="min-h-[44px] flex flex-col justify-center focus-visible:outline-2 focus-visible:outline-[var(--action)] rounded-lg"
                            aria-label={`Abrir recurso ${res.title} (se abre en nueva pestaña)`}
                          >
                            <span className="text-sm font-medium text-[var(--ink)] group-hover:text-[var(--action)] leading-snug transition-colors line-clamp-2">
                              {res.title}
                            </span>
                            <span className="flex flex-wrap items-center gap-1.5 mt-1 text-xs text-[var(--muted)]">
                              <span className="font-mono text-xs font-semibold px-1.5 py-0.5 rounded bg-[var(--surface-2)]">
                                {RESOURCE_TYPE_LABEL[res.type]}
                              </span>
                              {res.notes && (
                                <>
                                  <span aria-hidden="true">•</span>
                                  <span className="line-clamp-1">{res.notes}</span>
                                </>
                              )}
                            </span>
                          </a>
                        ) : (
                          <div className="min-h-[44px] flex flex-col justify-center">
                            <span className="text-sm font-medium text-[var(--ink)] leading-snug line-clamp-2">
                              {res.title}
                            </span>
                            <span className="flex flex-wrap items-center gap-1.5 mt-1 text-xs text-[var(--muted)]">
                              <span className="font-mono text-xs font-semibold px-1.5 py-0.5 rounded bg-[var(--surface-2)]">
                                {RESOURCE_TYPE_LABEL[res.type]}
                              </span>
                              {res.notes && (
                                <>
                                  <span aria-hidden="true">•</span>
                                  <span className="line-clamp-1">{res.notes}</span>
                                </>
                              )}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Acciones de la fuente */}
                    <div className="flex items-center gap-1 shrink-0 pt-1">
                      {normalizedResUrl && (
                        <a
                          href={normalizedResUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="t-btn t-btn-ghost t-btn-icon !min-w-[40px] !min-h-[40px] text-[var(--muted)] hover:text-[var(--action)]"
                          aria-label={`Abrir ${res.title}`}
                          title={isYouTube ? 'Ver video en YouTube' : 'Abrir enlace externo'}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}

                      <button
                        type="button"
                        onClick={() => handleDeleteResource(res.id)}
                        className="t-btn t-btn-ghost t-btn-icon !min-w-[40px] !min-h-[40px] text-[var(--muted)] hover:text-[var(--danger)]"
                        aria-label={`Eliminar fuente ${res.title}`}
                        title="Eliminar de la semana"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pie de recursos con contador de estudio */}
          <div className="pt-4 border-t border-[var(--line)] flex items-center justify-between text-xs font-mono text-[var(--muted)]">
            <span>
              Total: <strong className="text-[var(--ink)] t-num">{resources.length}</strong> fuente{resources.length === 1 ? '' : 's'}
            </span>
            <span className="text-[var(--action)]">
              {resources.filter((r) => r.type === 'youtube').length} videos YouTube
            </span>
          </div>

        </section>

      </div>
    </div>
  );
};
