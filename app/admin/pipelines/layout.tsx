'use client';

/**
 * Admin Pipeline section layout (LIN-25) — dark 216px sidebar + light content
 * area (design-inventory §1). Nests inside app/integration/admin/layout.tsx
 * (which renders the real TopNav); the prototype's decorative "PII Admin"
 * topnav is intentionally NOT ported. Dashboard / services are the only sidebar
 * items — target & pipeline detail are drill-downs (no active item).
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { integrationRoutes } from '@/lib/routes';
import { PlToastProvider } from '@/app/admin/pipelines/_components/PlToastProvider';

const SIDEBAR_ITEMS = [
  { label: '대시보드', href: integrationRoutes.pipelines.dashboard, exact: true },
  { label: '서비스·대상 검색', href: integrationRoutes.pipelines.services, exact: false },
] as const;

export default function PipelinesLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '';
  const { layout } = pipelineStyles;
  const isDashboard = pathname === integrationRoutes.pipelines.dashboard;
  // Pipeline detail = a single dynamic segment under the base (not `services`,
  // not `targets/…`); it gets the fluid full-height column so its flow canvas
  // fills the viewport. Dashboard is fluid too; everything else stays capped.
  const rest = pathname.startsWith(`${integrationRoutes.pipelines.dashboard}/`)
    ? pathname.slice(integrationRoutes.pipelines.dashboard.length + 1)
    : '';
  const isDetail = rest !== '' && !rest.includes('/') && rest !== 'services';
  const mainClass = isDashboard ? layout.contentFluid : isDetail ? layout.contentDetail : layout.content;

  return (
    <div className={layout.shell}>
      <nav className={layout.sidebar} aria-label="파이프라인 내비게이션">
        <span className={layout.sidebarTitle}>파이프라인</span>
        {SIDEBAR_ITEMS.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(layout.sidebarItem, active ? layout.sidebarItemActive : layout.sidebarItemIdle)}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <main className={mainClass}>
        <PlToastProvider>{children}</PlToastProvider>
      </main>
    </div>
  );
}
