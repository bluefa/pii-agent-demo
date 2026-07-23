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
import { useEffect, useState, type ReactNode } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { passRoutes } from '@/lib/routes';
import { PlToastProvider } from '@/app/admin/pipelines/_components/PlToastProvider';
import { getDashboardSummary } from '@/app/lib/api/task-queue';

const NAV_ALARM_POLL_MS = 30_000;

const SIDEBAR_GROUPS = [
  {
    title: '인프라 작업',
    items: [
      { label: '대시보드', href: passRoutes.pipelines.dashboard, exact: true },
      { label: '서비스·대상 검색', href: passRoutes.pipelines.services, exact: false },
    ],
  },
  {
    title: 'Task Queue',
    items: [
      { label: '운영 대시보드', href: passRoutes.pipelines.queue.dashboard, exact: true },
      { label: '연동 요청', href: passRoutes.pipelines.queue.requests, exact: false },
      { label: '연결 테스트', href: passRoutes.pipelines.queue.testConnections, exact: false },
    ],
  },
] as const;

export default function PipelinesLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '';
  const { layout } = pipelineStyles;

  // 연동 요청 nav alarm — pending approval requests light a red dot on the menu.
  // Best-effort (errors ignored): the nav badge must never break the shell.
  const [pendingApprovals, setPendingApprovals] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const load = (): void => {
      getDashboardSummary({ signal: controller.signal })
        .then((summary) => {
          if (controller.signal.aborted) return;
          setPendingApprovals(summary.pendingApprovalCount ?? 0);
        })
        .catch(() => undefined);
    };
    load();
    const timer = setInterval(load, NAV_ALARM_POLL_MS);
    return () => {
      clearInterval(timer);
      controller.abort();
    };
  }, []);
  const isDashboard = pathname === passRoutes.pipelines.dashboard;
  // Pipeline detail = a single dynamic segment under the base (not `services`,
  // not `targets/…`); it gets the fluid full-height column so its flow canvas
  // fills the viewport. Dashboard is fluid too; everything else stays capped.
  const rest = pathname.startsWith(`${passRoutes.pipelines.dashboard}/`)
    ? pathname.slice(passRoutes.pipelines.dashboard.length + 1)
    : '';
  const isDetail = rest !== '' && !rest.includes('/') && rest !== 'services' && rest !== 'queue';
  // Task Queue pages are fluid like the dashboard — they must grow/shrink with
  // the viewport instead of capping at layout.content's max-width.
  const isQueue = rest === 'queue' || rest.startsWith('queue/');
  const mainClass =
    isDashboard || isQueue ? layout.contentFluid : isDetail ? layout.contentDetail : layout.content;

  return (
    <div className={layout.shell}>
      <nav className={layout.sidebar} aria-label="작업 내비게이션">
        {SIDEBAR_GROUPS.map((group, gi) => (
          <div key={group.title} className={gi > 0 ? 'mt-4' : undefined}>
            <span className={layout.sidebarTitle}>{group.title}</span>
            {group.items.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
              const alarm =
                item.href === passRoutes.pipelines.queue.requests && pendingApprovals > 0;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(layout.sidebarItem, active ? layout.sidebarItemActive : layout.sidebarItemIdle)}
                >
                  {item.label}
                  {alarm && (
                    <span
                      className="ml-2 inline-block h-2 w-2 flex-none rounded-full bg-[var(--pl-err)] align-middle"
                      role="status"
                      aria-label={`승인 대기 연동 요청 ${pendingApprovals}건`}
                    />
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <main className={mainClass}>
        <PlToastProvider>{children}</PlToastProvider>
      </main>
    </div>
  );
}
