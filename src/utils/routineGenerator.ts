import type {
  DayOfWeek,
  GymExercise,
  GymRoutine,
  GymType,
  FitnessGoal,
  FitnessExperience,
  BmiCategory,
  WeightHistoryEntry,
  UserGymProfile,
} from '../types';

export type {
  GymType,
  FitnessGoal,
  FitnessExperience,
  BmiCategory,
  WeightHistoryEntry,
  UserGymProfile,
};

export interface GymCatalogOption {
  id: GymType;
  name: string;
  shortLabel: string;
  equipmentNote: string;
}

export interface GoalCatalogOption {
  id: FitnessGoal;
  label: string;
  shortLabel: string;
  repsRange: string;
  restSeconds: number;
  summary: string;
}

export const GYM_CATALOG: GymCatalogOption[] = [
  {
    id: 'smart_fit',
    name: 'Smart Fit',
    shortLabel: 'Smart Fit',
    equipmentNote: 'Máquinas guiadas, poleas duales, mancuernas y racks.',
  },
  {
    id: 'utp',
    name: 'Gimnasio UTP / Universidad',
    shortLabel: 'Gimnasio UTP',
    equipmentNote: 'Barras olímpicas, discos, bancos y equipo funcional universitario.',
  },
  {
    id: 'barrio',
    name: 'Gimnasio Comercial / de Barrio',
    shortLabel: 'Gimnasio de barrio',
    equipmentNote: 'Pesos libres, barras, bancos clásicos y poleas esenciales.',
  },
  {
    id: 'casa',
    name: 'Casa / Calistenia',
    shortLabel: 'Casa / Calistenia',
    equipmentNote: 'Peso corporal, barra de dominadas, mancuernas o bandas.',
  },
  {
    id: 'otro',
    name: 'Otro gimnasio',
    shortLabel: 'Personalizado',
    equipmentNote: 'Ingresa el nombre de tu sede habitual.',
  },
];

export const GOAL_CATALOG: GoalCatalogOption[] = [
  {
    id: 'hipertrofia',
    label: 'Ganar músculo (Hipertrofia)',
    shortLabel: 'Ganar músculo',
    repsRange: '8-12 reps',
    restSeconds: 90,
    summary: 'Volumen óptimo por grupo muscular y tensión mecánica controlada.',
  },
  {
    id: 'fuerza',
    label: 'Fuerza máxima (Powerlifting)',
    shortLabel: 'Fuerza máxima',
    repsRange: '4-6 reps',
    restSeconds: 120,
    summary: 'Series pesadas en ejercicios compuestos y descansos largos.',
  },
  {
    id: 'perdida_grasa',
    label: 'Perder grasa / Definición',
    shortLabel: 'Perder grasa',
    repsRange: '12-15 reps',
    restSeconds: 45,
    summary: 'Descansos cortos de alta densidad + bloque de cardio Zona 2.',
  },
  {
    id: 'salud',
    label: 'Salud y acondicionamiento',
    shortLabel: 'Salud general',
    repsRange: '10-12 reps',
    restSeconds: 60,
    summary: 'Equilibrio entre fuerza funcional, postura y energía diaria.',
  },
];

export const EXPERIENCE_OPTIONS: { id: FitnessExperience; label: string; hint: string }[] = [
  { id: 'principiante', label: 'Principiante', hint: '0 a 6 meses entrenando constante' },
  { id: 'intermedio', label: 'Intermedio', hint: '6 meses a 2 años con técnica sólida' },
  { id: 'avanzado', label: 'Avanzado', hint: 'Más de 2 años manejando cargas altas' },
];

export const ORDERED_DAYS: DayOfWeek[] = [
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
  'Domingo',
];

export const DEFAULT_DAYS_BY_COUNT: Record<number, DayOfWeek[]> = {
  2: ['Lunes', 'Jueves'],
  3: ['Lunes', 'Miércoles', 'Viernes'],
  4: ['Lunes', 'Martes', 'Jueves', 'Viernes'],
  5: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'],
  6: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
};

