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
import { getAccessRequests } from '@/app/lib/api/access';

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
  {
    // 접근 권한 (docs/api/access-assumed-contracts.md).
    // 내 권한 요청(요청자 본인 화면)은 여기 없다 — `/admin/**` 게이트는 ADMIN 허용
    // 목록이고, 권한을 요청해야 하는 사람은 정확히 그 게이트가 막는 쪽이다. 그 화면은
    // `passRoutes.accessRequests` 에 있고 계정 카드(UserChip)에서 연다.
    title: '접근 권한',
    items: [
      { label: '서비스별 권한', href: passRoutes.pipelines.access.services, exact: false },
      { label: '관리자 권한', href: passRoutes.pipelines.access.admins, exact: true },
      { label: '권한 요청', href: passRoutes.pipelines.access.requests, exact: false },
    ],
  },
] as const;

/** Counts the nav badges read. */
interface NavCounts {
  pendingApprovals: number;
  alertCount: number;
  pendingAccessRequests: number;
}

/** Which nav items carry a count badge, and what they count. */
const NAV_BADGES: Record<string, { label: string; count: (c: NavCounts) => number }> = {
  [passRoutes.pipelines.queue.requests]: {
    label: '승인 대기 연동 요청',
    count: (c) => c.pendingApprovals,
  },
  [passRoutes.pipelines.ops.alerts]: {
    label: '조치가 필요한 대상',
    count: (c) => c.alertCount,
  },
  [passRoutes.pipelines.access.requests]: {
    label: '승인 대기 접근 권한 요청',
    count: (c) => c.pendingAccessRequests,
  },
};

/**
 * Nav count badge. `--pl-err` is the section's dot/bar red — it is sized for a mark,
 * and as a FILL carrying white letters it measures 3.76:1, under AA. `--pl-err-solid`
 * is the red that already exists for exactly this job (white text on the destructive
 * buttons) and reads 4.83:1. Named rather than inlined so the pair stays on one line
 * where the design hook can see both halves of it.
 */
const NAV_BADGE_CLASS =
  'inline-block min-w-[18px] flex-none rounded-full bg-[var(--pl-err-solid)] px-1.5 py-px text-center text-[11px] font-bold tabular-nums text-[var(--pl-white)]'; // design-exempt: 11px is the badge's pre-existing size

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
  const [pendingAccessRequests, setPendingAccessRequests] = useState(0);
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
    // 접근 권한 요청은 dashboard-summary 에 없다 — size=1 로 totalElements 만 읽는다.
    // 같은 신호(내비게이션 · refreshCounts)를 타므로 승인 직후 목록으로 돌아오면
    // 배지도 함께 내려간다.
    getAccessRequests('PENDING', 0, { signal: controller.signal, size: 1 })
      .then((paged) => {
        if (controller.signal.aborted) return;
        setPendingAccessRequests(paged.totalElements);
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
    rest === 'services' ||
    rest.startsWith('services/') ||
    rest.startsWith('ops/services') ||
    // 서비스별 권한 uses the same rail | sheet split, so it needs the same fluid width.
    rest.startsWith('access/services');
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

  // …and its ground drops one ramp step. Only on this route does a full-bleed white
  // masthead sit directly on the body, and white-on-#F9FAFB is 1.045:1 — the masthead
  // and the body cards were literally the same color (1.000:1), with 24px of ground
  // as the only separator. Tinting the ground (not the masthead) is what buys the
  // separation without spending a ramp step: the chrome stays the brightest surface,
  // so the 코드 chip and 설치모드 tag keep their own --pl-gray-100 fills, and the body
  // cards gain the same 1.102:1 against their ground. The masthead's `-mt-6 -mx-8`
  // already covers main's padding box, so it paints over this fill on its own.
  const groundClass = isOpsTarget ? 'bg-[var(--pl-gray-100)]' : undefined;

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
              const count = badge
                ? badge.count({ pendingApprovals, alertCount, pendingAccessRequests })
                : 0;
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
                      className={NAV_BADGE_CLASS}
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
      <main className={cn(mainClass, groundClass)}>
        <NavCountsRefreshProvider value={refreshCounts}>
          <PlToastProvider>{children}</PlToastProvider>
        </NavCountsRefreshProvider>
      </main>
    </div>
  );
}
