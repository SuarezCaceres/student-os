import React from 'react';
import { Bell, BellOff, Check } from 'lucide-react';
import {
  REMINDER_PRESETS,
  areReminderListsEqual,
  formatReminderSummary,
} from '../../utils/reminderPresets';

export interface ReminderPresetPickerProps {
  value: number[];
  onChange: (minutes: number[]) => void;
  label?: string;
  helperText?: string;
  compact?: boolean;
  disabled?: boolean;
  id?: string;
}

export const ReminderPresetPicker: React.FC<ReminderPresetPickerProps> = ({
  value,
  onChange,
  label = 'Aviso en Google Calendar',
  helperText = 'Google enviará la notificación a tu celular y PC antes de empezar.',
  compact = false,
  disabled = false,
  id,
}) => {
  const groupId = id || 'reminder-preset-group';

  return (
    <div className="space-y-2" role="group" aria-labelledby={groupId}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          id={groupId}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--ink)]"
        >
          <Bell className="w-4 h-4 shrink-0 text-[var(--action)]" aria-hidden="true" />
          <span>{label}</span>
        </span>
        <span className="text-[13px] font-medium text-[var(--muted)] t-num">
          {formatReminderSummary(value)}
        </span>
      </div>

      <div className={compact ? 'flex flex-wrap gap-1.5' : 'flex flex-wrap gap-2'}>
        {REMINDER_PRESETS.map((preset) => {
          const isSelected = areReminderListsEqual(value, preset.minutes);
          const isNone = preset.minutes.length === 0;

          return (
            <button
              key={preset.id}
              type="button"
              disabled={disabled}
              aria-pressed={isSelected}
              onClick={() => onChange(preset.minutes)}
              className={`min-h-[44px] inline-flex items-center gap-1.5 rounded-[10px] border text-[13px] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-[var(--action)] focus-visible:outline-offset-2 ${
                compact ? 'px-3 py-2' : 'px-3.5 py-2'
              } ${
                isSelected
                  ? 'bg-[color-mix(in_oklab,var(--action)_14%,var(--surface))] border-[var(--action)] text-[var(--ink)] font-semibold'
                  : 'bg-[var(--surface)] border-[var(--line-strong)] text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] font-medium'
              }`}
            >
              {isNone ? (
                <BellOff
                  className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-[var(--action)]' : ''}`}
                  aria-hidden="true"
                />
              ) : isSelected ? (
                <Check className="w-3.5 h-3.5 shrink-0 text-[var(--action)]" aria-hidden="true" />
              ) : (
                <Bell className="w-3.5 h-3.5 shrink-0 opacity-75" aria-hidden="true" />
              )}
              <span>{compact ? preset.shortLabel : preset.label}</span>
              {preset.recommended && !compact && (
                <span
                  className={`text-[13px] px-1.5 py-0.5 rounded font-medium ${
                    isSelected
                      ? 'bg-[var(--action)] text-[var(--action-ink)]'
                      : 'bg-[var(--surface-2)] text-[var(--muted)]'
                  }`}
                >
                  Rec.
                </span>
              )}
            </button>
          );
        })}
      </div>

      {helperText && (
        <p className="text-[13px] leading-snug text-[var(--muted)]">{helperText}</p>
      )}
    </div>
  );
};
