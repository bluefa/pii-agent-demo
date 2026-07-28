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
  infra: '인프라 작업',
  tc: 'Test Connection',
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
      testConnections: '/admin/pipelines/queue/test-connections',
      testConnection: (targetSourceId: number | string) =>
        `/admin/pipelines/queue/test-connections/${encodeURIComponent(String(targetSourceId))}`,
    },
    /** 운영 콘솔 (design/pipeline/ops-target-source-app-plan.md). */
    ops: {
      alerts: '/admin/pipelines/ops/alerts',
      services: '/admin/pipelines/ops/services',
      service: (serviceCode: string) =>
        `/admin/pipelines/ops/services/${encodeURIComponent(serviceCode)}`,
      targetSources: '/admin/pipelines/ops/target-sources',
      /** `tab` deep-links one tab open (OPS_TAB_SLUGS); omit for 진행 상태. */
      targetSource: (targetSourceId: number | string, tab?: OpsTargetTab) =>
        `/admin/pipelines/ops/target-sources/${encodeURIComponent(String(targetSourceId))}`
        + (tab ? `?tab=${tab}` : ''),
    },
  },
} as const;
