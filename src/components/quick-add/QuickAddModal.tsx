import React, { useState, useEffect } from 'react';
import { 
  X, 
  GraduationCap, 
  Dumbbell, 
  KanbanSquare, 
  CalendarDays, 
  Check, 
  Sparkles,
  BookOpen
} from 'lucide-react';
import type { 
  AppState, 
  UniversityAssignment, 
  GymExercise, 
  KanbanItem, 
  CalendarBlock, 
  DayOfWeek, 
  Category, 
  Priority,
  AssignmentType,
  LearningResource,
  ResourceType
} from '../../types';
import { triggerConfetti } from '../../utils/confetti';

interface QuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: AppState;
  onAddAssignment: (assignment: UniversityAssignment) => void;
  onAddGymExercise: (day: DayOfWeek, exercise: GymExercise) => void;
  onAddKanbanItem: (item: KanbanItem) => void;
  onAddCalendarBlock: (block: CalendarBlock) => void;
  onAddLearningResource?: (resource: LearningResource, week?: number) => void;
  initialTab?: 'university' | 'gym' | 'kanban' | 'calendar' | 'learning';
}

const COMMON_COURSES = [
  'Ingeniería de Software II',
  'Bases de Datos Distribuidas',
  'Inteligencia Artificial',
  'Sistemas Operativos',
  'Arquitectura Cloud',
  'Cálculo Multivariable',
];