export function getSplitTitleByDays(daysCount: number): string {
  switch (daysCount) {
    case 2:
      return 'Full Body A / Full Body B (2 días)';
    case 3:
      return 'Push / Pull / Legs (3 días)';
    case 4:
      return 'Torso / Pierna — Upper & Lower (4 días)';
    case 5:
      return 'Push / Pull / Legs / Torso / Pierna (5 días)';
    case 6:
      return 'Push / Pull / Legs × 2 (6 días)';
    default:
      return 'Push / Pull / Legs';
  }
}

export function getRecommendedRestSeconds(goal: FitnessGoal): number {
  return GOAL_CATALOG.find((g) => g.id === goal)?.restSeconds ?? 90;
}

export function getGymDisplayName(gymType: GymType, customGymName?: string): string {
  if (gymType === 'otro' && customGymName?.trim()) {
    return customGymName.trim();
  }
  return GYM_CATALOG.find((g) => g.id === gymType)?.shortLabel ?? 'Mi Gimnasio';
}

export interface BmiResult {
  bmi: number;
  category: BmiCategory;
  label: string;
}

export function calculateBmi(weightKg: number, heightCm: number): BmiResult {
  if (heightCm <= 0 || weightKg <= 0) {
    return { bmi: 0, category: 'normal', label: 'Normal' };
  }
  const heightMeters = heightCm / 100;
  const rawBmi = weightKg / (heightMeters * heightMeters);
  const bmi = Number(rawBmi.toFixed(1));

  if (bmi < 18.5) {
    return { bmi, category: 'bajo_peso', label: 'Bajo peso' };
  }
  if (bmi < 25) {
    return { bmi, category: 'normal', label: 'Peso normal' };
  }
  if (bmi < 30) {
    return { bmi, category: 'sobrepeso', label: 'Sobrepeso' };
  }
  return { bmi, category: 'obesidad', label: 'Obesidad' };
}

type SessionTemplateKey = 'full_a' | 'full_b' | 'push' | 'pull' | 'legs' | 'upper' | 'lower';

interface ExerciseBlueprint {
  name: string;
  homeName?: string;
  smartFitName?: string;
  baseWeightRatio: number; // relative to bodyweight for barbell/machine start estimate
  notes: string;
  isCardio?: boolean;
}

