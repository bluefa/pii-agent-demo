import type { DashboardSummary, SystemDetailListResponse, DashboardFilters } from '@/lib/types/dashboard';

const DASHBOARD_BASE = '/api/v1/admin/dashboard';

const buildParams = (filters: DashboardFilters): string => {
  const params = new URLSearchParams();
  if (filters.search) params.set('search', filters.search);
  if (filters.integration_method.length > 0) params.set('integration_method', filters.integration_method.join(','));
  if (filters.connection_status !== 'all') params.set('connection_status', filters.connection_status);
  if (filters.svc_installed !== 'all') params.set('svc_installed', filters.svc_installed);
  if (filters.sort_by) {
    params.set('sort_by', filters.sort_by);
    params.set('sort_order', filters.sort_order === 'none' ? 'asc' : filters.sort_order);
  }
  params.set('page', String(filters.page));
  params.set('size', String(filters.size));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
};

export const getDashboardSummary = async (): Promise<DashboardSummary> => {
  const res = await fetch(`${DASHBOARD_BASE}/summary`);
  if (!res.ok) throw new Error(`summary fetch failed: ${res.status}`);
  return res.json();
};

export const getDashboardSystems = async (
  filters: DashboardFilters,
): Promise<SystemDetailListResponse> => {
  const res = await fetch(`${DASHBOARD_BASE}/systems${buildParams(filters)}`);
  if (!res.ok) throw new Error(`systems fetch failed: ${res.status}`);
  return res.json();
};

export const exportDashboardCsv = async (
  filters: DashboardFilters,
): Promise<void> => {
  const res = await fetch(`${DASHBOARD_BASE}/systems/export${buildParams(filters)}`);
  if (!res.ok) throw new Error(`export failed: ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `시스템현황_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
