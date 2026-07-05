/**
 * RoundNavLink — the 28×28 round "↗" drill-down link (design `.btn.secondary.sm.round`
 * with `data-nav`). A real <Link> (not a <button>) so it navigates; styled with the
 * PlButton secondary/round chrome. Used by IdentityBar (대상) and PipelineStatusBar
 * (파이프라인 상세로 이동).
 */
import type { ReactElement } from 'react';
import Link from 'next/link';
import { cn, pipelineStyles } from '@/lib/theme';
import { Icon } from '@/app/integration/admin/pipelines/_components/icons';

export interface RoundNavLinkProps {
  href: string;
  title: string;
  className?: string;
}

export function RoundNavLink({ href, title, className }: RoundNavLinkProps): ReactElement {
  const { button } = pipelineStyles;
  return (
    <Link
      href={href}
      title={title}
      aria-label={title}
      className={cn(button.base, button.round, button.secondary, 'flex-none', className)}
    >
      <Icon name="arrow-ur" size="sm" />
    </Link>
  );
}
