import type { SyncAdapter } from '../adapterTypes';
import { calendarAdapter } from './calendar';
import { gymAdapter } from './gym';
import { kanbanAdapter } from './kanban';
import { learningAdapter } from './learning';
import { profileAdapter } from './profile';
import { universityAdapter } from './university';

/**
 * Registro FINAL de adaptadores. Esta lista ya incluye todos los modulos: los agentes de la Ola 3
 * solo rellenan su archivo y NO editan este (regla Zero-Conflict de PLAN_BACKEND.md).
 */
export const syncAdapters: SyncAdapter[] = [
  profileAdapter,
  kanbanAdapter,
  universityAdapter,
  learningAdapter,
  gymAdapter,
  calendarAdapter,
];