const SESSION_META: Record<SessionTemplateKey, { title: string; tag: string; exercises: ExerciseBlueprint[] }> = {
  full_a: {
    title: 'Full Body A: Fuerza Base & Empuje',
    tag: 'Cuerpo Completo A',
    exercises: [
      {
        name: 'Sentadilla Libre con Barra (Squat)',
        homeName: 'Sentadilla Búlgara con Mancuernas',
        smartFitName: 'Sentadilla en Rack o Smith',
        baseWeightRatio: 0.75,
        notes: 'Bajada controlada en 2 segundos manteniendo el torso estable.',
      },
      {
        name: 'Press de Banca con Barra',
        homeName: 'Flexiones Lastradas o con Banda',
        smartFitName: 'Press de Banca con Barra o Máquina Chest Press',
        baseWeightRatio: 0.65,
        notes: 'Retracción escapular firme y pausa breve en el pecho.',
      },
      {
        name: 'Remo con Barra T o Mancuerna',
        homeName: 'Remo Invertido o con Mancuernas',
        smartFitName: 'Remo en Polea Baja (Cable Row)',
        baseWeightRatio: 0.55,
        notes: 'Lleva los codos atrás apretando dorsales.',
      },
      {
        name: 'Press Militar de Pie con Barra',
        homeName: 'Flexiones en Pica / Press con Mancuernas',
        baseWeightRatio: 0.4,
        notes: 'Activa glúteos y abdomen sin arquear la zona lumbar.',
      },
    ],
  },
  full_b: {
    title: 'Full Body B: Cadena Posterior & Tirón',
    tag: 'Cuerpo Completo B',
    exercises: [
      {
        name: 'Peso Muerto Rumano con Mancuernas',
        homeName: 'Peso Muerto Rumano Unilateral / con Mochila',
        baseWeightRatio: 0.5,
        notes: 'Bisagra de cadera sintiendo tensión en isquiotibiales.',
      },
      {
        name: 'Dominadas con Lastre / Jalón al Pecho',
        homeName: 'Dominadas Pronas en Barra Fija',
        smartFitName: 'Jalón al Pecho en Polea Alta',
        baseWeightRatio: 0.6,
        notes: 'Inicia el tirón deprimiendo los hombros.',
      },
      {
        name: 'Press Inclinado con Mancuernas',
        homeName: 'Flexiones Declinadas (Pies Elevados)',
        baseWeightRatio: 0.3,
        notes: 'Banco a 30° enfocando el pectoral superior.',
      },
      {
        name: 'Prensa Inclinada 45°',
        homeName: 'Zancadas Caminando (Lunges)',
        baseWeightRatio: 1.4,
        notes: 'Empuja con toda la planta sin bloquear rodillas arriba.',
      },
    ],
  },
  push: {
    title: 'Push: Pecho, Hombros & Tríceps',
    tag: 'Empuje',
    exercises: [
      {
        name: 'Press de Banca con Barra',
        homeName: 'Flexiones Explosivas / Lastradas',
        smartFitName: 'Press de Banca / Chest Press Guiado',
        baseWeightRatio: 0.7,
        notes: 'Trayectoria diagonal controlada y codos a 45°.',
      },
      {
        name: 'Press Inclinado con Mancuernas',
        homeName: 'Flexiones Declinadas en Silla',
        baseWeightRatio: 0.32,
        notes: 'Controla el estiramiento profundo abajo.',
      },
      {
        name: 'Elevaciones Laterales en Polea',
        homeName: 'Elevaciones Laterales con Mancuernas o Banda',
        baseWeightRatio: 0.12,
        notes: 'Sube liderando con los codos hasta la línea del hombro.',
      },
      {
        name: 'Fondos en Paralelas / Dips',
        homeName: 'Fondos de Tríceps en Banco / Paralelas',
        baseWeightRatio: 0.15,
        notes: 'Mantén hombros estables abajo en todo el recorrido.',
      },
    ],
  },
  pull: {
    title: 'Pull: Espalda, Bíceps & Posterior',
    tag: 'Tirón / Jalón',
    exercises: [
      {
        name: 'Dominadas con Lastre / Jalón al Pecho',
        homeName: 'Dominadas Supinas o Pronas en Casa',
        smartFitName: 'Jalón al Pecho en Polea',
        baseWeightRatio: 0.65,
        notes: 'Lleva el pecho hacia la barra evitando balanceo.',
      },
      {
        name: 'Remo con Barra T o Mancuerna',
        homeName: 'Remo Unilateral con Mancuerna',
        smartFitName: 'Remo Sentado en Polea Baja',
        baseWeightRatio: 0.6,
        notes: 'Pausa de 1 segundo en la contracción máxima.',
      },
      {
        name: 'Face Pulls en Polea',
        homeName: 'Band Pull-Aparts / Pájaros con Mancuernas',
        baseWeightRatio: 0.22,
        notes: 'Rotación externa hacia la frente para salud de hombro.',
      },
      {
        name: 'Curl de Bíceps en Banco Inclinado',
        homeName: 'Curl de Bíceps con Mancuernas o Banda',
        baseWeightRatio: 0.18,
        notes: 'Codos fijos atrás evitando balanceo del torso.',
      },
    ],
  },
  legs: {
    title: 'Legs: Cuádriceps, Isquios & Gemelos',
    tag: 'Pierna',
    exercises: [
      {
        name: 'Sentadilla Libre con Barra (Squat)',
        homeName: 'Sentadilla Búlgara Profunda',
        smartFitName: 'Sentadilla en Multipower / Hack Squat',
        baseWeightRatio: 0.85,
        notes: 'Rompe el paralelo con rodillas alineadas a las puntas.',
      },
      {
        name: 'Prensa Inclinada 45°',
        homeName: 'Sentadilla Pistol Asistida / Sissy',
        baseWeightRatio: 1.5,
        notes: 'Rango completo sin despegar el sacro del respaldo.',
      },
      {
        name: 'Peso Muerto Rumano con Mancuernas',
        homeName: 'Puente de Glúteo a Una Pierna (Hip Thrust)',
        baseWeightRatio: 0.5,
        notes: 'Empuja la cadera atrás manteniendo espalda neutra.',
      },
      {
        name: 'Elevación de Talones de Pie',
        homeName: 'Elevación de Talones Unilateral en Escalón',
        baseWeightRatio: 0.6,
        notes: 'Pausa de 2 segundos abajo estirando el tendón.',
      },
    ],
  },
  upper: {
    title: 'Torso Completo (Upper Body)',
    tag: 'Torso Global',
    exercises: [
      {
        name: 'Press Militar de Pie con Barra',
        homeName: 'Press de Hombros con Mancuernas / Flexiones Pica',
        baseWeightRatio: 0.45,
        notes: 'Bloquea sobre la cabeza en línea con las orejas.',
      },
      {
        name: 'Remo en Polea Baja (Cable Row)',
        homeName: 'Remo con Banda o Mancuernas',
        baseWeightRatio: 0.65,
        notes: 'Pecho erguido y estiramiento escapular completo.',
      },
      {
        name: 'Press Inclinado con Mancuernas',
        homeName: 'Flexiones con Agarre Estrecho',
        baseWeightRatio: 0.3,
        notes: 'Control constante sin chocar mancuernas arriba.',
      },
      {
        name: 'Curl de Bíceps + Extensión Tríceps',
        homeName: 'Superserie Brazos con Mancuernas',
        baseWeightRatio: 0.2,
        notes: 'Técnica estricta sin inercia.',
      },
    ],
  },
  lower: {
    title: 'Pierna & Core (Lower Focus)',
    tag: 'Pierna & Abdomen',
    exercises: [
      {
        name: 'Sentadilla Búlgara con Mancuernas',
        homeName: 'Sentadilla Búlgara Peso Corporal / Lastrada',
        baseWeightRatio: 0.35,
        notes: 'Torso ligeramente inclinado hacia adelante para glúteo.',
      },
      {
        name: 'Peso Muerto Rumano con Mancuernas',
        homeName: 'Buenos Días con Banda / Hip Thrust',
        baseWeightRatio: 0.5,
        notes: 'Mantén las mancuernas pegadas a las piernas.',
      },
      {
        name: 'Elevación de Talones de Pie',
        homeName: 'Elevación de Talones en Escalón',
        baseWeightRatio: 0.6,
        notes: 'Subida explosiva y bajada lenta.',
      },
      {
        name: 'Plancha Abdominal & Rueda / Crunch',
        homeName: 'Plancha Abdominal Isométrica + Hollow Hold',
        baseWeightRatio: 0,
        notes: 'Retroversión pélvica y respiración abdominal controlada.',
      },
    ],
  },
};

