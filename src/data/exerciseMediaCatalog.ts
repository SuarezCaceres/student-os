import type { GymExercise, ExerciseTechniqueGuide } from '../types';

export interface ExerciseMediaInfo {
  posterUrl: string;
  videoUrl: string;
  muscleFocus: string;
  categoryTag: string;
  technique: ExerciseTechniqueGuide;
}

const DEFAULT_BENCH_TECHNIQUE: ExerciseTechniqueGuide = {
  videoUrl: '/videos/bench-press-technique.webm',
  posterUrl: '/bench-press-poster.jpg',
  muscleGroups: ['Pectoral Mayor', 'Tríceps Braquial', 'Deltoides Anterior'],
  setupCues: [
    'Ojos directamente debajo de la barra olímpica.',
    'Pies firmemente plantados en el suelo generando leg drive.',
    'Retracción y depresión escapular (omóplatos juntos contra el banco).',
    'Agarre prono simétrico a 1.5 veces el ancho de hombros.',
  ],
  executionCues: [
    'Desbloquea la barra y estabilízala sobre el pecho superior.',
    'Fase excéntrica: Bajada de 2 a 3 segundos en trayectoria ligeramente diagonal hacia el esternón.',
    'Pausa de 0.5 seg rozando el pecho sin rebotar en la caja torácica.',
    'Fase concéntrica: Empuje explosivo manteniendo codos a 45-60 grados respecto al torso.',
  ],
  breathingCues:
    'Inhala profundo y aprieta el abdomen (Maniobra de Valsalva) antes de descender. Mantén el aire durante el punto bajo y exhala con fuerza al superar la mitad de la subida.',
  commonMistakes: [
    'Rebotar la barra con violencia en las costillas.',
    'Despegar los glúteos del banco durante el empuje máximo.',
    'Abrir los codos a 90° (riesgo de pinzamiento en el manguito rotador).',
    'Perder la rigidez de las muñecas doblándolas hacia atrás.',
  ],
};

const SQUAT_TECHNIQUE: ExerciseTechniqueGuide = {
  videoUrl: '/videos/squat-technique.webm',
  posterUrl: '/squat-poster.jpg',
  muscleGroups: ['Cuádriceps', 'Glúteo Mayor', 'Core / Erectores'],
  setupCues: [
    'Barra apoyada firmemente sobre el trapecio (barra alta) o espina de la escápula (barra baja).',
    'Pies a la anchura de hombros con puntas ligeramente orientadas hacia afuera (15-30°).',
    'Mirada al frente, pecho orgulloso y abdomen activado con aire profundo.',
  ],
  executionCues: [
    'Inicia el movimiento flexionando caderas y rodillas simultáneamente.',
    'Desciende controlando hasta romper la paralela (cadera por debajo de la rótula).',
    'Empuja el suelo con todo el pie para subir explosivamente sin que las rodillas colapsen hacia adentro (valgo).',
  ],
  breathingCues:
    'Inhala al máximo antes de iniciar el descenso. Aguanta la presión del core abajo y exhala al superar el punto más difícil de la subida.',
  commonMistakes: [
    'Levantar los talones del suelo al bajar.',
    'Colapso de rodillas hacia adentro (valgo de rodilla).',
    'Redondear la espalda lumbar (butt wink excesivo).',
  ],
};

const PULLUP_TECHNIQUE: ExerciseTechniqueGuide = {
  videoUrl: '/videos/pullup-technique.webm',
  posterUrl: '/pullup-poster.jpg',
  muscleGroups: ['Dorsal Ancho', 'Bíceps Braquial', 'Trapecio Medio/Inferior'],
  setupCues: [
    'Agarre prono algo más ancho que los hombros.',
    'Cuerpo suspendido en extensión completa sin balanceos.',
    'Retracción escapular antes de iniciar la flexión de codos.',
  ],
  executionCues: [
    'Tracciona llevando el pecho hacia la barra, no solo el cuello.',
    'Dirige los codos hacia abajo y atrás.',
    'Baja de forma controlada hasta la posición de estiramiento pasivo controlado.',
  ],
  breathingCues:
    'Inhala abajo y exhala durante la tracción concéntrica.',
  commonMistakes: [
    'Hacer kipping o patalear para subir.',
    'No completar el rango de movimiento abajo.',
    'Encoger los hombros hacia las orejas.',
  ],
};

