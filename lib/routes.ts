export const integrationRoutes = {
  admin: '/integration/admin',
  adminDashboard: '/integration/admin/dashboard',
  taskAdmin: '/integration/task_admin',
  project: (projectId: number | string) => `/integration/projects/${projectId}`,
} as const;