function getSplitSequence(daysCount: number): SessionTemplateKey[] {
  switch (daysCount) {
    case 2:
      return ['full_a', 'full_b'];
    case 3:
      return ['push', 'pull', 'legs'];
    case 4:
      return ['upper', 'lower', 'upper', 'lower'];
    case 5:
      return ['push', 'pull', 'legs', 'upper', 'lower'];
    case 6:
      return ['push', 'pull', 'legs', 'push', 'pull', 'legs'];
    default:
      return ['push', 'pull', 'legs'];
  }
}

function getGoalParameters(goal: FitnessGoal, experience: FitnessExperience) {
  const expOffset = experience === 'principiante' ? -1 : experience === 'avanzado' ? 1 : 0;

  switch (goal) {
    case 'fuerza':
      return {
        sets: Math.max(3, Math.min(5, 4 + expOffset)),
        reps: '4-6 reps',
        restSeconds: 120,
        weightMultiplier: 1.15,
      };
    case 'perdida_grasa':
      return {
        sets: Math.max(3, 3 + (experience === 'avanzado' ? 1 : 0)),
        reps: '12-15 reps',
        restSeconds: 45,
        weightMultiplier: 0.85,
      };
    case 'salud':
      return {
        sets: 3,
        reps: '10-12 reps',
        restSeconds: 60,
        weightMultiplier: 0.9,
      };
    case 'hipertrofia':
    default:
      return {
        sets: Math.max(3, Math.min(4, 3 + (experience !== 'principiante' ? 1 : 0))),
        reps: '8-12 reps',
        restSeconds: 90,
        weightMultiplier: 1.0,
      };
  }
}

