/**
 * PlEmptyState — 40px icon circle + message + optional meta line
 * (design-inventory §5 `.empty`). `center` = vertically-centered min-h 240.
 */
import type { ReactElement, ReactNode } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { Icon, type IconName } from '@/app/admin/pipelines/_components/icons';

export interface PlEmptyStateProps {
  icon: IconName;
  message: ReactNode;
  meta?: ReactNode;
  center?: boolean;
  /** 흰 카드가 아니라 회색 바닥 위에 놓일 때 — 아이콘 판을 한 단 내린다(gray-100 은 바닥과 같은 값). */
  onGround?: boolean;
  className?: string;
}

export function PlEmptyState({
  icon,
  message,
  meta,
  center,
  onGround,
  className,
}: PlEmptyStateProps): ReactElement {
  const { empty } = pipelineStyles;
  return (
    <div className={cn(empty.base, center && empty.center, className)}>
      <span className={onGround ? empty.iconOnGround : empty.icon}>
        <Icon name={icon} size="xl" />
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
