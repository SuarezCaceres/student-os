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
  ResourceCategory,
  ResourceType,
  UniversityAssignment,
  WeeklyReflection,
} from '../../types';
import type { NavTab } from '../layout/Navbar';
import { triggerConfetti } from '../../utils/confetti';
import { SectionHeader } from '../common/SectionHeader';
import { YoutubeIcon } from '../common/YoutubeIcon';
import { TiktokIcon } from '../common/TiktokIcon';
import { ModalShell } from '../common/ModalShell';
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

export const RESOURCE_CATEGORIES: Array<{
  id: ResourceCategory;
  label: string;
  shortLabel: string;
  emoji: string;
}> = [
  { id: 'ia_claude', label: 'IA en Claude', shortLabel: 'Claude', emoji: '🤖' },
  { id: 'ia_gemini', label: 'IA en Gemini', shortLabel: 'Gemini', emoji: '💎' },
  { id: 'skills', label: 'Skills & Agentes', shortLabel: 'Skills', emoji: '⚡' },
  { id: 'video_gen', label: 'Generación de Videos', shortLabel: 'Video Gen', emoji: '🎬' },
  { id: 'cursos', label: 'Cursos', shortLabel: 'Cursos', emoji: '🎓' },
  { id: 'conferencias', label: 'Conferencias & Talks', shortLabel: 'Talks', emoji: '🎙️' },
  { id: 'general', label: 'General / Software', shortLabel: 'General', emoji: '📚' },
];