const CARDIO_MOBILITY_TECHNIQUE: ExerciseTechniqueGuide = {
  videoUrl: '/videos/cardio-mobility-technique.webm',
  posterUrl: '/cardio-poster.jpg',
  muscleGroups: ['Sistema Cardiovascular', 'Movilidad Articular', 'Fascia'],
  setupCues: [
    'Calzado cómodo y ropa deportiva transpirable.',
    'Inclinación de caminadora entre 8% y 12% a velocidad constante de 4-5 km/h.',
    'Postura erguida sin sujetarse de los pasamanos para activar el core.',
  ],
  executionCues: [
    'Pasos firmes apoyando primero el mediopié.',
    'Ritmo cardíaco en Zona 2 (60-70% de la frecuencia cardíaca máxima).',
    'Para estiramientos: 30 a 45 segundos por grupo muscular con respiración profunda.',
  ],
  breathingCues:
    'Respiración nasal rítmica y controlada, permitiendo mantener una conversación sin fatiga.',
  commonMistakes: [
    'Sujetarse con fuerza de los soportes de la caminadora reduciendo el gasto calórico.',
    'Dar rebotes bruscos durante los estiramientos pasivos.',
  ],
};

export function getExerciseMedia(exercise: GymExercise): ExerciseMediaInfo {
  const name = exercise.name.toLowerCase();

  // Explicit poster on exercise
  if (exercise.thumbnailUrl) {
    return {
      posterUrl: exercise.thumbnailUrl,
      videoUrl: exercise.technique?.videoUrl || '/videos/bench-press-technique.webm',
      muscleFocus: exercise.technique?.muscleGroups[0] || 'Fuerza',
      categoryTag: 'Técnica',
      technique: exercise.technique || DEFAULT_BENCH_TECHNIQUE,
    };
  }

  // Squats / Legs / Lower body
  if (
    name.includes('sentadilla') ||
    name.includes('squat') ||
    name.includes('prensa') ||
    name.includes('búlgara') ||
    name.includes('bulgarian') ||
    name.includes('talones') ||
    name.includes('gemelos') ||
    name.includes('pierna')
  ) {
    return {
      posterUrl: '/squat-poster.jpg',
      videoUrl: exercise.technique?.videoUrl || '/videos/squat-technique.webm',
      muscleFocus: 'Pierna & Core',
      categoryTag: 'Sentadilla / Pierna',
      technique: exercise.technique || SQUAT_TECHNIQUE,
    };
  }

  // Pull / Lats / Back / Bíceps
  if (
    name.includes('dominada') ||
    name.includes('jalón') ||
    name.includes('remo') ||
    name.includes('curl') ||
    name.includes('bíceps') ||
    name.includes('face pull') ||
    name.includes('espalda')
  ) {
    return {
      posterUrl: '/pullup-poster.jpg',
      videoUrl: exercise.technique?.videoUrl || '/videos/pullup-technique.webm',
      muscleFocus: 'Espalda & Bíceps',
      categoryTag: 'Tracción / Jalón',
      technique: exercise.technique || PULLUP_TECHNIQUE,
    };
  }

  // Cardio / Mobility / Rest
  if (
    name.includes('caminata') ||
    name.includes('cardio') ||
    name.includes('estiramiento') ||
    name.includes('foam roller') ||
    name.includes('trote') ||
    name.includes('paseo') ||
    name.includes('movilidad') ||
    name.includes('descanso')
  ) {
    return {
      posterUrl: '/cardio-poster.jpg',
      videoUrl: exercise.technique?.videoUrl || '/videos/cardio-mobility-technique.webm',
      muscleFocus: 'Cardio & Movilidad',
      categoryTag: 'Recuperación',
      technique: exercise.technique || CARDIO_MOBILITY_TECHNIQUE,
    };
  }

  // Default: Push / Chest / Triceps / Shoulders
  return {
    posterUrl: exercise.technique?.posterUrl || '/bench-press-poster.jpg',
    videoUrl: exercise.technique?.videoUrl || '/videos/bench-press-technique.webm',
    muscleFocus: 'Pecho, Hombros & Tríceps',
    categoryTag: 'Empuje / Fuerza',
    technique: exercise.technique || DEFAULT_BENCH_TECHNIQUE,
  };
}
