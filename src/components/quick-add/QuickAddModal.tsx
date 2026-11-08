import React, { useState } from 'react';
import { Check } from 'lucide-react';
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
  ResourceType,
} from '../../types';
import { triggerConfetti } from '../../utils/confetti';
import { ModalShell } from '../common/ModalShell';
import { SegmentedControl } from '../common/SegmentedControl';
import type { SegmentOption } from '../common/SegmentedControl';

export type QuickAddTab = 'university' | 'gym' | 'kanban' | 'calendar' | 'learning';

export interface QuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: AppState;
  onAddAssignment: (assignment: UniversityAssignment) => void;
  onAddGymExercise: (day: DayOfWeek, exercise: GymExercise) => void;
  onAddKanbanItem: (item: KanbanItem) => void;
  onAddCalendarBlock: (block: CalendarBlock) => void;
  onAddLearningResource?: (resource: LearningResource, week?: number) => void;
  initialTab?: QuickAddTab;
}

const COMMON_COURSES = [
  'Ingeniería de Software II',
  'Bases de Datos Distribuidas',
  'Inteligencia Artificial',
  'Sistemas Operativos',
  'Arquitectura Cloud',
  'Cálculo Multivariable',
];

const DAYS: DayOfWeek[] = [
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
  'Domingo',
];

const TAB_OPTIONS: SegmentOption<QuickAddTab>[] = [
  { id: 'university', label: 'Uni' },
  { id: 'gym', label: 'Gym' },
  { id: 'kanban', label: 'Kanban' },
  { id: 'calendar', label: 'Horario' },
  { id: 'learning', label: 'Aprender' },
];

type QuickAddFormContentProps = Omit<QuickAddModalProps, 'isOpen'> & {
  initialTab: QuickAddTab;
};

