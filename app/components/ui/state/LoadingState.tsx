'use client';

import { cn, textColors } from '@/lib/theme';
import { LoadingSpinner } from '@/app/components/ui/LoadingSpinner';

interface LoadingStateProps {
  /** Text shown next to the spinner. Defaults to a generic Korean message. */
  label?: string;
}

/**
 * ADR-018 §1 canonical `loading` state (Layer ⑧ presentational).
 * A centered spinner + label; callers pass copy, the component owns chrome.
 */
export const LoadingState = ({ label = '불러오는 중…' }: LoadingStateProps) => (
  <div className="flex items-center justify-center gap-3 px-6 py-12">
    <LoadingSpinner className={textColors.tertiary} />
    <span className={cn('text-sm', textColors.tertiary)}>{label}</span>
  </div>
);
