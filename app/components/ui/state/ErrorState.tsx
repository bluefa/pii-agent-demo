'use client';

import { cn, getButtonClass, statusColors, textColors } from '@/lib/theme';
import { StatusErrorIcon } from '@/app/components/ui/icons';

interface ErrorStateProps {
  /**
   * The failure message to render. ADR-017 §3b Phase 1 — there is no error
   * `code` taxonomy yet, so the message is rendered directly.
   */
  message: string;
  /** Optional heading above the message. */
  title?: string;
  /** When provided, renders a retry button wired to this handler. */
  onRetry?: () => void;
}

/**
 * ADR-018 §1 canonical `error` state (Layer ⑧ presentational).
 * Title + description + optional retry; renders `message` now / `code` later.
 */
export const ErrorState = ({ message, title, onRetry }: ErrorStateProps) => (
  <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
    <div
      className={cn(
        'mb-1 grid h-14 w-14 place-items-center rounded-2xl',
        statusColors.error.bg,
        statusColors.error.text,
      )}
    >
      <StatusErrorIcon className="h-7 w-7" />
    </div>
    {title && (
      <h3 className={cn('text-[15px] font-bold', textColors.secondary)}>{title}</h3>
    )}
    <p className={cn('text-[12.5px]', textColors.tertiary)}>{message}</p>
    {onRetry && (
      <button type="button" onClick={onRetry} className={cn('mt-2', getButtonClass('secondary', 'sm'))}>
        다시 시도
      </button>
    )}
  </div>
);
