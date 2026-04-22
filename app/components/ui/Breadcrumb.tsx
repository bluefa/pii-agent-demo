import Link from 'next/link';

import { textColors } from '@/lib/theme';

interface BreadcrumbCrumb {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  crumbs: BreadcrumbCrumb[];
}

export const Breadcrumb = ({ crumbs }: BreadcrumbProps) => {
  return (
    <nav aria-label="breadcrumb" className={`text-xs ${textColors.tertiary}`}>
      <ol className="flex flex-wrap items-center">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <li key={`${crumb.label}-${index}`} className="flex items-center">
              {crumb.href ? (
                <Link href={crumb.href} className="hover:underline">
                  {crumb.label}
                </Link>
              ) : (
                <span aria-current={isLast ? 'page' : undefined} className={textColors.secondary}>
                  {crumb.label}
                </span>
              )}
              {!isLast && (
                <span aria-hidden="true" className={`mx-1.5 ${textColors.quaternary}`}>
                  ›
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
