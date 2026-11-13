export interface ReminderPresetOption {
  id: string;
  label: string;
  shortLabel: string;
  minutes: number[];
  recommended?: boolean;
}

export const REMINDER_PRESETS: ReminderPresetOption[] = [
  { id: 'none', label: 'Sin aviso', shortLabel: 'Sin aviso', minutes: [] },
  { id: '15m', label: '15 min antes', shortLabel: '15 min', minutes: [15] },
  {
    id: '30m',
    label: '30 min antes',
    shortLabel: '30 min',
    minutes: [30],
    recommended: true,
  },
  { id: '60m', label: '1 h antes', shortLabel: '1 h antes', minutes: [60] },
  { id: '60m_15m', label: '1 h + 15 min', shortLabel: '1 h + 15 m', minutes: [60, 15] },
];

export const DEFAULT_GYM_REMINDER_MINUTES: number[] = [30];
export const DEFAULT_BLOCK_REMINDER_MINUTES: number[] = [30];

export function areReminderListsEqual(a?: number[], b?: number[]): boolean {
  const normA = [...(a ?? [])].sort((x, y) => x - y);
  const normB = [...(b ?? [])].sort((x, y) => x - y);
  if (normA.length !== normB.length) return false;
  return normA.every((val, idx) => val === normB[idx]);
}

export function formatReminderSummary(minutes?: number[]): string {
  if (!minutes || minutes.length === 0) return 'Sin aviso';
  const sorted = [...minutes].sort((a, b) => b - a);
  return (
    sorted
      .map((m) => {
        if (m >= 60 && m % 60 === 0) {
          const hours = m / 60;
          return `${hours} h`;
        }
        return `${m} min`;
      })
      .join(' y ') + ' antes'
  );
}
