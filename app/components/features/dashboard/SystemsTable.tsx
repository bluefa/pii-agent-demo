'use client';

import type { SystemDetailListResponse, DashboardFilters } from '@/app/components/features/dashboard/types';
import { cn } from '@/lib/theme';
import {
  SortIcon,
  SkeletonRow,
  Pagination,
  columns,
  type SortDirection,
} from '@/app/components/features/dashboard/systems-table';

interface SystemsTableProps {
  data: SystemDetailListResponse | null;
  loading: boolean;
  filters: DashboardFilters;
  onFiltersChange: (filters: DashboardFilters) => void;
}

const SystemsTable = ({ data, loading, filters, onFiltersChange }: SystemsTableProps) => {
  const handleSort = (key: string) => {
    let nextOrder: SortDirection;
    if (filters.sort_by !== key) {
      nextOrder = 'asc';
    } else if (filters.sort_order === 'asc') {
      nextOrder = 'desc';
    } else {
      nextOrder = 'none';
    }

    onFiltersChange({
      ...filters,
      sort_by: nextOrder === 'none' ? '' : key,
      sort_order: nextOrder,
    });
  };

  const handlePageChange = (page: number) => {
    onFiltersChange({ ...filters, page });
  };

  const getSortDirection = (key: string): SortDirection => {
    if (filters.sort_by !== key) return 'none';
    return filters.sort_order === 'none' ? 'none' : filters.sort_order;
  };

  if (loading) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr style={{ backgroundColor: '#f8fafc' }}>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn('px-5 py-3.5 text-xs font-semibold uppercase tracking-wider', col.width, col.align === 'right' ? 'text-right' : 'text-left')}
                  style={{ color: '#64748b', borderBottom: '1px solid #e2e8f0' }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* static skeleton — index key OK */}
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (!data || data.systems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
          style={{ backgroundColor: '#f3f4f6' }}
        >
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <rect x="4" y="7" width="24" height="18" rx="2" stroke="#d1d5db" strokeWidth="1.5" />
            <line x1="4" y1="12" x2="28" y2="12" stroke="#d1d5db" strokeWidth="1.5" />
            <line x1="12" y1="12" x2="12" y2="25" stroke="#d1d5db" strokeWidth="1.5" />
          </svg>
        </div>
        <p className="text-sm font-medium" style={{ color: '#6b7280' }}>등록된 시스템이 없습니다</p>
        <p className="text-xs mt-1" style={{ color: '#9ca3af' }}>검색 조건을 변경하거나 필터를 초기화해 보세요</p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr style={{ backgroundColor: '#f8fafc' }}>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn('px-5 py-3.5 text-xs font-semibold uppercase tracking-wider', col.width, col.align === 'right' ? 'text-right' : 'text-left', col.sortable && 'cursor-pointer select-none')}
                  style={{ color: '#64748b', borderBottom: '1px solid #e2e8f0' }}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                  onMouseEnter={(e) => {
                    if (col.sortable) e.currentTarget.style.color = '#0f172a';
                  }}
                  onMouseLeave={(e) => {
                    if (col.sortable) e.currentTarget.style.color = '#64748b';
                  }}
                >
                  <span className="inline-flex items-center">
                    {col.label}
                    {col.sortable && <SortIcon direction={getSortDirection(col.key)} />}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.systems.map((row) => (
              <tr
                key={row.service_code}
                className="transition-colors duration-150 cursor-default"
                style={{ borderBottom: '1px solid #f3f4f6' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f0f7ff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn('px-5 py-4', col.align === 'right' && 'text-right')}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination
        page={data.page}
        totalPages={data.total_pages}
        totalCount={data.total_count}
        onPageChange={handlePageChange}
      />
    </>
  );
};

export default SystemsTable;
