'use client';

import { cn, textColors } from '@/lib/theme';
import { LoadingSpinner } from '@/app/components/ui/LoadingSpinner';
import { useLocale } from '@/app/components/LocaleProvider';
import { COPY } from '@/lib/copy';

interface LoadingStateProps {
  /** Text shown next to the spinner. Falls back to a generic message in the reader's language. */
  label?: string;
}

/**
 * ADR-018 §1 canonical `loading` state (Layer ⑧ presentational).
 * A centered spinner + label; callers pass copy, the component owns chrome.
 */
export const LoadingState = ({ label }: LoadingStateProps) => {
  const { locale } = useLocale();

  return (
    <div role="status" className="flex items-center justify-center gap-3 px-6 py-12">
      <LoadingSpinner className={textColors.tertiary} />
      <span className={cn('text-sm', textColors.tertiary)}>
        {label ?? COPY[locale].common.loading}
      </span>
    </div>
  );
};