function roundToHalfOrTwoPointFive(val: number): number {
  if (val <= 0) return 0;
  if (val <= 15) return Math.max(2.5, Math.round(val * 2) / 2);
  return Math.max(5, Math.round(val / 2.5) * 2.5);
}

export function generateAdaptiveRoutines(
  profile: Pick<UserGymProfile, 'gymType' | 'trainingDaysCount' | 'selectedDays' | 'goal' | 'experience' | 'weightKg'>
): GymRoutine[] {
  const orderedSelectedDays = ORDERED_DAYS.filter((d) => profile.selectedDays.includes(d));
  const targetDays =
    orderedSelectedDays.length > 0
      ? orderedSelectedDays
      : DEFAULT_DAYS_BY_COUNT[profile.trainingDaysCount] || DEFAULT_DAYS_BY_COUNT[3];

  const sequence = getSplitSequence(targetDays.length);
  const goalParams = getGoalParameters(profile.goal, profile.experience);
  const expMultiplier =
    profile.experience === 'principiante' ? 0.7 : profile.experience === 'avanzado' ? 1.25 : 1.0;

  return targetDays.map((day, idx) => {
    const templateKey = sequence[idx % sequence.length];
    const meta = SESSION_META[templateKey];

    const exercises: GymExercise[] = meta.exercises.map((bp, exIdx) => {
      let resolvedName = bp.name;
      if (profile.gymType === 'casa' && bp.homeName) {
        resolvedName = bp.homeName;
      } else if (profile.gymType === 'smart_fit' && bp.smartFitName) {
        resolvedName = bp.smartFitName;
      }

      const estimatedWeight =
        bp.baseWeightRatio > 0
          ? roundToHalfOrTwoPointFive(
              profile.weightKg * bp.baseWeightRatio * goalParams.weightMultiplier * expMultiplier
            )
          : undefined;

      const setsCount = bp.isCardio ? 1 : goalParams.sets;

      return {
        id: `gen-${day.toLowerCase().slice(0, 3)}-${idx}-${exIdx}-${Date.now()}`,
        name: resolvedName,
        sets: setsCount,
        reps: goalParams.reps,
        weightKg: estimatedWeight,
        personalRecordKg: estimatedWeight,
        completedSets: Array(setsCount).fill(false),
        restSeconds: goalParams.restSeconds,
        notes: bp.notes,
      };
    });

    // For fat loss goal, append dedicated Zone 2 cardio / conditioning finisher
    if (profile.goal === 'perdida_grasa') {
      exercises.push({
        id: `gen-cardio-${day.toLowerCase().slice(0, 3)}-${idx}-${Date.now()}`,
        name:
          profile.gymType === 'casa'
            ? 'Circuito Cardio HIIT / Movilidad Activa'
            : 'Caminata Inclinada 12% (Zona 2)',
        sets: 1,
        reps: '20 mins',
        completedSets: [false],
        restSeconds: 45,
        notes: 'Mantén un ritmo cardíaco constante sin sujetarte del panel.',
      });
    }

    return {
      id: `gym-gen-${day.toLowerCase()}`,
      name: meta.title,
      dayOfWeek: day,
      tag: `${meta.tag} · ${goalParams.reps}`,
      exercises,
    };
  });
}