const QuickAddFormContent: React.FC<QuickAddFormContentProps> = ({
  onClose,
  state,
  onAddAssignment,
  onAddGymExercise,
  onAddKanbanItem,
  onAddCalendarBlock,
  onAddLearningResource,
  initialTab,
}) => {
  const [activeTab, setActiveTab] = useState<QuickAddTab>(initialTab);

  // University Assignment Form
  const [uniTitle, setUniTitle] = useState('');
  const [uniCourse, setUniCourse] = useState(COMMON_COURSES[0]);
  const [uniWeek, setUniWeek] = useState(state.currentAcademicWeek);
  const [uniDueDate, setUniDueDate] = useState('');
  const [uniType, setUniType] = useState<AssignmentType>('tarea');
  const [uniWeight, setUniWeight] = useState<number>(15);

  // Gym Exercise Form
  const [gymDay, setGymDay] = useState<DayOfWeek>('Lunes');
  const [gymExerciseName, setGymExerciseName] = useState('');
  const [gymSets, setGymSets] = useState(4);
  const [gymReps, setGymReps] = useState('10-12 reps');
  const [gymWeight, setGymWeight] = useState<number | ''>(20);

  // Kanban Task Form
  const [kanbanTitle, setKanbanTitle] = useState('');
  const [kanbanCategory, setKanbanCategory] = useState<Category>('trabajo');
  const [kanbanPriority, setKanbanPriority] = useState<Priority>('alta');
  const [kanbanDueDate, setKanbanDueDate] = useState('');

  // Calendar Block Form
  const [calDay, setCalDay] = useState<DayOfWeek>('Lunes');
  const [calTitle, setCalTitle] = useState('');
  const [calStart, setCalStart] = useState('09:00');
  const [calEnd, setCalEnd] = useState('11:00');
  const [calCategory, setCalCategory] = useState<Category>('universidad');

  // Learning Resource Form
  const [resTitle, setResTitle] = useState('');
  const [resType, setResType] = useState<ResourceType>('youtube');
  const [resUrl, setResUrl] = useState('');
  const [resNotes, setResNotes] = useState('');
  const [resWeek, setResWeek] = useState(state.currentAcademicWeek);

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

    const setsCount = Math.max(1, Number(gymSets) || 3);
    const newExercise: GymExercise = {
      id: `ex-${Date.now()}`,
      name: gymExerciseName.trim(),
      sets: setsCount,
      reps: gymReps.trim() || '10 reps',
      weightKg: gymWeight !== '' ? Number(gymWeight) : undefined,
      completedSets: Array(setsCount).fill(false),
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
    <div className="space-y-5">
      <SegmentedControl
        options={TAB_OPTIONS}
        value={activeTab}
        onChange={setActiveTab}
        ariaLabel="Categoría para agregar"
        fullWidth
        size="sm"
      />

      {/* Tab 1: Universidad */}
      {activeTab === 'university' && (
        <form onSubmit={handleSaveUni} className="space-y-4">
          <div>
            <label htmlFor="qa-uni-title" className="t-label">
              Título de la entrega
            </label>
            <input
              id="qa-uni-title"
              type="text"
              required
              placeholder="Ej. Laboratorio 3: Árboles AVL"
              value={uniTitle}
              onChange={(e) => setUniTitle(e.target.value)}
              autoFocus
              className="t-input"
            />
          </div>

          <div>
            <label htmlFor="qa-uni-course" className="t-label">
              Curso o materia
            </label>
            <div className="flex flex-wrap gap-2 mb-2.5">
              {COMMON_COURSES.slice(0, 4).map((course) => {
                const isSelected = uniCourse === course;
                return (
                  <button
                    type="button"
                    key={course}
                    onClick={() => setUniCourse(course)}
                    className={`min-h-[44px] px-3 rounded-[10px] text-[13px] font-medium border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[color-mix(in_oklab,var(--action)_14%,transparent)] border-[var(--action)] text-[var(--action)]'
                        : 'bg-[var(--surface-2)] border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)] hover:border-[var(--line-strong)]'
                    }`}
                  >
                    {course}
                  </button>
                );
              })}
            </div>
            <input
              id="qa-uni-course"
              type="text"
              value={uniCourse}
              onChange={(e) => setUniCourse(e.target.value)}
              placeholder="O escribe otro curso..."
              className="t-input"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label htmlFor="qa-uni-week" className="t-label">
                Semana académica (1–16)
              </label>
              <input
                id="qa-uni-week"
                type="number"
                min={1}
                max={16}
                value={uniWeek}
                onChange={(e) => setUniWeek(Number(e.target.value))}
                className="t-input t-num"
              />
            </div>

            <div>
              <label htmlFor="qa-uni-type" className="t-label">
                Tipo de evaluación
              </label>
              <select
                id="qa-uni-type"
                value={uniType}
                onChange={(e) => setUniType(e.target.value as AssignmentType)}
                className="t-input"
              >
                <option value="tarea">Tarea</option>
                <option value="proyecto">Proyecto</option>
                <option value="examen">Examen</option>
                <option value="laboratorio">Laboratorio</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label htmlFor="qa-uni-date" className="t-label">
                Fecha de entrega
              </label>
              <input
                id="qa-uni-date"
                type="date"
                value={uniDueDate}
                onChange={(e) => setUniDueDate(e.target.value)}
                className="t-input t-num"
              />
            </div>

            <div>
              <label htmlFor="qa-uni-weight" className="t-label">
                Peso en la nota (%)
              </label>
              <input
                id="qa-uni-weight"
                type="number"
                min={1}
                max={100}
                value={uniWeight}
                onChange={(e) => setUniWeight(Number(e.target.value))}
                placeholder="15"
                className="t-input t-num"
              />
            </div>
          </div>

          <button type="submit" className="t-btn t-btn-primary w-full mt-2">
            <Check className="w-4 h-4" />
            <span>Guardar entrega</span>
          </button>
        </form>
      )}

      {/* Tab 2: Gym */}
      {activeTab === 'gym' && (
        <form onSubmit={handleSaveGym} className="space-y-4">
          <div>
            <span className="t-label">Día de entrenamiento</span>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((day) => {
                const isSelected = gymDay === day;
                return (
                  <button
                    type="button"
                    key={day}
                    onClick={() => setGymDay(day)}
                    className={`min-h-[44px] px-3 rounded-[10px] text-[13px] font-medium border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[color-mix(in_oklab,var(--action)_14%,transparent)] border-[var(--action)] text-[var(--action)]'
                        : 'bg-[var(--surface-2)] border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)] hover:border-[var(--line-strong)]'
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label htmlFor="qa-gym-name" className="t-label">
              Nombre del ejercicio
            </label>
            <input
              id="qa-gym-name"
              type="text"
              required
              placeholder="Ej. Press militar con mancuernas"
              value={gymExerciseName}
              onChange={(e) => setGymExerciseName(e.target.value)}
              autoFocus
              className="t-input"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label htmlFor="qa-gym-sets" className="t-label">
                Series
              </label>
              <input
                id="qa-gym-sets"
                type="number"
                min={1}
                max={8}
                value={gymSets}
                onChange={(e) => setGymSets(Number(e.target.value))}
                className="t-input t-num"
              />
            </div>

            <div>
              <label htmlFor="qa-gym-reps" className="t-label">
                Repeticiones
              </label>
              <input
                id="qa-gym-reps"
                type="text"
                value={gymReps}
                onChange={(e) => setGymReps(e.target.value)}
                placeholder="10-12 reps"
                className="t-input t-num"
              />
            </div>

            <div>
              <label htmlFor="qa-gym-weight" className="t-label">
                Peso (kg)
              </label>
              <input
                id="qa-gym-weight"
                type="number"
                min={0}
                step={0.5}
                value={gymWeight}
                onChange={(e) => setGymWeight(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="24"
                className="t-input t-num"
              />
            </div>
          </div>

          <button type="submit" className="t-btn t-btn-primary w-full mt-2">
            <Check className="w-4 h-4" />
            <span>Guardar ejercicio</span>
          </button>
        </form>
      )}

      {/* Tab 3: Kanban */}
      {activeTab === 'kanban' && (
        <form onSubmit={handleSaveKanban} className="space-y-4">
          <div>
            <label htmlFor="qa-kanban-title" className="t-label">
              Qué necesitas hacer
            </label>
            <input
              id="qa-kanban-title"
              type="text"
              required
              placeholder="Ej. Revisar pull request del proyecto"
              value={kanbanTitle}
              onChange={(e) => setKanbanTitle(e.target.value)}
              autoFocus
              className="t-input"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label htmlFor="qa-kanban-category" className="t-label">
                Área
              </label>
              <select
                id="qa-kanban-category"
                value={kanbanCategory}
                onChange={(e) => setKanbanCategory(e.target.value as Category)}
                className="t-input"
              >
                <option value="trabajo">Trabajo</option>
                <option value="universidad">Universidad</option>
                <option value="gym">Gym</option>
                <option value="personal">Personal</option>
              </select>
            </div>

            <div>
              <label htmlFor="qa-kanban-priority" className="t-label">
                Prioridad
              </label>
              <select
                id="qa-kanban-priority"
                value={kanbanPriority}
                onChange={(e) => setKanbanPriority(e.target.value as Priority)}
                className="t-input"
              >
                <option value="alta">Alta</option>
                <option value="media">Media</option>
                <option value="baja">Baja</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="qa-kanban-date" className="t-label">
              Fecha objetivo (opcional)
            </label>
            <input
              id="qa-kanban-date"
              type="date"
              value={kanbanDueDate}
              onChange={(e) => setKanbanDueDate(e.target.value)}
              className="t-input t-num"
            />
          </div>

          <button type="submit" className="t-btn t-btn-primary w-full mt-2">
            <Check className="w-4 h-4" />
            <span>Crear tarea</span>
          </button>
        </form>
      )}

      {/* Tab 4: Horario */}
      {activeTab === 'calendar' && (
        <form onSubmit={handleSaveCalendar} className="space-y-4">
          <div>
            <span className="t-label">Día de la semana</span>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((day) => {
                const isSelected = calDay === day;
                return (
                  <button
                    type="button"
                    key={day}
                    onClick={() => setCalDay(day)}
                    className={`min-h-[44px] px-3 rounded-[10px] text-[13px] font-medium border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[color-mix(in_oklab,var(--action)_14%,transparent)] border-[var(--action)] text-[var(--action)]'
                        : 'bg-[var(--surface-2)] border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)] hover:border-[var(--line-strong)]'
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label htmlFor="qa-cal-title" className="t-label">
              Clase o actividad
            </label>
            <input
              id="qa-cal-title"
              type="text"
              required
              placeholder="Ej. Clase de Redes y Comunicaciones"
              value={calTitle}
              onChange={(e) => setCalTitle(e.target.value)}
              autoFocus
              className="t-input"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label htmlFor="qa-cal-start" className="t-label">
                Hora de inicio
              </label>
              <input
                id="qa-cal-start"
                type="time"
                value={calStart}
                onChange={(e) => setCalStart(e.target.value)}
                className="t-input t-num"
              />
            </div>

            <div>
              <label htmlFor="qa-cal-end" className="t-label">
                Hora de fin
              </label>
              <input
                id="qa-cal-end"
                type="time"
                value={calEnd}
                onChange={(e) => setCalEnd(e.target.value)}
                className="t-input t-num"
              />
            </div>
          </div>

          <div>
            <label htmlFor="qa-cal-category" className="t-label">
              Área
            </label>
            <select
              id="qa-cal-category"
              value={calCategory}
              onChange={(e) => setCalCategory(e.target.value as Category)}
              className="t-input"
            >
              <option value="universidad">Universidad</option>
              <option value="gym">Gym</option>
              <option value="trabajo">Trabajo</option>
              <option value="personal">Personal</option>
            </select>
          </div>

          <button type="submit" className="t-btn t-btn-primary w-full mt-2">
            <Check className="w-4 h-4" />
            <span>Agendar bloque</span>
          </button>
        </form>
      )}

      {/* Tab 5: Aprender */}
      {activeTab === 'learning' && (
        <form onSubmit={handleSaveLearning} className="space-y-4">
          <div>
            <label htmlFor="qa-res-title" className="t-label">
              Título del video o apunte
            </label>
            <input
              id="qa-res-title"
              type="text"
              required
              placeholder="Ej. Sharding en MongoDB explicado en 10 min"
              value={resTitle}
              onChange={(e) => setResTitle(e.target.value)}
              autoFocus
              className="t-input"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label htmlFor="qa-res-type" className="t-label">
                Tipo de recurso
              </label>
              <select
                id="qa-res-type"
                value={resType}
                onChange={(e) => setResType(e.target.value as ResourceType)}
                className="t-input"
              >
                <option value="youtube">Video de YouTube</option>
                <option value="documentacion">Documentación</option>
                <option value="articulo">Artículo o blog</option>
                <option value="libro">Libro o PDF</option>
                <option value="texto">Nota rápida</option>
              </select>
            </div>

            <div>
              <label htmlFor="qa-res-week" className="t-label">
                Semana académica
              </label>
              <select
                id="qa-res-week"
                value={resWeek}
                onChange={(e) => setResWeek(Number(e.target.value))}
                className="t-input t-num"
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
            <label htmlFor="qa-res-url" className="t-label">
              Enlace (opcional)
            </label>
            <input
              id="qa-res-url"
              type="url"
              placeholder="https://www.youtube.com/watch?v=..."
              value={resUrl}
              onChange={(e) => setResUrl(e.target.value)}
              className="t-input"
            />
          </div>

          <div>
            <label htmlFor="qa-res-notes" className="t-label">
              Idea clave o minuto del video (opcional)
            </label>
            <textarea
              id="qa-res-notes"
              rows={2}
              placeholder="Ej. En el minuto 12:30 compara particionado vs replicación"
              value={resNotes}
              onChange={(e) => setResNotes(e.target.value)}
              className="t-input min-h-[76px] resize-y"
            />
          </div>

          <button type="submit" className="t-btn t-btn-primary w-full mt-2">
            <Check className="w-4 h-4" />
            <span>Guardar recurso</span>
          </button>
        </form>
      )}
    </div>
  );
};

export const QuickAddModal: React.FC<QuickAddModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'university',
  ...formProps
}) => {
  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="Agregar rápido"
      subtitle="Guarda tareas, rutinas o apuntes en segundos"
      maxWidth="lg"
    >
      {isOpen && (
        <QuickAddFormContent
          key={initialTab}
          initialTab={initialTab}
          onClose={onClose}
          {...formProps}
        />
      )}
    </ModalShell>
  );
};
