export type DayOfWeek = 'Lunes' | 'Martes' | 'Miércoles' | 'Jueves' | 'Viernes' | 'Sábado' | 'Domingo';

export type Category = 'universidad' | 'trabajo' | 'gym' | 'personal';

export type Priority = 'baja' | 'media' | 'alta';

export type KanbanStatus = 'todo' | 'in_progress' | 'done';

export interface KanbanChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface KanbanItem {
  id: string;
  title: string;
  description?: string;
  status: KanbanStatus;
  category: Category;
  priority: Priority;
  dueDate?: string;
  createdAt: string;
  checklist?: KanbanChecklistItem[];
  tags?: string[];
}

export interface ExerciseHistoryEntry {
  date: string;
  weightKg: number;
  reps: string;
}

export interface ExerciseTechniqueGuide {
  videoUrl?: string;
  posterUrl?: string;
  muscleGroups: string[];
  setupCues: string[];
  executionCues: string[];
  breathingCues: string;
  commonMistakes: string[];
}

export interface GymExercise {
  id: string;
  name: string;
  sets: number;
  reps: string;
  weightKg?: number;
  completedSets: boolean[];
  notes?: string;
  personalRecordKg?: number;
  restSeconds?: number;
  history?: ExerciseHistoryEntry[];
  technique?: ExerciseTechniqueGuide;
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

export interface RubricCriterion {
  id: string;
  label: string;
  done: boolean;
}

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
  gradeObtained?: number;
  maxGrade?: number;
  submissionUrl?: string;
  rubricCriteria?: RubricCriterion[];
}

export interface DailyHabits {
  waterMl: number;
  targetWaterMl: number;
  sleepHours: number;
  targetSleepHours: number;
  pomodorosDone: number;
  targetPomodoros: number;
}

export type ResourceType = 'youtube' | 'articulo' | 'documentacion' | 'libro' | 'texto';

export interface LearningResource {
  id: string;
  title: string;
  url?: string;
  type: ResourceType;
  notes?: string;
}

export type ReflectionMood = 'increible' | 'productivo' | 'cansado' | 'despejado';

export interface WeeklyReflection {
  week: number;
  learnings: string;
  keyConcepts: string[];
  resources: LearningResource[];
  gymReflection?: string;
  mood?: ReflectionMood;
  updatedAt: string;
}

export interface AppState {
  studentName: string;
  career: string;
  currentAcademicWeek: number;
  streak: number;
  theme: 'dark' | 'light';
  dailyHabits?: DailyHabits;
  weeklyReflections?: { [week: number]: WeeklyReflection };
  kanbanItems: KanbanItem[];
  gymRoutines: GymRoutine[];
  calendarBlocks: CalendarBlock[];
  universityAssignments: UniversityAssignment[];
}
