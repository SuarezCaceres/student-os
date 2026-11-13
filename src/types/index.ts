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
  thumbnailUrl?: string;
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
  googleEventId?: string;
  googleHtmlLink?: string;
  reminderMinutes?: number[];
  syncWithGoogle?: boolean;
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

export type ResourceType = 'youtube' | 'tiktok' | 'instagram' | 'articulo' | 'documentacion' | 'libro' | 'texto';

export type ResourceCategory =
  | 'ia_claude'
  | 'ia_gemini'
  | 'skills'
  | 'video_gen'
  | 'cursos'
  | 'conferencias'
  | 'reels_instagram'
  | 'general';

export interface LearningResource {
  id: string;
  title: string;
  url?: string;
  type: ResourceType;
  category?: ResourceCategory;
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

export type GymType = 'smart_fit' | 'utp' | 'barrio' | 'casa' | 'otro';
export type FitnessGoal = 'hipertrofia' | 'fuerza' | 'perdida_grasa' | 'salud';
export type FitnessExperience = 'principiante' | 'intermedio' | 'avanzado';
export type BmiCategory = 'bajo_peso' | 'normal' | 'sobrepeso' | 'obesidad';

export interface WeightHistoryEntry {
  date: string; // YYYY-MM-DD
  weightKg: number;
  bmi: number;
}

export type MissReasonId =
  | 'estudios_examenes'
  | 'cansancio_sueno'
  | 'trabajo_horarios'
  | 'salud_lesion'
  | 'tiempo_transporte'
  | 'otro';

export type GymSessionStatus =
  | 'idle'
  | 'in_progress'
  | 'completed'
  | 'missed'
  | 'rescheduled';

export interface GymAttendanceLog {
  id: string;
  date: string; // Local wall-clock YYYY-MM-DD
  dayOfWeek: DayOfWeek;
  routineId: string;
  routineName: string;
  status: GymSessionStatus;
  startedAt?: string;
  finishedAt?: string;
  durationMinutes?: number;
  missReason?: MissReasonId;
  missNote?: string;
  encouragementMessage?: string;
  rescheduledToDay?: DayOfWeek;
  rescheduledToDate?: string;
  rescheduledSlotStart?: string;
  rescheduledSlotEnd?: string;
  rescheduledCalendarBlockId?: string;
  googleEventId?: string;
  reminderMinutes?: number[];
  streakProtected?: boolean;
}

export interface UserGymProfile {
  gymType: GymType;
  customGymName?: string;
  trainingDaysCount: number; // 2 | 3 | 4 | 5 | 6
  selectedDays: DayOfWeek[];
  goal: FitnessGoal;
  experience: FitnessExperience;
  heightCm: number;
  weightKg: number;
  targetWeightKg?: number;
  bmi: number;
  bmiCategory: BmiCategory;
  reminderMinutesBefore?: number[];
  configuredAt: string;
}

export interface AppState {
  studentName: string;
  career: string;
  currentAcademicWeek: number;
  streak: number;
  theme: 'dark' | 'light';
  dailyHabits?: DailyHabits;
  gymProfile?: UserGymProfile;
  weightHistory?: WeightHistoryEntry[];
  gymAttendanceLogs?: GymAttendanceLog[];
  weeklyReflections?: { [week: number]: WeeklyReflection };
  kanbanItems: KanbanItem[];
  gymRoutines: GymRoutine[];
  calendarBlocks: CalendarBlock[];
  universityAssignments: UniversityAssignment[];
}
