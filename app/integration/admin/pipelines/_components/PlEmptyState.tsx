/**
 * PlEmptyState — 40px icon circle + message + optional meta line
 * (design-inventory §5 `.empty`). `center` = vertically-centered min-h 240.
 */
import type { ReactElement, ReactNode } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { Icon, type IconName } from '@/app/integration/admin/pipelines/_components/icons';

export interface PlEmptyStateProps {
  icon: IconName;
  message: ReactNode;
  meta?: ReactNode;
  center?: boolean;
  className?: string;
}

export function PlEmptyState({ icon, message, meta, center, className }: PlEmptyStateProps): ReactElement {
  const { empty } = pipelineStyles;
  return (
    <div className={cn(empty.base, center && empty.center, className)}>
      <span className={empty.icon}>
        <Icon name={icon} size="lg" />
      </span>
      {message}
      {meta != null && (
        <>
          <br />
          <span className={empty.meta}>{meta}</span>
        </>
      )}
    </div>
  );
}
