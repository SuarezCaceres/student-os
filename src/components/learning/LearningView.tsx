import React, { useId, useState } from 'react';
import {
  BatteryMedium,
  BookOpen,
  Dumbbell,
  ExternalLink,
  FileText,
  Flame,
  Palmtree,
  Plus,
  Save,
  Trash2,
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
  gymReflection?: string;
  mood?: ReflectionMood;
}

const MOOD_OPTIONS: Array<{
  id: ReflectionMood;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'increible', label: 'Con toda la energía', Icon: Flame },
  { id: 'productivo', label: 'Enfocado', Icon: Zap },
  { id: 'despejado', label: 'En calma', Icon: Palmtree },
  { id: 'cansado', label: 'Cansado', Icon: BatteryMedium },
];

const RESOURCE_TYPE_LABEL: Record<ResourceType, string> = {
  youtube: 'YouTube',
  documentacion: 'Documentación',
  articulo: 'Artículo',
  libro: 'Libro / PDF',
  texto: 'Apunte',
};

export const LearningView: React.FC<LearningViewProps> = ({
  currentAcademicWeek,
  assignments,
  gymRoutines,
  weeklyReflections = {},
  onSaveReflection,
  onNavigateTab,
}) => {
  const uid = useId();
  const [selectedWeek, setSelectedWeek] = useState<number>(currentAcademicWeek);
  const [draftsByWeek, setDraftsByWeek] = useState<Record<number, WeekDraftPatch>>(
    {}
  );

  // Local inputs for adding concepts & resources
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
  const gymReflection = patch?.gymReflection ?? saved?.gymReflection ?? '';
  const mood: ReflectionMood = patch?.mood ?? saved?.mood ?? 'productivo';

  const updatePatch = (next: WeekDraftPatch) => {
    setDraftsByWeek((prev) => ({
      ...prev,
      [selectedWeek]: {
        ...prev[selectedWeek],
        ...next,
      },
    }));
  };

  // Free week calculation
  const weekAssignments = assignments.filter((a) => a.week === selectedWeek);
  const pendingWeekAssignments = weekAssignments.filter(
    (a) => a.status !== 'entregado'
  );
  const deliveredCount = weekAssignments.length - pendingWeekAssignments.length;
  const isFreeWeek =
    weekAssignments.length === 0 || pendingWeekAssignments.length === 0;

  // Gym summary
  const totalGymSetsPlanned = gymRoutines.reduce(
    (acc, r) => acc + r.exercises.reduce((exAcc, ex) => exAcc + ex.sets, 0),
    0
  );
  const totalGymSetsDone = gymRoutines.reduce(
    (acc, r) =>
      acc +
      r.exercises.reduce(
        (exAcc, ex) => exAcc + ex.completedSets.filter(Boolean).length,
        0
      ),
    0
  );

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

  const handleSave = () => {
    const reflection: WeeklyReflection = {
      week: selectedWeek,
      learnings: learnings.trim(),
      keyConcepts,
      resources,
      gymReflection: gymReflection.trim() || undefined,
      mood,
      updatedAt: new Date().toISOString().split('T')[0],
    };

    onSaveReflection(reflection);
    setDraftsByWeek((prev) => {
      const next = { ...prev };
      delete next[selectedWeek];
      return next;
    });
    triggerConfetti();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <SectionHeader
        title="Lo que aprendiste esta semana"
        badge={
          <span className="t-badge t-badge-accent t-num">
            Semana {selectedWeek}
          </span>
        }
        subtitle="Explica con tus palabras lo más importante, guarda tus videos de estudio y cierra la semana."
        actions={
          <button
            type="button"
            onClick={handleSave}
            className="t-btn t-btn-primary"
          >
            <Save className="w-4 h-4" />
            <span className="t-num">Guardar semana {selectedWeek}</span>
          </button>
        }
      />

      {/* Horizontal Week Selector 1..16 */}
      <div
        role="tablist"
        aria-label="Seleccionar semana de estudio"
        className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5"
      >
        {Array.from({ length: 16 }, (_, i) => i + 1).map((w) => {
          const isSelected = selectedWeek === w;
          const isCurrent = currentAcademicWeek === w;
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
              className={`min-h-[44px] px-3.5 rounded-[10px] t-num text-[14px] font-medium inline-flex items-center gap-2 whitespace-nowrap cursor-pointer select-none border transition-colors focus-visible:outline-2 focus-visible:outline-[var(--action)] ${
                isSelected
                  ? 'bg-[var(--action)] text-[var(--action-ink)] border-[var(--action)]'
                  : isCurrent
                    ? 'bg-[var(--surface)] text-[var(--ink)] border-[var(--action)] hover:bg-[var(--surface-2)]'
                    : 'bg-[var(--surface)] text-[var(--muted)] border-[var(--line)] hover:text-[var(--ink)] hover:border-[var(--line-strong)]'
              }`}
            >
              <span>Semana {w}</span>
              {hasNotes && (
                <span
                  aria-hidden="true"
                  title="Con apuntes guardados"
                  className={`w-1.5 h-1.5 rounded-full ${
                    isSelected ? 'bg-[var(--action-ink)]' : 'bg-[var(--action)]'
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Free Week Celebration Card */}
      {isFreeWeek && (
        <FreeWeekCelebrationCard
          week={selectedWeek}
          onNavigateGym={() => onNavigateTab?.('gym')}
          onNavigateKanban={() => onNavigateTab?.('kanban')}
        />
      )}

      {/* Main 2-Column Clean Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left Column: Active Recall, Mood & Concept Tags */}
        <section className="t-card p-6 space-y-6">
          <div className="space-y-3">
            <div>
              <h3 className="text-lg font-semibold text-[var(--ink)]">
                Resumen con tus palabras
              </h3>
              <p className="text-sm text-[var(--muted)] mt-1">
                ¿Qué entendiste de verdad en la semana{' '}
                <span className="t-num">{selectedWeek}</span> sin mirar tus
                apuntes?
              </p>
            </div>

            <textarea
              id={`${uid}-learnings`}
              aria-label={`Resumen de aprendizaje de la semana ${selectedWeek}`}
              rows={6}
              value={learnings}
              onChange={(e) => updatePatch({ learnings: e.target.value })}
              placeholder="Ej. Esta semana por fin entendí cómo se reparten los datos con sharding en MongoDB y cuándo conviene frente a replicación..."
              className="t-input min-h-[160px] resize-y"
            />
          </div>

          {/* Weekly Mood Selector */}
          <div className="border-t border-[var(--line)] pt-5 space-y-3">
            <div>
              <span className="t-label mb-0">
                ¿Cómo te sentiste esta semana?
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {MOOD_OPTIONS.map(({ id, label, Icon }) => {
                const isSelected = mood === id;
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => updatePatch({ mood: id })}
                    className={`min-h-[44px] px-3.5 py-2.5 rounded-[12px] border text-sm font-medium flex items-center gap-2.5 cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-[var(--action)] ${
                      isSelected
                        ? 'bg-[color-mix(in_oklab,var(--action)_12%,var(--surface))] border-[var(--action)] text-[var(--ink)]'
                        : 'bg-[var(--surface-2)] border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)] hover:border-[var(--line-strong)]'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isSelected
                          ? 'text-[var(--action)]'
                          : 'text-[var(--muted)]'
                      }`}
                    />
                    <span className="truncate">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Key Concepts (#concepto) */}
          <div className="border-t border-[var(--line)] pt-5 space-y-3">
            <label htmlFor={`${uid}-concept`} className="t-label mb-0">
              Conceptos clave que recuerdas
            </label>

            {keyConcepts.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {keyConcepts.map((concept) => {
                  const displayConcept = concept.replace(/^#+/, '').trim();
                  return (
                    <span
                      key={concept}
                      className="t-badge max-w-full pl-3.5 pr-0 py-0 min-h-[44px] text-[var(--ink)] bg-[var(--surface-2)] border-[var(--line-strong)]"
                    >
                      <span className="min-w-0 whitespace-normal break-words py-2 leading-snug">#{displayConcept}</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteConcept(concept)}
                        className="w-11 h-11 min-w-[44px] min-h-[44px] shrink-0 rounded-full inline-flex items-center justify-center text-[var(--muted)] hover:text-[var(--danger)] hover:bg-[var(--surface)] transition-colors cursor-pointer"
                        aria-label={`Quitar concepto ${displayConcept}`}
                        title="Quitar concepto"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            <form
              onSubmit={handleAddConcept}
              className="flex flex-col sm:flex-row gap-2.5"
            >
              <input
                id={`${uid}-concept`}
                type="text"
                placeholder="Ej. Sharding con Hash Key"
                value={newConceptInput}
                onChange={(e) => setNewConceptInput(e.target.value)}
                className="t-input flex-1"
              />
              <button
                type="submit"
                className="t-btn t-btn-secondary shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Agregar concepto</span>
              </button>
            </form>
          </div>
        </section>

        {/* Right Column: YouTube, Study Sources & Physical Balance */}
        <section className="t-card p-6 space-y-6">
          {/* Sources Header & List */}
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <YoutubeIcon className="w-5 h-5 text-[#FF0000] shrink-0" />
                  <h3 className="text-lg font-semibold text-[var(--ink)]">
                    Videos de YouTube y lecturas
                  </h3>
                </div>
                <p className="text-sm text-[var(--muted)] mt-1">
                  Guarda tus videos, guías o apuntes para repasar rápido antes de
                  los exámenes.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowAddResource((v) => !v)}
                className="t-btn t-btn-secondary shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>{showAddResource ? 'Cerrar' : 'Guardar fuente'}</span>
              </button>
            </div>

            {/* Expandable Clean Form (no nested card box) */}
            {showAddResource && (
              <form
                onSubmit={handleAddResource}
                className="border-y border-[var(--line)] py-4 space-y-3.5"
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label htmlFor={`${uid}-res-title`} className="t-label">
                      Título del video o lectura
                    </label>
                    <input
                      id={`${uid}-res-title`}
                      type="text"
                      placeholder="Ej. Sharding en MongoDB explicado en 10 min"
                      value={newResTitle}
                      onChange={(e) => setNewResTitle(e.target.value)}
                      className="t-input"
                    />
                  </div>

                  <div>
                    <label htmlFor={`${uid}-res-type`} className="t-label">
                      Formato
                    </label>
                    <select
                      id={`${uid}-res-type`}
                      value={newResType}
                      onChange={(e) =>
                        setNewResType(e.target.value as ResourceType)
                      }
                      className="t-input cursor-pointer"
                    >
                      <option value="youtube">YouTube</option>
                      <option value="documentacion">Documentación</option>
                      <option value="articulo">Artículo / Blog</option>
                      <option value="libro">Libro / PDF</option>
                      <option value="texto">Apunte propio</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor={`${uid}-res-url`} className="t-label">
                    Enlace (opcional)
                  </label>
                  <input
                    id={`${uid}-res-url`}
                    type="url"
                    placeholder="https://www.youtube.com/watch?v=... o https://..."
                    value={newResUrl}
                    onChange={(e) => setNewResUrl(e.target.value)}
                    className="t-input"
                  />
                </div>

                <div>
                  <label htmlFor={`${uid}-res-notes`} className="t-label">
                    Minuto clave o idea principal
                  </label>
                  <input
                    id={`${uid}-res-notes`}
                    type="text"
                    placeholder="Ej. En el minuto 04:20 compara réplicas vs shards"
                    value={newResNotes}
                    onChange={(e) => setNewResNotes(e.target.value)}
                    className="t-input"
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAddResource(false)}
                    className="t-btn t-btn-ghost"
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="t-btn t-btn-primary">
                    Agregar a la semana
                  </button>
                </div>
              </form>
            )}

            {/* Resources .t-row list */}
            {resources.length === 0 ? (
              <p className="text-sm text-[var(--muted)] py-2">
                Todavía no guardaste videos ni lecturas en la semana{' '}
                <span className="t-num">{selectedWeek}</span>.
              </p>
            ) : (
              <div>
                {resources.map((res) => {
                  const isYouTube =
                    res.type === 'youtube' ||
                    Boolean(
                      res.url &&
                        (res.url.includes('youtube.com') ||
                          res.url.includes('youtu.be'))
                    );
                  const normalizedResUrl = res.url
                    ? res.url.startsWith('http://') ||
                      res.url.startsWith('https://')
                      ? res.url
                      : `https://${res.url}`
                    : null;

                  return (
                    <div
                      key={res.id}
                      className="t-row flex items-start justify-between gap-3"
                    >
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <span className="mt-1 shrink-0">
                          {isYouTube ? (
                            <YoutubeIcon className="w-5 h-5 text-[#FF0000]" />
                          ) : res.type === 'documentacion' ||
                            res.type === 'libro' ? (
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
                              className="min-h-[44px] flex flex-col justify-center group focus-visible:outline-2 focus-visible:outline-[var(--action)] rounded-[8px] px-1 -mx-1"
                            >
                              <span className="text-[15px] font-medium text-[var(--ink)] group-hover:text-[var(--action)] leading-snug transition-colors">
                                {res.title}
                              </span>
                              <span className="flex flex-wrap items-center gap-2 mt-0.5 text-[13px] text-[var(--muted)]">
                                <span>{RESOURCE_TYPE_LABEL[res.type]}</span>
                                {res.notes && (
                                  <>
                                    <span aria-hidden="true">·</span>
                                    <span>{res.notes}</span>
                                  </>
                                )}
                              </span>
                            </a>
                          ) : (
                            <div className="min-h-[44px] flex flex-col justify-center">
                              <p className="text-[15px] font-medium text-[var(--ink)] leading-snug">
                                {res.title}
                              </p>
                              <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[13px] text-[var(--muted)]">
                                <span>{RESOURCE_TYPE_LABEL[res.type]}</span>
                                {res.notes && (
                                  <>
                                    <span aria-hidden="true">·</span>
                                    <span>{res.notes}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {normalizedResUrl && (
                          <a
                            href={normalizedResUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="t-btn t-btn-ghost t-btn-icon"
                            aria-label={`Abrir ${res.title}`}
                            title={
                              isYouTube ? 'Ver en YouTube' : 'Abrir recurso'
                            }
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}

                        <button
                          type="button"
                          onClick={() => handleDeleteResource(res.id)}
                          className="t-btn t-btn-ghost t-btn-icon hover:text-[var(--danger)]"
                          aria-label={`Eliminar fuente ${res.title}`}
                          title="Eliminar fuente"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Bottom Block: Physical Progress & Week Summary */}
          <div className="border-t border-[var(--line)] pt-5 space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Dumbbell className="w-4 h-4 text-[var(--gym)] shrink-0" />
                <h4 className="text-base font-semibold text-[var(--ink)]">
                  Progreso físico y balance semanal
                </h4>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="t-badge t-badge-gym t-num">
                  {totalGymSetsDone} / {totalGymSetsPlanned} series
                </span>
                <span className="t-badge t-num">
                  {deliveredCount} / {weekAssignments.length} entregas
                </span>
              </div>
            </div>

            <div>
              <label htmlFor={`${uid}-gym`} className="t-label">
                Notas de entrenamiento, descanso y energía
              </label>
              <textarea
                id={`${uid}-gym`}
                rows={3}
                value={gymReflection}
                onChange={(e) => updatePatch({ gymReflection: e.target.value })}
                placeholder="Ej. Subí carga en press banca, dormí mejor y llegué con buena energía al viernes..."
                className="t-input min-h-[104px] resize-y"
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
