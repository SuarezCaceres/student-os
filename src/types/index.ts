export type DayOfWeek = 'Lunes' | 'Martes' | 'Miércoles' | 'Jueves' | 'Viernes' | 'Sábado' | 'Domingo';

export type Category = 'universidad' | 'trabajo' | 'gym' | 'personal';

export type Priority = 'baja' | 'media' | 'alta';

export type KanbanStatus = 'todo' | 'in_progress' | 'done';

export interface KanbanItem {
  id: string;
  title: string;
  description?: string;
  status: KanbanStatus;
  category: Category;
  priority: Priority;
  dueDate?: string;
  createdAt: string;
}

export interface GymExercise {
  id: string;
  name: string;
  sets: number;
  reps: string;
  weightKg?: number;
  completedSets: boolean[];
  notes?: string;
}

export interface GymRoutine {
  id: string;
  name: string;
  dayOfWeek: DayOfWeek;
  tag: string;
  exercises: GymExercise[];
}

export interface CalendarBlock {
  id: string;
  day: DayOfWeek;
  startTime: string;
  endTime: string;
  title: string;
  category: Category;
  location?: string;
}

export type AssignmentType = 'tarea' | 'proyecto' | 'examen' | 'laboratorio';
export type AssignmentStatus = 'pendiente' | 'en_progreso' | 'entregado';

export interface UniversityAssignment {
  id: string;
  title: string;
  course: string;
  week: number;
  dueDate: string;
  status: AssignmentStatus;
  type: AssignmentType;
  weightPercentage?: number;
  notes?: string;
}

export interface AppState {
  studentName: string;
  career: string;
  currentAcademicWeek: number;
  streak: number;
  theme: 'dark' | 'light';
  kanbanItems: KanbanItem[];
  gymRoutines: GymRoutine[];
  calendarBlocks: CalendarBlock[];
  universityAssignments: UniversityAssignment[];
}
