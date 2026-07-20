/**
 * DetailLink — "상세보기" + ↗ (design spec §2/§4 `.detail-link`), used in the P2
 * 승인 대기 tab, P4 tabs, and P3 headers. Rendered as a span so the caller owns
 * navigation (whole-row click vs. anchor). The ↗ reuses the shared `arrow-up-
 * right` glyph at 14px (its M7 7h10v10 corner is a 1px-inset match for the
 * prototype's M8 7h9v9 — same stroke grammar).
 */
import type { ReactElement, ReactNode } from 'react';
import { cn } from '@/lib/theme';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { tqStyles } from '@/app/admin/pipelines/queue/_components/tqStyles';

export interface DetailLinkProps {
  /** Link text — defaults to "상세보기". */
  children?: ReactNode;
  className?: string;
}

export function DetailLink({ children = '상세보기', className }: DetailLinkProps): ReactElement {
  return (
    <span className={cn(tqStyles.detailLink, className)}>
      {children}
      <Icon name="arrow-up-right" size="sm" />
    </span>
  );
}
