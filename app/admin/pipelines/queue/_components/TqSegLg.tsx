/**
 * TqSegLg — the large segmented control (design spec §7-1 `.seg.lg`): gray-100
 * track, h40 buttons, active = white card + shadow, with a tabular count suffix
 * and an optional 8px leading color dot (the 지연 filter's delay-tier dots). A
 * dedicated component rather than a SegControl size prop because the grammar
 * differs wholesale from `pipelineStyles.seg` (white-bordered track, dark-fill
 * active) — see tqStyles.segLg. Generic over the option value.
 */
'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/theme';
import { tqStyles } from '@/app/admin/pipelines/queue/_components/tqStyles';

export interface TqSegLgOption<T extends string> {
  label: ReactNode;
  value: T;
  /** Right-aligned tabular count. */
  count?: number;
  /** Leading delay-tier color dot. */
  dot?: 'd1' | 'd2' | 'd3';
}

export interface TqSegLgProps<T extends string> {
  options: ReadonlyArray<TqSegLgOption<T>>;
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
  className?: string;
}

export function TqSegLg<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: TqSegLgProps<T>) {
  const { segLg } = tqStyles;
  return (
    <div className={cn(segLg.container, className)} role="group" aria-label={ariaLabel}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            className={cn(segLg.button, active ? segLg.buttonActive : segLg.buttonIdle)}
            onClick={() => onChange(option.value)}
          >
            {option.dot != null && <span className={cn(segLg.dot, segLg.dotTone[option.dot])} />}
            {option.label}
            {option.count != null && (
              <span className={cn(segLg.count, active && segLg.countActive)}>{option.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
