import React, { useState, useEffect } from 'react';
import { 
  BookOpen, 
  FileText, 
  ExternalLink, 
  Plus, 
  Trash2, 
  Save, 
  Sparkles, 
  Dumbbell, 
  Flame, 
  Zap, 
  Palmtree, 
  BatteryMedium,
  Tag
} from 'lucide-react';
import { YoutubeIcon } from '../common/YoutubeIcon';
import type { 
  WeeklyReflection, 
  LearningResource, 
  ResourceType, 
  ReflectionMood, 
  UniversityAssignment, 
  GymRoutine 
} from '../../types';
import type { NavTab } from '../layout/Navbar';
import { triggerConfetti } from '../../utils/confetti';
import { FreeWeekCelebrationCard } from './FreeWeekCelebrationCard';

interface LearningViewProps {
  currentAcademicWeek: number;
  assignments: UniversityAssignment[];
  gymRoutines: GymRoutine[];
  weeklyReflections?: { [week: number]: WeeklyReflection };
  onSaveReflection: (reflection: WeeklyReflection) => void;
  onNavigateTab?: (tab: NavTab) => void;
}

export const LearningView: React.FC<LearningViewProps> = ({
  currentAcademicWeek,
  assignments,
  gymRoutines,
  weeklyReflections = {},
  onSaveReflection,
  onNavigateTab,
}) => {
  const [selectedWeek, setSelectedWeek] = useState<number>(currentAcademicWeek);

  const [learnings, setLearnings] = useState('');
  const [keyConcepts, setKeyConcepts] = useState<string[]>([]);
  const [newConceptInput, setNewConceptInput] = useState('');
  const [resources, setResources] = useState<LearningResource[]>([]);
  const [gymReflection, setGymReflection] = useState('');
  const [mood, setMood] = useState<ReflectionMood>('productivo');

  // Resource form state
  const [newResTitle, setNewResTitle] = useState('');
  const [newResUrl, setNewResUrl] = useState('');
  const [newResType, setNewResType] = useState<ResourceType>('youtube');
  const [newResNotes, setNewResNotes] = useState('');
  const [showAddResource, setShowAddResource] = useState(false);

  // Sync state when selectedWeek changes
  useEffect(() => {
    const current = weeklyReflections[selectedWeek];
    if (current) {
      setLearnings(current.learnings || '');
      setKeyConcepts(current.keyConcepts || []);
      setResources(current.resources || []);
      setGymReflection(current.gymReflection || '');
      setMood(current.mood || 'productivo');
    } else {
      setLearnings('');
      setKeyConcepts([]);
      setResources([]);
      setGymReflection('');
      setMood('productivo');
    }
  }, [selectedWeek, weeklyReflections]);

  // Check if selected week is free
  const weekAssignments = assignments.filter((a) => a.week === selectedWeek);
  const pendingWeekAssignments = weekAssignments.filter((a) => a.status !== 'entregado');
  const isFreeWeek = weekAssignments.length === 0 || pendingWeekAssignments.length === 0;

  // Key concepts handlers
  const handleAddConcept = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newConceptInput.trim()) return;
    if (!keyConcepts.includes(newConceptInput.trim())) {
      setKeyConcepts((prev) => [...prev, newConceptInput.trim()]);
    }
    setNewConceptInput('');
  };

  const handleDeleteConcept = (conceptToDelete: string) => {
    setKeyConcepts((prev) => prev.filter((c) => c !== conceptToDelete));
  };

  // Resources handlers
  const handleAddResource = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newResTitle.trim()) return;

    // Auto-detect YouTube URL
    let detectedType = newResType;
    if (newResUrl && (newResUrl.includes('youtube.com') || newResUrl.includes('youtu.be'))) {
      detectedType = 'youtube';
    }

    const newRes: LearningResource = {
      id: `res-${Date.now()}`,
      title: newResTitle.trim(),
      url: newResUrl.trim() || undefined,
      type: detectedType,
      notes: newResNotes.trim() || undefined,
    };

    setResources((prev) => [...prev, newRes]);
    setNewResTitle('');
    setNewResUrl('');
    setNewResNotes('');
    setShowAddResource(false);
  };

  const handleDeleteResource = (resId: string) => {
    setResources((prev) => prev.filter((r) => r.id !== resId));
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
    triggerConfetti();
  };

  // Gym summary calculations
  const totalGymSetsPlanned = gymRoutines.reduce((acc, r) => {
    return acc + r.exercises.reduce((exAcc, ex) => exAcc + ex.sets, 0);
  }, 0);

  const totalGymSetsDone = gymRoutines.reduce((acc, r) => {
    return acc + r.exercises.reduce((exAcc, ex) => exAcc + ex.completedSets.filter(Boolean).length, 0);
  }, 0);

  return (
    <div className="space-y-6">
      {/* Header & Week Selector */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-indigo-500" />
              Bitácora de Aprendizaje & Balance Semanal
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Consolida lo que realmente aprendiste, guarda tus fuentes (videos, textos) y evalúa tu semana
          </p>
        </div>

        {/* Save button */}
        <button
          onClick={handleSave}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-bold shadow-md shadow-indigo-600/30 transition-all cursor-pointer min-h-[44px]"
        >
          <Save className="w-4 h-4" />
          <span>Guardar Bitácora Sem. {selectedWeek}</span>
        </button>
      </div>

      {/* Week Selector Chips (1 to 16) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
        {Array.from({ length: 16 }, (_, i) => i + 1).map((w) => {
          const isSelected = selectedWeek === w;
          const isCurrent = currentAcademicWeek === w;
          const hasNotes = Boolean(weeklyReflections[w]?.learnings);

          return (
            <button
              key={w}
              type="button"
              onClick={() => setSelectedWeek(w)}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap min-h-[38px] flex items-center gap-1.5 ${
                isSelected
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25 scale-[1.02]'
                  : isCurrent
                  ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-300 dark:border-indigo-800'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
              }`}
            >
              <span>Semana {w}</span>
              {isCurrent && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" title="Semana Actual" />
              )}
              {hasNotes && !isSelected && (
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" title="Bitácora registrada" />
              )}
            </button>
          );
        })}
      </div>

      {/* Free Week Celebration Banner (if applicable) */}
      {isFreeWeek && (
        <FreeWeekCelebrationCard
          week={selectedWeek}
          onNavigateGym={() => onNavigateTab?.('gym')}
          onNavigateKanban={() => onNavigateTab?.('kanban')}
        />
      )}

      {/* Main Grid: Learning & Sources */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Col 1 & 2: Active Recall & Key Concepts */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Card: Active Recall Feynman */}
          <div className="rounded-3xl bg-white dark:bg-[#0f1523] border border-slate-200 dark:border-white/[0.08] p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/80">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/15 text-indigo-500 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                    ¿Qué has aprendido en la Semana {selectedWeek}?
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Explica con tus propias palabras qué entendiste de verdad (sin mirar apuntes)
                  </p>
                </div>
              </div>
            </div>

            <textarea
              rows={5}
              value={learnings}
              onChange={(e) => setLearnings(e.target.value)}
              placeholder="Ej: Esta semana comprendí cómo funciona la partición de bases de datos distribuidas y la diferencia entre concurrencia y paralelismo. En React practiqué hooks desacoplados..."
              className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-sm leading-relaxed text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none font-medium"
            />

            {/* Key Concepts Remembered (Active Recall Pills) */}
            <div className="space-y-2 pt-1">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Conceptos clave que recuerdas de memoria:
              </label>

              <div className="flex flex-wrap items-center gap-2">
                {keyConcepts.map((concept) => (
                  <span
                    key={concept}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 text-xs font-semibold"
                  >
                    <Tag className="w-3 h-3 text-indigo-500" />
                    <span>{concept}</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteConcept(concept)}
                      className="text-slate-400 hover:text-rose-500 ml-0.5"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>

              {/* Add concept input */}
              <form onSubmit={handleAddConcept} className="flex gap-2 pt-2">
                <input
                  type="text"
                  placeholder="+ Agregar concepto memorizado (ej. Sharding con Hash Key)..."
                  value={newConceptInput}
                  onChange={(e) => setNewConceptInput(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all cursor-pointer min-h-[36px]"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>

          {/* Card: Fuentes de Estudio & Links de YouTube */}
          <div className="rounded-3xl bg-white dark:bg-[#0f1523] border border-slate-200 dark:border-white/[0.08] p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/80">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-rose-500/15 text-rose-500 flex items-center justify-center">
                  <YoutubeIcon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                    Fuentes de Estudio & YouTube
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    ¿De dónde sacaste la información? Guarda videos, docs o notas para repasar
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowAddResource(!showAddResource)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold transition-all cursor-pointer min-h-[36px]"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Agregar Fuente</span>
              </button>
            </div>

            {/* Add Resource Form */}
            {showAddResource && (
              <form onSubmit={handleAddResource} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Título del recurso:
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. MongoDB Sharding en 10 minutos..."
                      value={newResTitle}
                      onChange={(e) => setNewResTitle(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Tipo:
                    </label>
                    <select
                      value={newResType}
                      onChange={(e) => setNewResType(e.target.value as ResourceType)}
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                    >
                      <option value="youtube">Video de YouTube</option>
                      <option value="documentacion">Documentación Oficial</option>
                      <option value="articulo">Artículo / Blog</option>
                      <option value="libro">Libro / PDF</option>
                      <option value="texto">Nota de Texto</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Enlace URL (YouTube o Web):
                  </label>
                  <input
                    type="url"
                    placeholder="https://www.youtube.com/watch?v=... o https://docs..."
                    value={newResUrl}
                    onChange={(e) => setNewResUrl(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Apunte o conclusión clave:
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. El minuto 4:20 explica la diferencia con réplicas..."
                    value={newResNotes}
                    onChange={(e) => setNewResNotes(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAddResource(false)}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer min-h-[36px]"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-sm cursor-pointer min-h-[36px]"
                  >
                    Guardar Fuente
                  </button>
                </div>
              </form>
            )}

            {/* List of Resources */}
            <div className="space-y-2.5">
              {resources.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400 italic">
                  Aún no has registrado fuentes o videos para esta semana.
                </div>
              ) : (
                resources.map((res) => {
                  const isYouTube = res.type === 'youtube' || (res.url && (res.url.includes('youtube') || res.url.includes('youtu.be')));

                  return (
                    <div
                      key={res.id}
                      className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                          isYouTube 
                            ? 'bg-rose-500/15 text-rose-500' 
                            : 'bg-indigo-500/15 text-indigo-500'
                        }`}>
                          {isYouTube ? <YoutubeIcon className="w-5 h-5" /> : <FileText className="w-4 h-4" />}
                        </div>

                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {res.title}
                          </h4>
                          {res.notes && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                              {res.notes}
                            </p>
                          )}
                          {res.url && (
                            <a
                              href={res.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline mt-1"
                            >
                              Abrir fuente
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteResource(res.id)}
                        className="p-2 text-slate-400 hover:text-rose-500 rounded-xl transition-colors shrink-0"
                        title="Eliminar recurso"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Col 3: Balance Gym & Mood */}
        <div className="space-y-6">
          
          {/* Card: Balance del Gym */}
          <div className="rounded-3xl bg-white dark:bg-[#0f1523] border border-slate-200 dark:border-white/[0.08] p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800/80">
              <div className="w-8 h-8 rounded-xl bg-orange-500/15 text-orange-500 flex items-center justify-center">
                <Dumbbell className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                  Avance en el Gimnasio
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Desempeño físico y recuperación
                </p>
              </div>
            </div>

            {/* Gym Metric Stats */}
            <div className="p-3.5 rounded-2xl bg-orange-50/40 dark:bg-orange-950/20 border border-orange-200/60 dark:border-orange-900/40 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider">
                  Cumplimiento de Series
                </span>
                <div className="text-xl font-black text-slate-900 dark:text-white">
                  {totalGymSetsDone} / {totalGymSetsPlanned} series
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-orange-500/20 text-orange-500 flex items-center justify-center">
                <Flame className="w-5 h-5 fill-orange-500" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                ¿Cómo te fue entrenando esta semana?
              </label>
              <textarea
                rows={3}
                value={gymReflection}
                onChange={(e) => setGymReflection(e.target.value)}
                placeholder="Ej. Me sentí fuerte en pecho y subí 2.5kg en sentadillas. Dormí bien y descansé adecuadamente entre series..."
                className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
              />
            </div>
          </div>

          {/* Card: Estado Mental & Energía */}
          <div className="rounded-3xl bg-white dark:bg-[#0f1523] border border-slate-200 dark:border-white/[0.08] p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800/80">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/15 text-cyan-500 flex items-center justify-center">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                  Energía de la Semana
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  ¿Cómo calificarías esta semana en general?
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'increible' as ReflectionMood, label: 'Imparable', icon: Flame, color: 'text-orange-500 border-orange-500 bg-orange-500/10' },
                { id: 'productivo' as ReflectionMood, label: 'Productivo', icon: Zap, color: 'text-indigo-500 border-indigo-500 bg-indigo-500/10' },
                { id: 'despejado' as ReflectionMood, label: 'En Calma / Libre', icon: Palmtree, color: 'text-emerald-500 border-emerald-500 bg-emerald-500/10' },
                { id: 'cansado' as ReflectionMood, label: 'Exigido', icon: BatteryMedium, color: 'text-amber-500 border-amber-500 bg-amber-500/10' },
              ].map((m) => {
                const Icon = m.icon;
                const isSelected = mood === m.id;

                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMood(m.id)}
                    className={`p-3 rounded-2xl border text-xs font-bold flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer min-h-[64px] ${
                      isSelected
                        ? `${m.color} ring-2 ring-indigo-500/30 shadow-sm`
                        : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Academic Summary for this week */}
          <div className="rounded-3xl bg-white dark:bg-[#0f1523] border border-slate-200 dark:border-white/[0.08] p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                Entregas Semana {selectedWeek}:
              </span>
              <span className="text-xs font-black text-slate-900 dark:text-white">
                {weekAssignments.length - pendingWeekAssignments.length} / {weekAssignments.length} entregadas
              </span>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
