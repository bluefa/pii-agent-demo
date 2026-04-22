export const integrationRoutes = {
  admin: '/integration/admin',
  adminDashboard: '/integration/admin/dashboard',
  taskAdmin: '/integration/task_admin',
  project: (projectId: number | string) => `/integration/projects/${projectId}`,
  credentials: '/integration/credentials',
  piiTag: '/integration/pii-tag',
  piiMap: '/integration/pii-map',
} as const;