const DAYS: DayOfWeek[] = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export const QuickAddModal: React.FC<QuickAddModalProps> = ({
  isOpen,
  onClose,
  state,
  onAddAssignment,
  onAddGymExercise,
  onAddKanbanItem,
  onAddCalendarBlock,
  onAddLearningResource,
  initialTab = 'university',
}) => {
  const [activeTab, setActiveTab] = useState<'university' | 'gym' | 'kanban' | 'calendar' | 'learning'>(initialTab);

  // Sync tab if initialTab changes
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Form State: University Assignment
  const [uniTitle, setUniTitle] = useState('');
  const [uniCourse, setUniCourse] = useState(COMMON_COURSES[0]);
  const [uniWeek, setUniWeek] = useState(state.currentAcademicWeek);
  const [uniDueDate, setUniDueDate] = useState('');
  const [uniType, setUniType] = useState<AssignmentType>('tarea');
  const [uniWeight, setUniWeight] = useState<number>(15);

  // Form State: Gym Exercise
  const [gymDay, setGymDay] = useState<DayOfWeek>('Lunes');
  const [gymExerciseName, setGymExerciseName] = useState('');
  const [gymSets, setGymSets] = useState(4);
  const [gymReps] = useState('10-12 reps');
  const [gymWeight, setGymWeight] = useState<number | ''>(20);

  // Form State: Kanban
  const [kanbanTitle, setKanbanTitle] = useState('');
  const [kanbanCategory, setKanbanCategory] = useState<Category>('trabajo');
  const [kanbanPriority, setKanbanPriority] = useState<Priority>('alta');
  const [kanbanDueDate, setKanbanDueDate] = useState('');

  // Form State: Calendar
  const [calDay, setCalDay] = useState<DayOfWeek>('Lunes');
  const [calTitle, setCalTitle] = useState('');
  const [calStart, setCalStart] = useState('09:00');
  const [calEnd, setCalEnd] = useState('11:00');
  const [calCategory, setCalCategory] = useState<Category>('universidad');

  // Form State: Learning Resource
  const [resTitle, setResTitle] = useState('');
  const [resType, setResType] = useState<ResourceType>('youtube');
  const [resUrl, setResUrl] = useState('');
  const [resNotes, setResNotes] = useState('');
  const [resWeek, setResWeek] = useState(state.currentAcademicWeek);

  if (!isOpen) return null;

  // Handlers
  const handleSaveUni = (e: React.FormEvent) => {
    e.preventDefault();
    if (!uniTitle.trim()) return;

    const newAssignment: UniversityAssignment = {
      id: `uni-${Date.now()}`,
      title: uniTitle.trim(),
      course: uniCourse.trim(),
      week: Number(uniWeek),
      dueDate: uniDueDate || new Date().toISOString().split('T')[0],
      status: 'pendiente',
      type: uniType,
      weightPercentage: Number(uniWeight) || 10,
    };

    onAddAssignment(newAssignment);
    triggerConfetti();
    setUniTitle('');
    onClose();
  };

  const handleSaveGym = (e: React.FormEvent) => {
    e.preventDefault();
    if (!gymExerciseName.trim()) return;

    const newExercise: GymExercise = {
      id: `ex-${Date.now()}`,
      name: gymExerciseName.trim(),
      sets: Number(gymSets) || 3,
      reps: gymReps.trim() || '10 reps',
      weightKg: gymWeight ? Number(gymWeight) : undefined,
      completedSets: Array(Number(gymSets) || 3).fill(false),
    };

    onAddGymExercise(gymDay, newExercise);
    triggerConfetti();
    setGymExerciseName('');
    onClose();
  };

  const handleSaveKanban = (e: React.FormEvent) => {
    e.preventDefault();
    if (!kanbanTitle.trim()) return;

    const newItem: KanbanItem = {
      id: `k-${Date.now()}`,
      title: kanbanTitle.trim(),
      status: 'todo',
      category: kanbanCategory,
      priority: kanbanPriority,
      dueDate: kanbanDueDate || undefined,
      createdAt: new Date().toISOString().split('T')[0],
    };

    onAddKanbanItem(newItem);
    triggerConfetti();
    setKanbanTitle('');
    onClose();
  };

  const handleSaveCalendar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!calTitle.trim()) return;

    const newBlock: CalendarBlock = {
      id: `cb-${Date.now()}`,
      day: calDay,
      startTime: calStart,
      endTime: calEnd,
      title: calTitle.trim(),
      category: calCategory,
    };

    onAddCalendarBlock(newBlock);
    triggerConfetti();
    setCalTitle('');
    onClose();
  };

  const handleSaveLearning = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resTitle.trim()) return;

    const newRes: LearningResource = {
      id: `res-${Date.now()}`,
      title: resTitle.trim(),
      type: resType,
      url: resUrl.trim() || undefined,
      notes: resNotes.trim() || undefined,
    };

    if (onAddLearningResource) {
      onAddLearningResource(newRes, Number(resWeek) || state.currentAcademicWeek);
    }
    triggerConfetti();
    setResTitle('');
    setResUrl('');
    setResNotes('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md transition-opacity">
      <div 
        className="w-full max-w-lg bg-white dark:bg-[#111827] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 id="modal-title" className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Captura Rápida
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Añade información en pocos clics sin formularios complicados
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer min-w-[40px] min-h-[40px] flex items-center justify-center"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category Tabs (Frictionless navigation) */}
        <div className="grid grid-cols-5 p-2 gap-1 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
          <button
            onClick={() => setActiveTab('university')}
            className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl text-xs font-semibold transition-all cursor-pointer min-h-[44px] ${
              activeTab === 'university'
                ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200/80 dark:border-slate-700 font-bold'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <GraduationCap className="w-4 h-4 mb-0.5" />
            <span className="truncate text-[11px]">Uni</span>
          </button>

          <button
            onClick={() => setActiveTab('gym')}
            className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl text-xs font-semibold transition-all cursor-pointer min-h-[44px] ${
              activeTab === 'gym'
                ? 'bg-white dark:bg-slate-800 text-orange-600 dark:text-orange-400 shadow-sm border border-slate-200/80 dark:border-slate-700 font-bold'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Dumbbell className="w-4 h-4 mb-0.5" />
            <span className="truncate text-[11px]">Gym</span>
          </button>

          <button
            onClick={() => setActiveTab('kanban')}
            className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl text-xs font-semibold transition-all cursor-pointer min-h-[44px] ${
              activeTab === 'kanban'
                ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm border border-slate-200/80 dark:border-slate-700 font-bold'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <KanbanSquare className="w-4 h-4 mb-0.5" />
            <span className="truncate text-[11px]">Kanban</span>
          </button>

          <button
            onClick={() => setActiveTab('calendar')}
            className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl text-xs font-semibold transition-all cursor-pointer min-h-[44px] ${
              activeTab === 'calendar'
                ? 'bg-white dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 shadow-sm border border-slate-200/80 dark:border-slate-700 font-bold'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <CalendarDays className="w-4 h-4 mb-0.5" />
            <span className="truncate text-[11px]">Agenda</span>
          </button>

          <button
            onClick={() => setActiveTab('learning')}
            className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl text-xs font-semibold transition-all cursor-pointer min-h-[44px] ${
              activeTab === 'learning'
                ? 'bg-white dark:bg-slate-800 text-violet-600 dark:text-violet-400 shadow-sm border border-slate-200/80 dark:border-slate-700 font-bold'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-4 h-4 mb-0.5" />
            <span className="truncate text-[11px]">Aprender</span>
          </button>
        </div>

        {/* Tab 1: Formulario Universidad */}
        {activeTab === 'university' && (
          <form onSubmit={handleSaveUni} className="p-5 sm:p-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Título de la Tarea o Entrega *
              </label>
              <input
                type="text"
                required
                placeholder="Ej. Tarea 2: Árboles binarios y AVL"
                value={uniTitle}
                onChange={(e) => setUniTitle(e.target.value)}
                autoFocus
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Quick course chips */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Curso / Materia
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {COMMON_COURSES.slice(0, 4).map((c) => (
                  <button
                    type="button"
                    key={c}
                    onClick={() => setUniCourse(c)}
                    className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                      uniCourse === c
                        ? 'bg-indigo-50 dark:bg-indigo-950/80 border-indigo-300 dark:border-indigo-600 text-indigo-700 dark:text-indigo-300 font-bold'
                        : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={uniCourse}
                onChange={(e) => setUniCourse(e.target.value)}
                placeholder="O escribe otro curso..."
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Semana de Entrega (1-16)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={16}
                    value={uniWeek}
                    onChange={(e) => setUniWeek(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm"
                  />
                  <span className="text-xs text-slate-500 whitespace-nowrap">Sem. {uniWeek}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Tipo de Entrega
                </label>
                <select
                  value={uniType}
                  onChange={(e) => setUniType(e.target.value as AssignmentType)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm"
                >
                  <option value="tarea">📝 Tarea</option>
                  <option value="proyecto">🚀 Proyecto</option>
                  <option value="examen">🎯 Examen</option>
                  <option value="laboratorio">💻 Laboratorio</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Fecha Límite
                </label>
                <input
                  type="date"
                  value={uniDueDate}
                  onChange={(e) => setUniDueDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Peso Nota (%)
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={uniWeight}
                  onChange={(e) => setUniWeight(Number(e.target.value))}
                  placeholder="15%"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              Guardar Tarea Universitaria
            </button>
          </form>
        )}

        {/* Tab 2: Formulario Gym */}
        {activeTab === 'gym' && (
          <form onSubmit={handleSaveGym} className="p-5 sm:p-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Día de la Rutina
              </label>
              <div className="flex flex-wrap gap-1.5">
                {DAYS.map((d) => (
                  <button
                    type="button"
                    key={d}
                    onClick={() => setGymDay(d)}
                    className={`text-xs px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer ${
                      gymDay === d
                        ? 'bg-orange-50 dark:bg-orange-950/80 border-orange-300 dark:border-orange-600 text-orange-700 dark:text-orange-300 font-bold'
                        : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Nombre del Ejercicio *
              </label>
              <input
                type="text"
                required
                placeholder="Ej. Press Militar con Mancuernas"
                value={gymExerciseName}
                onChange={(e) => setGymExerciseName(e.target.value)}
                autoFocus
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Series
                </label>
                <input
                  type="number"
                  min={1}
                  max={8}
                  value={gymSets}
                  onChange={(e) => setGymSets(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Reps
                </label>
                <input
                  type="text"
                  value={gymReps}
                  readOnly
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Peso (kg)
                </label>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={gymWeight}
                  onChange={(e) => setGymWeight(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="24"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-sm shadow-lg shadow-orange-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              Añadir Ejercicio a {gymDay}
            </button>
          </form>
        )}

        {/* Tab 3: Formulario Kanban */}
        {activeTab === 'kanban' && (
          <form onSubmit={handleSaveKanban} className="p-5 sm:p-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Título del Trabajo / Tarea *
              </label>
              <input
                type="text"
                required
                placeholder="Ej. Revisar pull request del equipo"
                value={kanbanTitle}
                onChange={(e) => setKanbanTitle(e.target.value)}
                autoFocus
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Categoría
                </label>
                <select
                  value={kanbanCategory}
                  onChange={(e) => setKanbanCategory(e.target.value as Category)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm"
                >
                  <option value="trabajo">💼 Trabajo</option>
                  <option value="universidad">🎓 Universidad</option>
                  <option value="gym">🏋️ Gym</option>
                  <option value="personal">🌟 Personal</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Prioridad
                </label>
                <select
                  value={kanbanPriority}
                  onChange={(e) => setKanbanPriority(e.target.value as Priority)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm"
                >
                  <option value="alta">🔴 Alta</option>
                  <option value="media">🟡 Media</option>
                  <option value="baja">🟢 Baja</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Fecha Límite (Opcional)
              </label>
              <input
                type="date"
                value={kanbanDueDate}
                onChange={(e) => setKanbanDueDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              Crear Tarea en Kanban
            </button>
          </form>
        )}

        {/* Tab 4: Formulario Calendario */}
        {activeTab === 'calendar' && (
          <form onSubmit={handleSaveCalendar} className="p-5 sm:p-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Día de la Semana
              </label>
              <div className="flex flex-wrap gap-1.5">
                {DAYS.map((d) => (
                  <button
                    type="button"
                    key={d}
                    onClick={() => setCalDay(d)}
                    className={`text-xs px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer ${
                      calDay === d
                        ? 'bg-cyan-50 dark:bg-cyan-950/80 border-cyan-300 dark:border-cyan-600 text-cyan-700 dark:text-cyan-300 font-bold'
                        : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Actividad / Bloque *
              </label>
              <input
                type="text"
                required
                placeholder="Ej. Clase de Redes y Comunicaciones"
                value={calTitle}
                onChange={(e) => setCalTitle(e.target.value)}
                autoFocus
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Hora Inicio
                </label>
                <input
                  type="time"
                  value={calStart}
                  onChange={(e) => setCalStart(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Hora Fin
                </label>
                <input
                  type="time"
                  value={calEnd}
                  onChange={(e) => setCalEnd(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Categoría
              </label>
              <select
                value={calCategory}
                onChange={(e) => setCalCategory(e.target.value as Category)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm"
              >
                <option value="universidad">🎓 Universidad</option>
                <option value="gym">🏋️ Gym</option>
                <option value="trabajo">💼 Trabajo</option>
                <option value="personal">🌟 Personal / Ocio</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-sm shadow-lg shadow-cyan-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              Agendar en el Calendario
            </button>
          </form>
        )}

        {/* Tab 5: Aprendizaje (YouTube & Fuentes de Estudio) */}
        {activeTab === 'learning' && (
          <form onSubmit={handleSaveLearning} className="p-5 sm:p-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Título del recurso o video *
              </label>
              <input
                type="text"
                required
                placeholder="Ej. Curso de Docker & Microservicios o Síntesis de Algoritmos"
                value={resTitle}
                onChange={(e) => setResTitle(e.target.value)}
                autoFocus
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Tipo de Fuente
                </label>
                <select
                  value={resType}
                  onChange={(e) => setResType(e.target.value as ResourceType)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm"
                >
                  <option value="youtube">🎥 Video de YouTube</option>
                  <option value="documentacion">📖 Documentación</option>
                  <option value="articulo">📝 Artículo / Blog</option>
                  <option value="libro">📚 Libro / PDF</option>
                  <option value="texto">💡 Nota de Texto</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Semana Académica
                </label>
                <select
                  value={resWeek}
                  onChange={(e) => setResWeek(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm"
                >
                  {Array.from({ length: 16 }, (_, i) => i + 1).map((w) => (
                    <option key={w} value={w}>
                      Semana {w} {w === state.currentAcademicWeek ? '(Actual)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Enlace URL (YouTube o Web)
              </label>
              <input
                type="url"
                placeholder="https://www.youtube.com/watch?v=... o https://docs..."
                value={resUrl}
                onChange={(e) => setResUrl(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Nota clave o marca de tiempo
              </label>
              <input
                type="text"
                placeholder="Ej. En el minuto 12:30 explica sharding vs particionado..."
                value={resNotes}
                onChange={(e) => setResNotes(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-violet-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              Guardar en Aprendizaje Semanal
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
