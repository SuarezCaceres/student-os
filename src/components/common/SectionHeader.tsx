import React from 'react';

export interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  subtitle,
  badge,
  actions,
}) => {
  return (
    <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-2">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className="text-2xl sm:text-[28px] font-medium tracking-[-0.03em] text-[var(--ink)] leading-tight">
            {title}
          </h2>
          {badge}
        </div>
        {subtitle && (
          <p className="text-sm sm:text-[15px] text-[var(--muted)] mt-1 max-w-[62ch] leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
};
