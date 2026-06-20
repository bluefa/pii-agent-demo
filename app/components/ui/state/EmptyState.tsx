'use client';

import type { ReactNode } from 'react';
import { bgColors, borderColors, cn, textColors } from '@/lib/theme';

export type EmptyStateVariant = 'block' | 'inline' | 'card';

interface EmptyStateProps {
  /** Layout family. Empty layouts genuinely differ per ADR-018 §1. */
  variant?: EmptyStateVariant;
  /** Illustration / glyph above the title (e.g. an icon component). */
  icon?: ReactNode;
  /** Primary headline. */
  title?: string;
  /** Supporting copy beneath the title. */
  description?: string;
  /** Optional CTA (e.g. a button) rendered below the copy. */
  action?: ReactNode;
}

/**
 * ADR-018 §1 canonical `empty` state (Layer ⑧ presentational).
 * A variant family: a list/page `block`, a compact `inline` widget, or a
 * bordered `card` placeholder. Content slots generalize; the layout does not.
 */
export const EmptyState = ({
  variant = 'block',
  icon,
  title,
  description,
  action,
}: EmptyStateProps) => {
  if (variant === 'inline') {
    return (
      <div className="flex items-center gap-2 px-1 py-3 text-left">
        {icon && <span className={textColors.quaternary}>{icon}</span>}
        <div>
          {title && (
            <p className={cn('text-[13px] font-semibold', textColors.secondary)}>{title}</p>
          )}
          {description && (
            <p className={cn('text-[12px]', textColors.tertiary)}>{description}</p>
          )}
        </div>
        {action}
      </div>
    );
  }

  const containerClass =
    variant === 'card'
      ? cn(
          'flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-12 text-center',
          borderColors.default,
          bgColors.muted,
        )
      : 'flex flex-col items-center gap-2 px-6 py-14 text-center';

  return (
    <div className={containerClass}>
      {icon && (
        <div
          className={cn(
            'mb-1 grid h-14 w-14 place-items-center rounded-2xl',
            bgColors.muted,
            textColors.quaternary,
          )}
        >
          {icon}
        </div>
      )}
      {title && (
        <h3 className={cn('text-[15px] font-bold', textColors.secondary)}>{title}</h3>
      )}
      {description && (
        <p className={cn('text-[12.5px]', textColors.tertiary)}>{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
};
