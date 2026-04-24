import type { DashboardFilters } from '@/app/components/features/dashboard/types';

export const INTEGRATION_OPTIONS = ['AWS', 'Azure', 'GCP', '수동조사'];

export const STATUS_OPTIONS: { label: string; value: DashboardFilters['connection_status'] }[] = [
  { label: '전체', value: 'all' },
  { label: 'Healthy만', value: 'healthy' },
  { label: 'Unhealthy 포함', value: 'unhealthy' },
  { label: '미연동', value: 'none' },
];

export const SVC_INSTALLED_OPTIONS: { label: string; value: DashboardFilters['svc_installed'] }[] = [
  { label: '전체', value: 'all' },
  { label: '설치완료', value: 'true' },
  { label: '미설치', value: 'false' },
];

export const DEFAULT_FILTERS: Omit<DashboardFilters, 'page' | 'size'> = {
  search: '',
  integration_method: [],
  connection_status: 'all',
  svc_installed: 'all',
  sort_by: '',
  sort_order: 'none',
};

export const SELECT_CHEVRON_BG = `url("data:image/svg+xml,%3Csvg width='14' height='14' viewBox='0 0 14 14' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M3.5 5.25L7 8.75L10.5 5.25' stroke='%239ca3af' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`;