const RESOURCE_TYPE_LABEL: Record<ResourceType, string> = {
  youtube: 'YouTube',
  tiktok: 'TikTok',
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

  // Modal de Consolidación y Guardado (Pop-up)
  const [isConsolidateOpen, setIsConsolidateOpen] = useState<boolean>(false);
  const [activeModalTab, setActiveModalTab] = useState<'all' | 'sources' | 'tags'>('all');

  // Filtro de categoría en la bóveda de fuentes
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<ResourceCategory | 'todas'>('todas');

  // Inputs para agregar conceptos y recursos
  const [newConceptInput, setNewConceptInput] = useState<string>('');
  const [showAddResource, setShowAddResource] = useState<boolean>(false);
  const [newResTitle, setNewResTitle] = useState<string>('');
  const [newResUrl, setNewResUrl] = useState<string>('');
  const [newResType, setNewResType] = useState<ResourceType>('youtube');
  const [newResCategory, setNewResCategory] = useState<ResourceCategory>('general');
  const [newResNotes, setNewResNotes] = useState<string>('');

  const saved = weeklyReflections[selectedWeek];
  const patch = draftsByWeek[selectedWeek];

  const learnings = patch?.learnings ?? saved?.learnings ?? '';
  const keyConcepts = patch?.keyConcepts ?? saved?.keyConcepts ?? [];
  const resources = patch?.resources ?? saved?.resources ?? [];
  const mood: ReflectionMood = patch?.mood ?? saved?.mood ?? 'productivo';

  // Detección de cambios sin guardar
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

  // Detección de semana libre
  const weekAssignments = assignments.filter((a) => a.week === selectedWeek);
  const pendingWeekAssignments = weekAssignments.filter((a) => a.status !== 'entregado');
  const isFreeWeek = weekAssignments.length > 0 && pendingWeekAssignments.length === 0;

  // Guardado final consolidado
  const handleConfirmSave = useCallback(() => {
    const reflection: WeeklyReflection = {
      week: selectedWeek,
      learnings: learnings.trim(),
      keyConcepts,
      resources,
      gymReflection: saved?.gymReflection,
      mood,
      updatedAt: new Date().toISOString().split('T')[0],
    };

    onSaveReflection(reflection);
    setDraftsByWeek((prev) => {
      const next = { ...prev };
      delete next[selectedWeek];
      return next;
    });

    setIsConsolidateOpen(false);
    setIsSavedRecently(true);
    setTimeout(() => setIsSavedRecently(false), 2400);
    triggerConfetti();
  }, [selectedWeek, learnings, keyConcepts, resources, mood, saved, onSaveReflection]);

  // Atajo de teclado: Ctrl + S / Cmd + S abre el modal de consolidación o confirma el guardado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        setIsConsolidateOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Insertar prompt Feynman en el Bloc de Notas
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

  // Agregar concepto (#tags)
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

  // Detección automática de tipo (YouTube / TikTok) y categoría sugerida
  const handleUrlChange = (url: string) => {
    setNewResUrl(url);
    const lower = url.toLowerCase();

    // Auto-detección de plataforma
    if (lower.includes('tiktok.com') || lower.includes('vt.tiktok.com')) {
      setNewResType('tiktok');
    } else if (lower.includes('youtube.com') || lower.includes('youtu.be')) {
      setNewResType('youtube');
    }

    // Auto-sugerencia de categoría
    if (lower.includes('claude') || lower.includes('anthropic')) {
      setNewResCategory('ia_claude');
    } else if (lower.includes('gemini') || lower.includes('antigravity') || lower.includes('deepmind')) {
      setNewResCategory('ia_gemini');
    } else if (lower.includes('skill') || lower.includes('mcp') || lower.includes('agent')) {
      setNewResCategory('skills');
    } else if (lower.includes('sora') || lower.includes('runway') || lower.includes('kling') || lower.includes('luma') || lower.includes('video')) {
      setNewResCategory('video_gen');
    } else if (lower.includes('coursera') || lower.includes('udemy') || lower.includes('curso')) {
      setNewResCategory('cursos');
    }
  };

  const handleTitleChange = (title: string) => {
    setNewResTitle(title);
    const lower = title.toLowerCase();

    // Sugerencia por título si todavía es general
    if (newResCategory === 'general') {
      if (lower.includes('claude') || lower.includes('anthropic')) {
        setNewResCategory('ia_claude');
      } else if (lower.includes('gemini') || lower.includes('antigravity')) {
        setNewResCategory('ia_gemini');
      } else if (lower.includes('skill') || lower.includes('mcp')) {
        setNewResCategory('skills');
      } else if (lower.includes('sora') || lower.includes('runway') || lower.includes('kling') || lower.includes('video ai')) {
        setNewResCategory('video_gen');
      } else if (lower.includes('curso') || lower.includes('certificacion')) {
        setNewResCategory('cursos');
      } else if (lower.includes('talk') || lower.includes('conferencia') || lower.includes('keynote')) {
        setNewResCategory('conferencias');
      }
    }
  };

  // Agregar recurso a la semana
  const handleAddResource = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = newResTitle.trim();
    if (!cleanTitle) return;

    const newRes: LearningResource = {
      id: `res-${Date.now()}`,
      title: cleanTitle,
      url: newResUrl.trim() || undefined,
      type: newResType,
      category: newResCategory,
      notes: newResNotes.trim() || undefined,
    };

    updatePatch({ resources: [...resources, newRes] });
    setNewResTitle('');
    setNewResUrl('');
    setNewResNotes('');
    setNewResCategory('general');
    setShowAddResource(false);
  };

  const handleDeleteResource = (resId: string) => {
    updatePatch({
      resources: resources.filter((r) => r.id !== resId),
    });
  };

  // Copiar resumen de notas al portapapeles
  const handleCopyNotepad = async () => {
    if (!learnings.trim()) return;
    try {
      await navigator.clipboard.writeText(learnings);
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2000);
    } catch {
      // Fallback
    }
  };

  // Filtrado de fuentes por categoría
  const filteredResources = resources.filter((res) => {
    if (selectedCategoryFilter === 'todas') return true;
    return (res.category || 'general') === selectedCategoryFilter;
  });

  // Conteo de semanas documentadas
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
      {/* 1. Header del Bloc de Notas */}
      <SectionHeader
        title="Bloc de notas de aprendizaje"
        badge={
          <span className="t-badge t-badge-accent t-num">
            Semana {selectedWeek}
          </span>
        }
        subtitle="Espacio minimalista para redactar tu síntesis de estudio. Al guardar, consolida tu energía, conceptos y fuentes técnicas."
        actions={
          <div className="flex items-center gap-2.5">
            {/* Botón rápido para abrir Bóveda de Fuentes */}
            <button
              type="button"
              onClick={() => {
                setActiveModalTab('sources');
                setIsConsolidateOpen(true);
              }}
              className="t-btn t-btn-secondary min-h-[44px] text-xs font-medium cursor-pointer"
              title="Abrir bóveda de fuentes y videos de estudio"
              aria-label="Abrir fuentes de estudio"
            >
              <div className="flex items-center gap-1.5">
                <YoutubeIcon className="w-4 h-4 text-[#FF0000]" />
                <TiktokIcon className="w-3.5 h-3.5 text-[var(--ink)]" />
                <span>Fuentes</span>
                <span className="t-num font-mono px-1.5 py-0.2 rounded bg-[var(--surface-2)] text-[var(--muted)] ml-0.5">
                  {resources.length}
                </span>
              </div>
            </button>

            {/* Botón Principal: Guardar Semana (Abre Pop-up de Consolidación) */}
            <button
              type="button"
              onClick={() => {
                setActiveModalTab('all');
                setIsConsolidateOpen(true);
              }}
              className={`t-btn min-h-[44px] transition-all cursor-pointer ${
                isSavedRecently
                  ? 't-btn-secondary !text-[var(--ok)] !border-[var(--ok)]'
                  : hasUnsavedChanges
                    ? 't-btn-primary shadow-sm'
                    : 't-btn-secondary text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
              title="Guardar y consolidar semana (Atajo: Ctrl + S)"
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

        {/* Track de Semanas 1..16 */}
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

      {/* 4. LIENZO PRINCIPAL: BLOC DE NOTAS SEMANAL (Distraction-Free Notepad) */}
      <section className="t-card p-6 sm:p-8 space-y-5">
        {/* Barra de Herramientas del Bloc de Notas */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--line)]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-mono text-[var(--muted)] font-medium mr-1">
              Prompts Feynman:
            </span>
            {FEYNMAN_PROMPTS.map((prompt) => {
              const Icon = prompt.icon;
              return (
                <button
                  key={prompt.id}
                  type="button"
                  onClick={() => handleInsertPrompt(prompt)}
                  className="min-h-[36px] px-2.5 py-1 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] text-xs text-[var(--muted)] hover:text-[var(--ink)] hover:border-[var(--line-strong)] hover:bg-[var(--surface)] transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Insertar este prompt en el bloc de notas"
                >
                  <Icon className="w-3.5 h-3.5 text-[var(--action)] shrink-0" />
                  <span>{prompt.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            {learnings.trim() && (
              <button
                type="button"
                onClick={handleCopyNotepad}
                className="t-btn t-btn-ghost !min-h-[36px] px-2.5 text-xs text-[var(--muted)] hover:text-[var(--ink)]"
                title="Copiar notas al portapapeles"
                aria-label="Copiar notas de la semana"
              >
                {copiedSummary ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[var(--ok)]" />
                    <span className="text-[var(--ok)]">Copiado</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Área de Texto Principal del Bloc de Notas */}
        <div className="space-y-2">
          <textarea
            id={`${uid}-notepad`}
            ref={textareaRef}
            rows={14}
            value={learnings}
            onChange={(e) => updatePatch({ learnings: e.target.value })}
            placeholder="Escribe aquí libremente lo que aprendiste esta semana... Usa tus propias palabras para consolidar conceptos técnicos, arquitectura de software, notas de clase o bugs resueltos.

Al presionar 'Guardar semana' (o Ctrl+S), podrás etiquetar tu nivel de energía, registrar conceptos clave y vincular tus videos de YouTube o TikTok."
            className="t-input min-h-[340px] resize-y font-sans text-base leading-relaxed p-4"
            aria-label={`Bloc de notas de aprendizaje de la semana ${selectedWeek}`}
          />
        </div>

        {/* Barra de Estado y Metadatos al pie del Bloc de Notas */}
        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono text-[var(--muted)]">
          <div className="flex flex-wrap items-center gap-2">
            {/* Chip de Estado Cognitivo / Mood */}
            <button
              type="button"
              onClick={() => {
                setActiveModalTab('all');
                setIsConsolidateOpen(true);
              }}
              className="px-2.5 py-1 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] text-[var(--ink)] hover:border-[var(--line-strong)] cursor-pointer flex items-center gap-1.5 transition-colors"
              title="Cambiar estado de energía en el pop-up"
            >
              <span>{MOOD_OPTIONS.find((m) => m.id === mood)?.label || mood}</span>
            </button>

            {/* Chip de Conceptos Clave */}
            <button
              type="button"
              onClick={() => {
                setActiveModalTab('tags');
                setIsConsolidateOpen(true);
              }}
              className="px-2.5 py-1 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] text-[var(--ink)] hover:border-[var(--line-strong)] cursor-pointer flex items-center gap-1.5 transition-colors"
              title="Ver o editar conceptos clave en el pop-up"
            >
              <span>#{keyConcepts.length} concepto{keyConcepts.length === 1 ? '' : 's'}</span>
            </button>

            {/* Chip de Fuentes Guardadas */}
            <button
              type="button"
              onClick={() => {
                setActiveModalTab('sources');
                setIsConsolidateOpen(true);
              }}
              className="px-2.5 py-1 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] text-[var(--ink)] hover:border-[var(--line-strong)] cursor-pointer flex items-center gap-1.5 transition-colors"
              title="Ver o agregar videos y lecturas en el pop-up"
            >
              <span>{resources.length} fuente{resources.length === 1 ? '' : 's'}</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <span className="t-num">
              {learnings.trim() ? `${learnings.trim().split(/\s+/).length} palabras` : '0 palabras'}
            </span>
            <span>•</span>
            <span>Atajo: <kbd className="px-1 py-0.5 rounded bg-[var(--surface-2)] border border-[var(--line)] text-[var(--ink)]">Ctrl+S</kbd></span>
          </div>
        </div>
      </section>

      {/* 5. POP-UP MODAL DE CONSOLIDACIÓN Y GUARDADO (ModalShell) */}
      <ModalShell
        isOpen={isConsolidateOpen}
        onClose={() => setIsConsolidateOpen(false)}
        maxWidth="2xl"
        badge={`Semana ${selectedWeek}`}
        icon={<Save className="w-5 h-5 text-[var(--action)]" />}
        title={`Consolidar y Guardar Semana ${selectedWeek}`}
        subtitle="Organiza tu estado de energía, conceptos clave y fuentes técnicas (YouTube & TikTok con categorías IA)."
        footer={
          <div className="flex items-center justify-between gap-3 w-full">
            <button
              type="button"
              onClick={() => setIsConsolidateOpen(false)}
              className="t-btn t-btn-ghost min-h-[44px] px-4 text-xs font-medium"
            >
              Continuar editando
            </button>

            <button
              type="button"
              onClick={handleConfirmSave}
              className="t-btn t-btn-primary min-h-[44px] px-5 text-xs font-medium cursor-pointer shadow-sm"
            >
              <Check className="w-4 h-4" />
              <span>Confirmar y Guardar Semana {selectedWeek}</span>
            </button>
          </div>
        }
      >
        <div className="space-y-6 py-1">
          {/* Tabs internas del Pop-up */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] font-mono text-xs">
            <button
              type="button"
              onClick={() => setActiveModalTab('all')}
              className={`flex-1 py-2 rounded-lg font-medium transition-all cursor-pointer text-center ${
                activeModalTab === 'all'
                  ? 'bg-[var(--surface)] text-[var(--ink)] shadow-xs'
                  : 'text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              Resumen General
            </button>
            <button
              type="button"
              onClick={() => setActiveModalTab('sources')}
              className={`flex-1 py-2 rounded-lg font-medium transition-all cursor-pointer text-center flex items-center justify-center gap-1.5 ${
                activeModalTab === 'sources'
                  ? 'bg-[var(--surface)] text-[var(--ink)] shadow-xs'
                  : 'text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              <span>Fuentes ({resources.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveModalTab('tags')}
              className={`flex-1 py-2 rounded-lg font-medium transition-all cursor-pointer text-center ${
                activeModalTab === 'tags'
                  ? 'bg-[var(--surface)] text-[var(--ink)] shadow-xs'
                  : 'text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              Conceptos (#{keyConcepts.length})
            </button>
          </div>

          {/* Bloque 1: Estado Cognitivo / Energía (Visible en 'all') */}
          {(activeModalTab === 'all') && (
            <div className="space-y-2.5">
              <label className="block text-xs font-mono font-medium text-[var(--muted)]">
                ¿Cómo estuvo tu enfoque y energía en la semana {selectedWeek}?
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {MOOD_OPTIONS.map(({ id, label, Icon }) => {
                  const isSelected = mood === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => updatePatch({ mood: id })}
                      className={`min-h-[44px] px-3 py-2 rounded-xl border text-xs font-medium flex items-center justify-center gap-2 cursor-pointer transition-colors ${
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
          )}

          {/* Bloque 2: Conceptos Clave (Visible en 'all' o 'tags') */}
          {(activeModalTab === 'all' || activeModalTab === 'tags') && (
            <div className="space-y-2.5 pt-2 border-t border-[var(--line)]">
              <label htmlFor={`${uid}-modal-concept`} className="block text-xs font-mono font-medium text-[var(--muted)]">
                Conceptos clave dominados (#{keyConcepts.length})
              </label>

              {keyConcepts.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  {keyConcepts.map((concept) => {
                    const displayConcept = concept.replace(/^#+/, '').trim();
                    return (
                      <span
                        key={concept}
                        className="t-badge pl-3 pr-1 py-1 min-h-[36px] text-[var(--ink)] bg-[var(--surface-2)] border-[var(--line-strong)] flex items-center gap-1.5"
                      >
                        <span className="text-xs font-mono font-medium">#{displayConcept}</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteConcept(concept)}
                          className="w-6 h-6 min-w-[24px] min-h-[24px] rounded inline-flex items-center justify-center text-[var(--muted)] hover:text-[var(--danger)] hover:bg-[var(--surface)] transition-colors cursor-pointer"
                          aria-label={`Eliminar concepto ${displayConcept}`}
                          title="Quitar concepto"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}

              <form onSubmit={handleAddConcept} className="flex gap-2">
                <input
                  id={`${uid}-modal-concept`}
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
          )}

          {/* Bloque 3: Bóveda de Fuentes & Videos (YouTube / TikTok con Categorías IA) */}
          {(activeModalTab === 'all' || activeModalTab === 'sources') && (
            <div className="space-y-4 pt-3 border-t border-[var(--line)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-semibold text-[var(--ink)] flex items-center gap-2">
                    <YoutubeIcon className="w-4 h-4 text-[#FF0000]" />
                    <TiktokIcon className="w-3.5 h-3.5 text-[var(--ink)]" />
                    <span>Videos y Lecturas Técnicas ({resources.length})</span>
                  </h4>
                  <p className="text-xs text-[var(--muted)] mt-0.5">
                    Micro-tutoriales de TikTok, videos de YouTube y documentación con categorías de IA.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAddResource((v) => !v)}
                  className="t-btn t-btn-secondary min-h-[38px] px-3 text-xs font-medium shrink-0 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{showAddResource ? 'Cerrar' : '+ Nueva Fuente'}</span>
                </button>
              </div>

              {/* Formulario de Nueva Fuente con Categorías */}
              {showAddResource && (
                <form
                  onSubmit={handleAddResource}
                  className="border border-[var(--line-strong)] rounded-xl bg-[var(--surface-2)] p-4 space-y-3 animate-in fade-in duration-150"
                >
                  <div className="font-semibold text-xs font-mono text-[var(--ink)] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[var(--action)]" />
                    <span>Agregar Fuente a la Semana {selectedWeek}</span>
                  </div>

                  <div>
                    <label htmlFor={`${uid}-pop-title`} className="block text-xs font-mono font-medium text-[var(--muted)] mb-1">
                      Título del recurso *
                    </label>
                    <input
                      id={`${uid}-pop-title`}
                      type="text"
                      required
                      placeholder="Ej. Prompts avanzados en Claude Code o Sharding en MongoDB"
                      value={newResTitle}
                      onChange={(e) => handleTitleChange(e.target.value)}
                      className="t-input min-h-[42px] text-sm bg-[var(--surface)]"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Selector de Plataforma / Formato (con TikTok) */}
                    <div>
                      <label htmlFor={`${uid}-pop-type`} className="block text-xs font-mono font-medium text-[var(--muted)] mb-1">
                        Plataforma o Formato
                      </label>
                      <select
                        id={`${uid}-pop-type`}
                        value={newResType}
                        onChange={(e) => setNewResType(e.target.value as ResourceType)}
                        className="t-input min-h-[42px] text-sm bg-[var(--surface)] cursor-pointer"
                      >
                        <option value="youtube">YouTube</option>
                        <option value="tiktok">TikTok</option>
                        <option value="documentacion">Documentación Oficial</option>
                        <option value="articulo">Artículo / Blog Técnico</option>
                        <option value="libro">Libro / PDF</option>
                        <option value="texto">Apunte propio</option>
                      </select>
                    </div>

                    {/* Selector de Categoría Temática Solicitada */}
                    <div>
                      <label htmlFor={`${uid}-pop-cat`} className="block text-xs font-mono font-medium text-[var(--muted)] mb-1">
                        Categoría Temática
                      </label>
                      <select
                        id={`${uid}-pop-cat`}
                        value={newResCategory}
                        onChange={(e) => setNewResCategory(e.target.value as ResourceCategory)}
                        className="t-input min-h-[42px] text-sm bg-[var(--surface)] cursor-pointer font-sans"
                      >
                        {RESOURCE_CATEGORIES.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.emoji} {cat.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label htmlFor={`${uid}-pop-url`} className="block text-xs font-mono font-medium text-[var(--muted)] mb-1">
                      Enlace URL (YouTube o TikTok)
                    </label>
                    <input
                      id={`${uid}-pop-url`}
                      type="url"
                      placeholder="https://www.tiktok.com/@... o https://www.youtube.com/..."
                      value={newResUrl}
                      onChange={(e) => handleUrlChange(e.target.value)}
                      className="t-input min-h-[42px] text-sm bg-[var(--surface)]"
                    />
                  </div>

                  <div>
                    <label htmlFor={`${uid}-pop-notes`} className="block text-xs font-mono font-medium text-[var(--muted)] mb-1">
                      Minuto o apunte clave (opcional)
                    </label>
                    <input
                      id={`${uid}-pop-notes`}
                      type="text"
                      placeholder="Ej. Min 02:15 explica cómo crear tools personalizadas"
                      value={newResNotes}
                      onChange={(e) => setNewResNotes(e.target.value)}
                      className="t-input min-h-[42px] text-sm bg-[var(--surface)]"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAddResource(false)}
                      className="t-btn t-btn-ghost min-h-[38px] px-3 text-xs"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="t-btn t-btn-primary min-h-[38px] px-4 text-xs font-medium"
                    >
                      Guardar Fuente
                    </button>
                  </div>
                </form>
              )}

              {/* Filtro de Categorías en el Pop-up */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 text-xs font-mono">
                <button
                  type="button"
                  onClick={() => setSelectedCategoryFilter('todas')}
                  className={`px-2.5 py-1 rounded-lg border whitespace-nowrap cursor-pointer transition-colors ${
                    selectedCategoryFilter === 'todas'
                      ? 'bg-[var(--action)] text-[var(--action-ink)] border-[var(--action)] font-semibold'
                      : 'bg-[var(--surface-2)] text-[var(--muted)] border-[var(--line)] hover:text-[var(--ink)]'
                  }`}
                >
                  Todas ({resources.length})
                </button>
                {RESOURCE_CATEGORIES.map((cat) => {
                  const count = resources.filter((r) => (r.category || 'general') === cat.id).length;
                  if (count === 0 && selectedCategoryFilter !== cat.id) return null;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCategoryFilter(cat.id)}
                      className={`px-2.5 py-1 rounded-lg border whitespace-nowrap cursor-pointer transition-colors flex items-center gap-1 ${
                        selectedCategoryFilter === cat.id
                          ? 'bg-[var(--action)] text-[var(--action-ink)] border-[var(--action)] font-semibold'
                          : 'bg-[var(--surface-2)] text-[var(--muted)] border-[var(--line)] hover:text-[var(--ink)]'
                      }`}
                    >
                      <span>{cat.emoji}</span>
                      <span>{cat.shortLabel}</span>
                      <span className="opacity-80 t-num">({count})</span>
                    </button>
                  );
                })}
              </div>

              {/* Lista de Fuentes en el Pop-up */}
              {filteredResources.length === 0 ? (
                <p className="text-xs font-mono text-[var(--muted)] py-3 text-center border border-dashed border-[var(--line)] rounded-xl">
                  {resources.length === 0
                    ? 'No hay fuentes guardadas en esta semana. Agrega videos de YouTube o TikTok arriba.'
                    : 'No hay fuentes en la categoría seleccionada.'}
                </p>
              ) : (
                <div className="divide-y divide-[var(--line)] border border-[var(--line)] rounded-xl bg-[var(--surface)] overflow-hidden">
                  {filteredResources.map((res) => {
                    const isYouTube =
                      res.type === 'youtube' ||
                      Boolean(
                        res.url &&
                          (res.url.includes('youtube.com') || res.url.includes('youtu.be'))
                      );
                    const isTikTok =
                      res.type === 'tiktok' ||
                      Boolean(
                        res.url &&
                          (res.url.includes('tiktok.com') || res.url.includes('vt.tiktok.com'))
                      );
                    const categoryMeta = RESOURCE_CATEGORIES.find(
                      (c) => c.id === (res.category || 'general')
                    );
                    const normalizedResUrl = res.url
                      ? res.url.startsWith('http://') || res.url.startsWith('https://')
                        ? res.url
                        : `https://${res.url}`
                      : null;

                    return (
                      <div
                        key={res.id}
                        className="p-3 flex items-start justify-between gap-3 group hover:bg-[var(--surface-2)]/60 transition-colors"
                      >
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          <span className="mt-1 shrink-0">
                            {isYouTube ? (
                              <YoutubeIcon className="w-4 h-4 text-[#FF0000]" />
                            ) : isTikTok ? (
                              <TiktokIcon className="w-4 h-4 text-[var(--ink)]" />
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
                                className="block focus-visible:outline-2 focus-visible:outline-[var(--action)] rounded"
                                aria-label={`Abrir ${res.title} (se abre en nueva pestaña)`}
                              >
                                <span className="text-xs sm:text-sm font-medium text-[var(--ink)] group-hover:text-[var(--action)] leading-snug transition-colors line-clamp-1">
                                  {res.title}
                                </span>
                              </a>
                            ) : (
                              <span className="text-xs sm:text-sm font-medium text-[var(--ink)] leading-snug line-clamp-1">
                                {res.title}
                              </span>
                            )}

                            <div className="flex flex-wrap items-center gap-1.5 mt-1 text-xs text-[var(--muted)] font-mono">
                              <span className="px-1.5 py-0.5 rounded bg-[var(--surface-2)] border border-[var(--line)]">
                                {categoryMeta?.emoji} {categoryMeta?.shortLabel || 'General'}
                              </span>
                              <span>•</span>
                              <span>{RESOURCE_TYPE_LABEL[res.type]}</span>
                              {res.notes && (
                                <>
                                  <span>•</span>
                                  <span className="line-clamp-1 italic">{res.notes}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {normalizedResUrl && (
                            <a
                              href={normalizedResUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="t-btn t-btn-ghost t-btn-icon !min-w-[36px] !min-h-[36px] text-[var(--muted)] hover:text-[var(--action)]"
                              aria-label={`Abrir ${res.title}`}
                              title={isYouTube ? 'Ver en YouTube' : isTikTok ? 'Ver en TikTok' : 'Abrir enlace'}
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}

                          <button
                            type="button"
                            onClick={() => handleDeleteResource(res.id)}
                            className="t-btn t-btn-ghost t-btn-icon !min-w-[36px] !min-h-[36px] text-[var(--muted)] hover:text-[var(--danger)]"
                            aria-label={`Eliminar fuente ${res.title}`}
                            title="Eliminar fuente"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </ModalShell>
    </div>
  );
};
