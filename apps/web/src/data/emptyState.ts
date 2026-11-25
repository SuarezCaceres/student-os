import type { AppState } from '../types';

/**
 * Estado con el que arranca una cuenta nueva (spec 010): vacio en todos los modulos. No contiene datos de ejemplo ni de
 * ninguna persona real; cada modulo vacio muestra su guia. `initialData` queda solo como material de pruebas.
 *
 * `studentName` se sustituye por el nombre de pila de la cuenta de Google (`buildNewAccountState`); `career` es un
 * marcador neutro hasta que la persona lo cambie.
 */
export const emptyAppState: AppState = {
  studentName: 'Estudiante',
  career: 'Estudiante universitario',
  currentAcademicWeek: 1,
  streak: 0,
  theme: 'dark',
  weeklyReflections: {},
  kanbanItems: [],
  gymRoutines: [],
  calendarBlocks: [],
  universityAssignments: [],
};
