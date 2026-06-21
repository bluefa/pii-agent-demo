import Link from 'next/link';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  crumbs: BreadcrumbItem[];
}

export const Breadcrumb = ({ crumbs }: BreadcrumbProps) => {
  return (
    <nav
      aria-label="breadcrumb"
      // v15 `.breadcrumb` — 13/500/#8B95A1 (toss weak), mb 16. Literal hexes are
      // Toss greys Tailwind's palette can't hit; see tossColors SSOT in lib/theme.ts.
      className="mb-4 text-[13px] font-medium text-[#8B95A1]"
    >
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
                // v15 `.breadcrumb .current` — #4E5968 (toss medium).
                <span aria-current={isLast ? 'page' : undefined} className="text-[#4E5968]">
                  {crumb.label}
                </span>
              )}
              {!isLast && (
                // v15 `.breadcrumb .sep` — margin 0 8px, color #B0B8C1 (toss faint).
                <span aria-hidden="true" className="mx-2 text-[#B0B8C1]">
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
