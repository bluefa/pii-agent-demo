/**
 * App routes WITHOUT the `/pass` prefix. `basePath: '/pass'`
 * (next.config.ts) is applied automatically by `next/link`, `router`, and
 * `redirect`, and `usePathname()` returns paths with it stripped — so these
 * values are the basePath-relative source of truth for both navigation and
 * active-route matching. Never hardcode `/pass` in navigation.
 */
/**
 * Target Source 운영 상세의 탭. The slug is the URL contract (`?tab=`), so a tab
 * is linkable, shareable, and survives reload / back-forward. Labels are the UI
 * text and may be reworded without breaking any existing link.
 */
export const OPS_TAB_SLUGS = {
  status: '진행 상태',
  scan: '스캔',
  request: '연동 요청 정보',
  confirm: '확정 정보',
  infra: '인프라 작업',
  tc: 'Test Connection',
  approval: '관리자 승인',
} as const;

export type OpsTargetTab = keyof typeof OPS_TAB_SLUGS;
export type OpsTargetTabLabel = (typeof OPS_TAB_SLUGS)[OpsTargetTab];

/** `?tab=` value → label. Unknown / missing falls back to the first tab. */
export const opsTabLabel = (slug: string | undefined): OpsTargetTabLabel =>
  OPS_TAB_SLUGS[(slug ?? '') as OpsTargetTab] ?? OPS_TAB_SLUGS.status;

/** label → `?tab=` value (the tab strip writes the URL back). */
export const opsTabSlug = (label: OpsTargetTabLabel): OpsTargetTab =>
  (Object.keys(OPS_TAB_SLUGS) as OpsTargetTab[]).find((k) => OPS_TAB_SLUGS[k] === label)
  ?? 'status';

export const passRoutes = {
  services: '/services',
  adminDashboard: '/admin/dashboard',
  taskAdmin: '/task_admin',
  targetSource: (targetSourceId: number | string) => `/target-sources/${targetSourceId}`,
  credentials: '/credentials',
  piiTag: '/pii-tag',
  piiMap: '/pii-map',
  /** 내 권한 요청 — 관리자 화면이 아니다. `/admin/**` 게이트 밖에 있어야 권한이 없는
   *  사용자가 들어올 수 있다(그게 이 화면의 대상이다). @see passRoutes.pipelines.access */
  accessRequests: '/access-requests',
  /**
   * 공지사항 · FAQ. `?type=NOTICE|FAQ` switches the same route from the
   * side-by-side cards to one full list — the listing is a view of this page,
   * not a second page with its own copy of the fetching.
   */
  notices: '/notices',
  /**
   * 게시글 관리 (목록 · 고정 · 숨김 · Category).
   * `/admin/pipelines/**` 안에 있는 이유는 그 아래가 관리자 콘솔의 셸이기 때문이다
   * — 사이드바가 거기 붙어 있어서, 밖에 두면 메뉴에서 갈 수는 있어도 도착하는
   * 순간 메뉴가 사라진다. 같은 이유로 Task Queue · 운영 콘솔도 파이프라인이
   * 아니면서 이 아래에 있다.
   */
  adminPosts: '/admin/pipelines/posts',
  /**
   * 등록 · 수정은 모달이 아니라 페이지다 — 언어 탭 두 벌과 본문 에디터,
   * 이미지 업로드가 한 화면에 들어가서 모달 폭에서는 라벨 열이 무너진다.
   */
  adminPostNew: (type: 'NOTICE' | 'FAQ') => `/admin/pipelines/posts/new?type=${type}`,
  adminPostEdit: (postId: number | string) => `/admin/pipelines/posts/${postId}`,
  /**
   * LIN-25 Admin Pipeline routes (app/admin/pipelines/**). Page mapping per
   * docs/api/pipeline-orchestrator-bff.md §2. Detail URLs carry the path id ONLY
   * (R20 — no query-param nav-context; pages derive service names from the API).
   */
  pipelines: {
    dashboard: '/admin/pipelines',
    services: '/admin/pipelines/services',
    // Service-scoped deep link (R20 — code in the path, no query context). The
    // list route above stays valid: the page is an optional catch-all serving
    // both `/services` and `/services/{code}`.
    service: (serviceCode: string) =>
      `/admin/pipelines/services/${encodeURIComponent(serviceCode)}`,
    pipeline: (pipelineId: number | string) =>
      `/admin/pipelines/${encodeURIComponent(String(pipelineId))}`,
    /** Admin Task Queue (design/pipeline/admin-taskqueue-storyboard.md). The
     * static `queue` segment wins over `[pipelineId]` route matching. */
    queue: {
      dashboard: '/admin/pipelines/queue',
      requests: '/admin/pipelines/queue/requests',
      request: (targetSourceId: number | string) =>
        `/admin/pipelines/queue/requests/${encodeURIComponent(String(targetSourceId))}`,
    },
    /** 운영 콘솔 (design/pipeline/ops-target-source-app-plan.md). */
    ops: {
      alerts: '/admin/pipelines/ops/alerts',
      services: '/admin/pipelines/ops/services',
      service: (serviceCode: string) =>
        `/admin/pipelines/ops/services/${encodeURIComponent(serviceCode)}`,
      /**
       * 단건 운영 화면만 라우팅한다 — 목록 화면은 없다(진입은 서비스 운영의 인프라 행과
       * 파이프라인 상세 breadcrumb). `tab` 은 한 탭을 열어둔다(OPS_TAB_SLUGS); 생략하면 진행 상태.
       */
      targetSource: (targetSourceId: number | string, tab?: OpsTargetTab) =>
        `/admin/pipelines/ops/target-sources/${encodeURIComponent(String(targetSourceId))}`
        + (tab ? `?tab=${tab}` : ''),
    },
    /** 접근 권한 — 관리자 화면들 (docs/api/access-assumed-contracts.md). 요청자 본인의
     *  화면은 admin 게이트 밖에 있다 — `passRoutes.accessRequests`. */
    access: {
      services: '/admin/pipelines/access/services',
      /** 서비스별 권한 deep link — services 페이지가 optional catch-all 이라 둘 다 유효하다. */
      service: (serviceCode: string) =>
        `/admin/pipelines/access/services/${encodeURIComponent(serviceCode)}`,
      admins: '/admin/pipelines/access/admins',
      requests: '/admin/pipelines/access/requests',
      request: (requestId: number | string) =>
        `/admin/pipelines/access/requests/${encodeURIComponent(String(requestId))}`,
    },
  },
} as const;
