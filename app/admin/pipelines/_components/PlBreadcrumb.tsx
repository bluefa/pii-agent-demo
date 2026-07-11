/**
 * PlBreadcrumb — 12/weak trail with `›` separators (design-inventory §1).
 * A crumb with `href` (and not last) is a clickable Link; the last crumb is the
 * inert current page (`.cur`, 12/600); a middle crumb without href is inert text.
 */
import type { ReactElement, ReactNode } from 'react';
import Link from 'next/link';
import { cn, pipelineStyles } from '@/lib/theme';

export interface Crumb {
  label: ReactNode;
  href?: string;
}

export interface PlBreadcrumbProps {
  crumbs: Crumb[];
  className?: string;
}

export function PlBreadcrumb({ crumbs, className }: PlBreadcrumbProps): ReactElement {
  const { breadcrumb } = pipelineStyles;
  return (
    <nav className={cn(breadcrumb.base, className)} aria-label="breadcrumb">
      {crumbs.map((crumb, index) => {
        const last = index === crumbs.length - 1;
        return (
          <span key={index}>
            {index > 0 && <span className={breadcrumb.sep}>›</span>}
            {!last && crumb.href ? (
              <Link href={crumb.href} className={breadcrumb.crumb}>
                {crumb.label}
              </Link>
            ) : (
              <span
                className={last ? breadcrumb.cur : undefined}
                aria-current={last ? 'page' : undefined}
              >
                {crumb.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
