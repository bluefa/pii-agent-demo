/**
 * PlToast — bottom-center gray-900 toast with an i-check glyph (design-inventory
 * §Toast). Presentational: renders when `message` is non-null. Drive with
 * usePlToast (auto-dismiss 2600ms).
 */
import type { ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { Icon } from '@/app/admin/pipelines/_components/icons';

export interface PlToastProps {
  message: string | null;
  className?: string;
}

export function PlToast({ message, className }: PlToastProps): ReactElement | null {
  if (!message) return null;
  const { toast } = pipelineStyles;
  return (
    <div role="status" aria-live="polite" className={cn(toast.base, className)}>
      <Icon name="check" size="sm" className={toast.icon} />
      {message}
    </div>
  );
}
