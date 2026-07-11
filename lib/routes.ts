/**
 * App routes WITHOUT the `/integration` prefix. `basePath: '/integration'`
 * (next.config.ts) is applied automatically by `next/link`, `router`, and
 * `redirect`, and `usePathname()` returns paths with it stripped — so these
 * values are the basePath-relative source of truth for both navigation and
 * active-route matching. Never hardcode `/integration` in navigation.
 */
export const integrationRoutes = {
  services: '/services',
  adminDashboard: '/admin/dashboard',
  adminGuides: '/admin/guides',
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
    target: (targetSourceId: number | string) =>
      `/admin/pipelines/targets/${encodeURIComponent(String(targetSourceId))}`,
    pipeline: (pipelineId: number | string) =>
      `/admin/pipelines/${encodeURIComponent(String(pipelineId))}`,
  },
} as const;
