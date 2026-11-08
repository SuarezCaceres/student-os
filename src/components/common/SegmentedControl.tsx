import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

export interface SegmentOption<T extends string> {
  id: T;
  label: string;
  shortLabel?: string;
  icon?: React.ReactNode;
  badge?: string | number;
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (next: T) => void;
  ariaLabel: string;
  fullWidth?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  fullWidth = false,
  size = 'md',
  className = '',
}: SegmentedControlProps<T>) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [indicator, setIndicator] = useState<{ x: number; y: number; w: number; h: number; ready: boolean }>({
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    ready: false,
  });

  const updateIndicator = useCallback(() => {
    const activeBtn = btnRefs.current[value];
    if (!activeBtn) return;
    setIndicator({
      x: activeBtn.offsetLeft,
      y: activeBtn.offsetTop,
      w: activeBtn.offsetWidth,
      h: activeBtn.offsetHeight,
      ready: true,
    });
  }, [value]);

  useLayoutEffect(() => {
    updateIndicator();
  }, [updateIndicator, options.length]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => updateIndicator());
    ro.observe(el);
    return () => ro.disconnect();
  }, [updateIndicator, options.length]);

  const heightClass = size === 'sm' ? 'min-h-[38px] px-3 text-[13px]' : 'min-h-[42px] px-3.5 text-[14px]';

  return (
    <div
      ref={containerRef}
      role="tablist"
      aria-label={ariaLabel}
      className={`relative isolate inline-flex items-center gap-1 p-1 rounded-[14px] bg-[var(--surface-2)] border border-[var(--line)] overflow-x-auto no-scrollbar ${
        fullWidth ? 'w-full' : ''
      } ${className}`}
    >
      {indicator.ready && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 z-0 rounded-[10px] bg-[var(--surface)] border border-[var(--line-strong)] shadow-2xs transition-transform duration-[240ms] ease-[cubic-bezier(0.65,0,0.35,1)]"
          style={{
            width: `${indicator.w}px`,
            height: `${indicator.h}px`,
            transform: `translate(${indicator.x}px, ${indicator.y}px)`,
          }}
        />
      )}

      {options.map((opt) => {
        const isActive = opt.id === value;
        return (
          <button
            key={opt.id}
            ref={(node) => {
              btnRefs.current[opt.id] = node;
            }}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(opt.id)}
            className={`relative z-10 inline-flex items-center justify-center gap-2 rounded-[10px] font-medium whitespace-nowrap select-none cursor-pointer transition-colors duration-[150ms] focus-visible:outline-2 focus-visible:outline-[var(--action)] ${heightClass} ${
              fullWidth ? 'flex-1' : ''
            } ${
              isActive
                ? 'text-[var(--ink)]'
                : 'text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            {opt.icon && (
              <span className={isActive ? 'text-[var(--action)]' : 'text-[var(--muted)]'}>
                {opt.icon}
              </span>
            )}
            {opt.shortLabel ? (
              <>
                <span className="sm:hidden">{opt.shortLabel}</span>
                <span className="hidden sm:inline">{opt.label}</span>
              </>
            ) : (
              <span>{opt.label}</span>
            )}
            {opt.badge !== undefined && (
              <span
                className={`px-1.5 py-0.5 rounded-full text-[13px] leading-none t-num ${
                  isActive
                    ? 'bg-[color-mix(in_oklab,var(--action)_16%,transparent)] text-[var(--action)]'
                    : 'bg-[var(--surface)] text-[var(--muted)]'
                }`}
              >
                {opt.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
