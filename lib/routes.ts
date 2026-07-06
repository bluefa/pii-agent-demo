export const integrationRoutes = {
  services: '/integration/services',
  adminDashboard: '/integration/admin/dashboard',
  adminGuides: '/integration/admin/guides',
  taskAdmin: '/integration/task_admin',
  targetSource: (targetSourceId: number | string) => `/integration/target-sources/${targetSourceId}`,
  credentials: '/integration/credentials',
  piiTag: '/integration/pii-tag',
  piiMap: '/integration/pii-map',
  /**
   * LIN-25 Admin Pipeline routes (app/integration/admin/pipelines/**). Page
   * mapping per docs/api/pipeline-orchestrator-bff.md §2. Detail URLs carry the
   * path id ONLY (R20 — no query-param nav-context; pages derive service names
   * from the API).
   */
  pipelines: {
    dashboard: '/integration/admin/pipelines',
    services: '/integration/admin/pipelines/services',
    target: (targetSourceId: number | string) =>
      `/integration/admin/pipelines/targets/${encodeURIComponent(String(targetSourceId))}`,
    pipeline: (pipelineId: number | string) =>
      `/integration/admin/pipelines/${encodeURIComponent(String(pipelineId))}`,
  },
} as const;
