/**
 * PlPagination — [‹ 이전] {page} / {pages} [다음 ›] (design-inventory §5).
 * Ghost sm buttons disabled at the bounds; pager-count 12/weak/tabular.
 */
import type { ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';

export interface PlPaginationProps {
  page: number;
  pages: number;
  onPrev: () => void;
  onNext: () => void;
  className?: string;
  /** Centered variant (Figma dashboard mock) — default right-aligned. */
  center?: boolean;
}

export function PlPagination({
  page,
  pages,
  onPrev,
  onNext,
  className,
  center,
}: PlPaginationProps): ReactElement {
  const { pager } = pipelineStyles;
  return (
    <div className={cn(center ? pager.barCenter : pager.bar, className)}>
      <PlButton variant="ghost" size="sm" disabled={page <= 1} onClick={onPrev}>
        <Icon name="chev-l" size="sm" /> 이전
      </PlButton>
      <span className={pager.count}>
        {page} / {pages}
      </span>
      <PlButton variant="ghost" size="sm" disabled={page >= pages} onClick={onNext}>
        다음 <Icon name="chev-r" size="sm" />
      </PlButton>
    </div>
  );
}
