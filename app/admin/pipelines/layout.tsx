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

// Item glyphs — the same visual language as TopNav's NAV_ITEMS (16px box,
// 24 viewBox, 1.8 stroke, currentColor): each glyph inherits its row's
// idle/active text color. Defined inline like TopNav's, not in ui/icons/ —
// nav metaphors are this layout's concern, not a shared vocabulary.
const NAV_ICON_PROPS = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

const SIDEBAR_GROUPS = [
  {
    title: '인프라 작업',
    items: [
      {
        label: '대시보드',
        icon: (
          <svg {...NAV_ICON_PROPS} aria-hidden="true">
            <rect x="3.5" y="3.5" width="7" height="7" rx="1" />
            <rect x="13.5" y="3.5" width="7" height="7" rx="1" />
            <rect x="3.5" y="13.5" width="7" height="7" rx="1" />
            <rect x="13.5" y="13.5" width="7" height="7" rx="1" />
          </svg>
        ),
        href: passRoutes.pipelines.dashboard,
        exact: true,
      },
      {
        label: '서비스·대상 검색',
        icon: (
          <svg {...NAV_ICON_PROPS} aria-hidden="true">
            <circle cx="11" cy="11" r="5.5" />
            <path d="M15.2 15.2 20 20" />
          </svg>
        ),
        href: passRoutes.pipelines.services,
        exact: false,
      },
    ],
  },
  {
    title: 'Task Queue',
    items: [
      {
        label: '운영 대시보드',
        icon: (
          <svg {...NAV_ICON_PROPS} aria-hidden="true">
            <path d="M3 12h4l3-7 4 14 3-7h4" />
          </svg>
        ),
        href: passRoutes.pipelines.queue.dashboard,
        exact: true,
      },
      {
        label: '연동 요청',
        icon: (
          <svg {...NAV_ICON_PROPS} aria-hidden="true">
            <path d="M22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6" />
            <path d="M2 12h6l2 3h4l2-3h6" />
            <path d="M12 3v6M9.5 6.5 12 9l2.5-2.5" />
          </svg>
        ),
        href: passRoutes.pipelines.queue.requests,
        exact: false,
      },
    ],
  },
  {
    title: '운영 콘솔',
    items: [
      {
        label: '운영 알림',
        icon: (
          <svg {...NAV_ICON_PROPS} aria-hidden="true">
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
        ),
        href: passRoutes.pipelines.ops.alerts,
        exact: false,
      },
      {
        label: '서비스 운영',
        icon: (
          <svg {...NAV_ICON_PROPS} aria-hidden="true">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
        ),
        href: passRoutes.pipelines.ops.services,
        exact: false,
      },
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
      {
        label: '서비스별 권한',
        icon: (
          <svg {...NAV_ICON_PROPS} aria-hidden="true">
            <path d="M12 3l8 3v5.5c0 4.6-3.3 7.8-8 9.5-4.7-1.7-8-4.9-8-9.5V6l8-3z" />
            <path d="M9 11.5l2 2 4-4" />
          </svg>
        ),
        href: passRoutes.pipelines.access.services,
        exact: false,
      },
      {
        label: '관리자 권한',
        icon: (
          <svg {...NAV_ICON_PROPS} aria-hidden="true">
            <circle cx="12" cy="8" r="3.8" />
            <path d="M4.5 20.5c.8-3.6 3.9-5.5 7.5-5.5s6.7 1.9 7.5 5.5" />
          </svg>
        ),
        href: passRoutes.pipelines.access.admins,
        exact: true,
      },
      {
        label: '권한 요청',
        icon: (
          <svg {...NAV_ICON_PROPS} aria-hidden="true">
            <circle cx="7.5" cy="15.5" r="3.8" />
            <path d="M10.5 12.5 20 3M16 7l3 3" />
          </svg>
        ),
        href: passRoutes.pipelines.access.requests,
        exact: false,
      },
    ],
  },
  {
    title: '게시판',
    items: [
      // 등록·수정(`posts/new`, `posts/{id}`)은 이 목록에서만 들어가는 드릴다운이라
      // 항목을 따로 두지 않는다 — `exact: false` 가 그 화면들에서도 활성을 유지한다.
      {
        label: '공지사항 · FAQ',
        icon: (
          <svg {...NAV_ICON_PROPS} aria-hidden="true">
            <path d="M3 11l17-7v16L3 13v-2z" />
            <path d="M7.5 13.8V19a1 1 0 0 0 1 1H10v-5.3" />
          </svg>
        ),
        href: passRoutes.adminPosts,
        exact: false,
      },
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
  // 단일 세그먼트 중 파이프라인 id 가 아닌 것들은 빼야 한다. 빼지 않으면 게시판
  // 목록이 상한 없는 `contentDetail` 을 받아 넓은 화면에서 카드 두 장이 1440 을
  // 넘어가고, 바로 아래 `posts/new` 는 상한을 받아 두 화면 폭이 어긋난다.
  const SECTION_SEGMENTS = ['services', 'queue', 'posts'];
  const isDetail = rest !== '' && !rest.includes('/') && !SECTION_SEGMENTS.includes(rest);
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
  // 게시판은 `content` 기본값을 그대로 쓴다 — 화면 쪽이 `postStyles.sectionPage`
  // 로 자기 여백을 비워 두어서, 제목이 옆 메뉴의 화면들과 같은 x 에 선다.
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
                  )}
                >
                  {item.icon}
                  {/* flex-1 pushes the count badge to the right edge. */}
                  <span className="flex-1">{item.label}</span>
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
      <main className={mainClass}>
        <NavCountsRefreshProvider value={refreshCounts}>
          <PlToastProvider>{children}</PlToastProvider>
        </NavCountsRefreshProvider>
      </main>
    </div>
  );
}
