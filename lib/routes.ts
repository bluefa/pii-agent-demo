export const integrationRoutes = {
  admin: '/integration/admin',
  adminDashboard: '/integration/admin/dashboard',
  adminGuides: '/integration/admin/guides',
  taskAdmin: '/integration/task_admin',
  targetSource: (targetSourceId: number | string) => `/integration/target-sources/${targetSourceId}`,
  credentials: '/integration/credentials',
  piiTag: '/integration/pii-tag',
  piiMap: '/integration/pii-map',
} as const;
