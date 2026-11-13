import type { AppState, CalendarBlock } from '../types';

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
