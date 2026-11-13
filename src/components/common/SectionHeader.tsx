import React from 'react';

export interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  as?: 'h1' | 'h2' | 'h3';
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  subtitle,
  badge,
  actions,
  as = 'h1',
}) => {
  const HeadingTag = as;

  return (
    <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4 pb-2">
      <div className="min-w-0 xl:shrink-0">
        <div className="flex flex-wrap items-center gap-2.5">
          <HeadingTag className="text-2xl sm:text-3xl font-medium tracking-[-0.03em] text-[var(--ink)] leading-tight">
            {title}
          </HeadingTag>
          {badge}
        </div>
        {subtitle && (
          <p className="text-sm sm:text-[15px] text-[var(--muted)] mt-1 max-w-[44ch] leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex flex-wrap xl:justify-end items-center gap-2.5 min-w-0">
          {actions}
        </div>
      )}
    </div>
  );
};
