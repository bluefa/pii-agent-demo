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
   * mapping per docs/api/pipeline-orchestrator-bff.md §2. Nav-context query
   * params (svc / svcName) are appended by lib/pipeline/format buildTargetHref /
   * buildPipelineHref — keep the bare path builders here as the SSOT.
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
