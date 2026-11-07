import React, { useEffect, useId } from 'react';
import { X } from 'lucide-react';

export interface ModalShellProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  badge?: string;
  icon?: React.ReactNode;
  maxWidth?: 'md' | 'lg' | 'xl' | '2xl' | '4xl';
  footer?: React.ReactNode;
  children: React.ReactNode;
}

const MAX_WIDTH_CLASS: Record<NonNullable<ModalShellProps['maxWidth']>, string> = {
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
  xl: 'sm:max-w-xl',
  '2xl': 'sm:max-w-2xl',
  '4xl': 'sm:max-w-4xl',
};

export const ModalShell: React.FC<ModalShellProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  badge,
  icon,
  maxWidth = 'lg',
  footer,
  children,
}) => {
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/65 modal-backdrop-enter"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className={`w-full ${MAX_WIDTH_CLASS[maxWidth]} max-h-[92vh] sm:max-h-[88vh] flex flex-col overflow-hidden bg-[var(--surface)] text-[var(--ink)] border border-[var(--line-strong)] rounded-t-[20px] sm:rounded-[20px] shadow-2xl modal-panel-enter`}
      >
        {/* Header */}
        <div className="px-5 py-4 sm:px-6 sm:py-5 border-b border-[var(--line)] flex items-start justify-between gap-4 shrink-0">
          <div className="flex items-start gap-3 min-w-0">
            {icon && (
              <div className="w-10 h-10 rounded-[12px] bg-[var(--surface-2)] border border-[var(--line)] text-[var(--action)] flex items-center justify-center shrink-0 mt-0.5">
                {icon}
              </div>
            )}
            <div className="min-w-0">
              {badge && (
                <span className="t-badge t-badge-accent mb-1.5">
                  {badge}
                </span>
              )}
              <h2
                id={titleId}
                className="text-lg sm:text-xl font-medium tracking-[-0.025em] text-[var(--ink)] leading-snug"
              >
                {title}
              </h2>
              {subtitle && (
                <p className="text-sm text-[var(--muted)] mt-0.5 leading-normal">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="t-btn t-btn-ghost t-btn-icon shrink-0 -mr-1 -mt-1"
            aria-label="Cerrar ventana"
            title="Cerrar (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1">
          {children}
        </div>

        {/* Optional Footer */}
        {footer && (
          <div className="px-5 py-4 sm:px-6 border-t border-[var(--line)] bg-[var(--surface)] flex items-center justify-end gap-3 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
