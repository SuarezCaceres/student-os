import type { AppState, CalendarBlock } from '../types';
import { getDefaultSyncStorage, SYNC_DOC_PREFIX, type SyncStorage } from '../sync/storage';

/**
 * Limpieza de sincronizacion al cerrar sesion: borra cola de cambios, cursor, snapshot y versiones
 * del usuario (o de todos si no se indica) en IndexedDB. NO toca los datos de la app en localStorage
 * (siguen como cache local) ni la marca de "ya importo" (para no volver a preguntar en una nube vacia).
 * La sesion de Supabase la limpia `signOut()` de `services/supabase.ts`.
 */
export async function clearSyncDataOnSignOut(
  userId?: string | null,
  storage: SyncStorage = getDefaultSyncStorage(),
): Promise<void> {
  try {
    if (userId) {
      await storage.del(`${SYNC_DOC_PREFIX}${userId}`);
      return;
    }
    const keys = await storage.keys();
    await Promise.all(keys.filter((k) => k.startsWith(SYNC_DOC_PREFIX)).map((k) => storage.del(k)));
  } catch (error) {
    console.warn('No se pudo limpiar la cola de sincronización:', error);
  }
}

export const REAL_ACCOUNT_CLEANUP_FLAG_KEY = 'student_os_cleaned_mock_calendar_v1';

export const MOCK_CALENDAR_BLOCK_IDS: ReadonlySet<string> = new Set([
  'cb-1',
  'cb-2',
  'cb-3',
  'cb-4',
  'cb-5',
  'cb-6',
  'cb-7',
  'cb-8',
  'cb-9',
  'cb-10',
  'cb-11',
  'cb-12',
  'cb-13',
  'cb-14',
]);

/**
 * Returns true when a calendar block is one of the static demo seed entries (cb-1..cb-14)
 * and has never been linked to a real Google Calendar event.
 */
export function isMockCalendarBlock(block: CalendarBlock): boolean {
  return MOCK_CALENDAR_BLOCK_IDS.has(block.id) && !block.googleEventId;
}

/**
 * Removes mock calendar seed blocks while preserving user-created and Google-synced blocks.
 */
export function stripMockCalendarBlocks(blocks: CalendarBlock[]): CalendarBlock[] {
  return blocks.filter((block) => !isMockCalendarBlock(block));
}

/**
 * Cleans only mock WeeklyCalendar seed blocks from an AppState snapshot, leaving Kanban,
 * university assignments, gym routines, and weekly reflections intact as editable templates.
 */
export function applyRealAccountCalendarCleanup(state: AppState): AppState {
  const cleanedBlocks = stripMockCalendarBlocks(state.calendarBlocks);
  if (cleanedBlocks.length === state.calendarBlocks.length) {
    return state;
  }

  return {
    ...state,
    calendarBlocks: cleanedBlocks,
  };
}
