import type { DayOfWeek } from '../../types';

export type GymType = 'smart_fit' | 'utp' | 'barrio' | 'casa' | 'otro';
export type FitnessGoal = 'hipertrofia' | 'fuerza' | 'perdida_grasa' | 'salud';
export type FitnessExperience = 'principiante' | 'intermedio' | 'avanzado';
export type BmiCategory = 'bajo_peso' | 'normal' | 'sobrepeso' | 'obesidad';

export interface WeightHistoryEntry {
  date: string; // YYYY-MM-DD
  weightKg: number;
  bmi: number;
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
  configuredAt: string;
}

export const calculateBmi = (weightKg: number, heightCm: number): number => {
  if (heightCm <= 0 || weightKg <= 0) return 0;
  const heightM = heightCm / 100;
  return Number((weightKg / (heightM * heightM)).toFixed(1));
};

export const getBmiCategory = (bmi: number): BmiCategory => {
  if (bmi < 18.5) return 'bajo_peso';
  if (bmi < 25.0) return 'normal';
  if (bmi < 30.0) return 'sobrepeso';
  return 'obesidad';
};

export const getBmiCategoryLabel = (category: BmiCategory): string => {
  switch (category) {
    case 'bajo_peso':
      return 'Bajo peso';
    case 'normal':
      return 'Peso normal';
    case 'sobrepeso':
      return 'Sobrepeso';
    case 'obesidad':
      return 'Obesidad';
  }
};

export const getFitnessGoalLabel = (goal: FitnessGoal): string => {
  switch (goal) {
    case 'hipertrofia':
      return 'Ganar músculo';
    case 'fuerza':
      return 'Fuerza máxima';
    case 'perdida_grasa':
      return 'Perder grasa';
    case 'salud':
      return 'Salud general';
  }
};

export const getGymTypeLabel = (gymType: GymType, customGymName?: string): string => {
  switch (gymType) {
    case 'smart_fit':
      return 'Smart Fit';
    case 'utp':
      return 'Gimnasio UTP / Universidad';
    case 'barrio':
      return 'Gimnasio de barrio';
    case 'casa':
      return 'Casa / Calistenia';
    case 'otro':
      return customGymName?.trim() || 'Otro gimnasio';
  }
};

export const getExperienceLabel = (experience: FitnessExperience): string => {
  switch (experience) {
    case 'principiante':
      return 'Principiante';
    case 'intermedio':
      return 'Intermedio';
    case 'avanzado':
      return 'Avanzado';
  }
};
