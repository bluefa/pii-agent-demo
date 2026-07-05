/**
 * SegControl — segmented toggle (design-inventory §5 `.seg`; container pad 2,
 * buttons h28 pad 0 12, active = white card + shadow). Generic over the value.
 */
'use client';

import type { ReactNode } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';

export interface SegOption<T extends string> {
  label: ReactNode;
  value: T;
}

export interface SegControlProps<T extends string> {
  options: ReadonlyArray<SegOption<T>>;
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
  className?: string;
}

export function SegControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: SegControlProps<T>) {
  const { seg } = pipelineStyles;
  return (
    <div className={cn(seg.container, className)} role="tablist" aria-label={ariaLabel}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            className={cn(seg.button, active ? seg.buttonActive : seg.buttonIdle)}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
