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
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { passRoutes } from '@/lib/routes';
import { PlToastProvider } from '@/app/admin/pipelines/_components/PlToastProvider';
import { NavCountsRefreshProvider } from '@/app/admin/pipelines/_components/NavCountsRefresh';
import { getDashboardSummary } from '@/app/lib/api/task-queue';

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
    ],
  },
  {
    title: '운영 콘솔',
    items: [
      { label: '운영 알림', href: passRoutes.pipelines.ops.alerts, exact: false },
      { label: '서비스 운영', href: passRoutes.pipelines.ops.services, exact: false },
      // Target Source 운영 is deliberately absent from the nav. The screen still exists and
      // is still routed to — 서비스 운영 sends you there from an infra row, and the pipeline
      // detail breadcrumb links to it — it is simply not a place you start from.
    ],
  },
] as const;

/** Which nav items carry a count badge, and what they count. */
const NAV_BADGES: Record<
  string,
  { label: string; count: (c: { pendingApprovals: number; alertCount: number }) => number }
> = {
  [passRoutes.pipelines.queue.requests]: {
    label: '승인 대기 연동 요청',
    count: (c) => c.pendingApprovals,
  },
  [passRoutes.pipelines.ops.alerts]: {
    label: '조치가 필요한 대상',
    count: (c) => c.alertCount,
  },
};

export default function PipelinesLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '';
  const { layout } = pipelineStyles;

  // Nav count badges: 연동 요청 = 승인 대기 requests, 운영 알림 = the four Step 3~6
  // action buckets. Hidden at 0, clamped to "9+".
  // Re-read on every admin navigation, NOT on an interval (one ran on EVERY
  // admin screen, hidden tabs included). Mount alone is not enough: this is a
  // client layout, so React preserves it across in-app navigation and a
  // `[]` dep would freeze the counts for the whole session — 승인 → router.push
  // back to the list would leave the badge contradicting the list beside it.
  // `nonce` covers what navigation cannot: a screen that refreshes in place
  // (운영 알림's 새로고침) reads the same summary, so it signals us too.
  // Best-effort (errors ignored): the nav badge must never break the shell.
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [alertCount, setAlertCount] = useState(0);
  const [nonce, setNonce] = useState(0);
  const refreshCounts = useCallback(() => setNonce((n) => n + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    getDashboardSummary({ signal: controller.signal })
      .then((summary) => {
        if (controller.signal.aborted) return;
        setPendingApprovals(summary.pendingApprovalCount ?? 0);
        setAlertCount(
          (summary.confirmingCount ?? 0) +
            (summary.needInstallCount ?? 0) +
            (summary.needTestConnectionCount ?? 0) +
            (summary.needPiiAgentConfirmCount ?? 0),
        );
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [pathname, nonce]);
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
  // Split-layout pages (rail | content sheet) are fluid for the same reason: the
  // rail and its recessed ground are one surface painted on the split, and that
  // surface has to reach the viewport's right edge. Under layout.content's cap
  // it stops at 1440px and the lighter page ground shows past it — a hard
  // vertical seam on wide monitors, which is the exact thing the layered
  // treatment exists to remove.
  const isSplit =
    rest === 'services' || rest.startsWith('services/') || rest.startsWith('ops/services');
  // Target Source 운영 is fluid for the same reason: its masthead and tab rail are
  // full-bleed (opsStyles.headCard), so under the cap they stop at 1440px while the
  // page ground continues — the seam described above, on the busiest ops screen.
  const isOpsTarget = rest.startsWith('ops/target-sources');
  const mainClass =
    isDashboard || isQueue || isSplit || isOpsTarget
      ? layout.contentFluid
      : isDetail
        ? layout.contentDetail
        : layout.content;

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
              const badge = NAV_BADGES[item.href];
              const count = badge ? badge.count({ pendingApprovals, alertCount }) : 0;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    layout.sidebarItem,
                    active ? layout.sidebarItemActive : layout.sidebarItemIdle,
                    // The count badge docks right; every other item stays a plain block.
                    count > 0 && 'flex items-center justify-between gap-2',
                  )}
                >
                  {item.label}
                  {badge && count > 0 && (
                    <span
                      className="inline-block min-w-[18px] flex-none rounded-full bg-[var(--pl-err)] px-1.5 py-px text-center text-[11px] font-bold tabular-nums text-[var(--pl-white)]"
                      role="status"
                      aria-label={`${badge.label} ${count}건`}
                    >
                      {count > 9 ? '9+' : count}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <main className={mainClass}>
        <NavCountsRefreshProvider value={refreshCounts}>
          <PlToastProvider>{children}</PlToastProvider>
        </NavCountsRefreshProvider>
      </main>
    </div>
  );
}
