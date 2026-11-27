import type { AppState, CalendarBlock } from '../types';
import { getDefaultSyncStorage, SYNC_DOC_PREFIX, type SyncStorage } from '../sync/storage';

/**
 * Limpieza de sincronizacion al cerrar sesion: borra cola de cambios, cursor, snapshot y versiones
 * del usuario (o de todos si no se indica) en IndexedDB. NO toca los datos de la app en localStorage
 * (siguen como cache local de esta cuenta; el motor los descarta si entra otra).
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

/**
 * Claves que dejo el prototipo (cuenta local falsa, Client ID y token de Google Identity Services, marcas del importador y
 * de las migraciones por navegador). Spec 009 (C14): se borran sin leerlas ni subirlas. `student_os_state_v1` NO esta aqui:
 * es la cache de la cuenta y el motor de sync la descarta por su cuenta si pertenece a otra persona.
 */
const LEGACY_LOCAL_KEYS = [
  'student_os_user_session',
  'student_os_gcal_client_id',
  'student_os_cleaned_mock_calendar_v1',
  'student_os_work_shift_v1',
];
const LEGACY_LOCAL_PREFIXES = ['student_os_sync_imported_v1:'];
const LEGACY_SESSION_KEYS = ['student_os_gcal_token'];

export function clearLegacyLocalData(
  local: Storage | undefined = typeof window === 'undefined' ? undefined : window.localStorage,
  session: Storage | undefined = typeof window === 'undefined' ? undefined : window.sessionStorage,
): void {
  try {
    if (local) {
      for (const key of LEGACY_LOCAL_KEYS) local.removeItem(key);
      const prefixed: string[] = [];
      for (let i = 0; i < local.length; i += 1) {
        const key = local.key(i);
        if (key && LEGACY_LOCAL_PREFIXES.some((prefix) => key.startsWith(prefix))) prefixed.push(key);
      }
      for (const key of prefixed) local.removeItem(key);
    }
    if (session) {
      for (const key of LEGACY_SESSION_KEYS) session.removeItem(key);
    }
  } catch {
    // Almacenamiento bloqueado (modo privado restringido): no hay nada que limpiar.
  }
}

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
