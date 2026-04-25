import { NextResponse } from 'next/server';
import {
  getMockDashboardSummary,
  getMockSystems,
  getMockSystemsCsv,
} from '@/lib/mock-dashboard';
import type { DashboardFilters, ConnectionStatusFilter, SvcInstalledFilter, SortOrder } from '@/lib/types/dashboard';

const parseFilters = (params: URLSearchParams): DashboardFilters => ({
  search: params.get('search') ?? '',
  integration_method: params.get('integration_method')?.split(',').filter(Boolean) ?? [],
  connection_status: (params.get('connection_status') as ConnectionStatusFilter) ?? 'all',
  svc_installed: (params.get('svc_installed') as SvcInstalledFilter) ?? 'all',
  sort_by: params.get('sort_by') ?? '',
  sort_order: (params.get('sort_order') as SortOrder) ?? 'none',
  page: params.get('page') ? Number(params.get('page')) : 0,
  size: params.get('size') ? Number(params.get('size')) : 20,
});

export const mockDashboard = {
  summary: async () => {
    const summary = getMockDashboardSummary();
    return NextResponse.json(summary);
  },

  systems: async (params: URLSearchParams) => {
    const filters = parseFilters(params);
    const result = getMockSystems(filters);
    return NextResponse.json(result);
  },

  systemsExport: async (params: URLSearchParams) => {
    const filters = parseFilters(params);
    const csv = getMockSystemsCsv(filters);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="dashboard-systems.csv"',
      },
    });
  },
};
