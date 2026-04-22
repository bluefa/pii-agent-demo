'use client';

import type { SystemDetail, SystemDetailListResponse, DashboardFilters } from '@/app/components/features/dashboard/types';

interface SystemsTableProps {
  data: SystemDetailListResponse | null;
  loading: boolean;
  filters: DashboardFilters;
  onFiltersChange: (filters: DashboardFilters) => void;
}

type SortDirection = 'asc' | 'desc' | 'none';

interface ColumnDef {
  key: string;
  label: string;
  width: string;
  sortable: boolean;
  align?: 'left' | 'right';
  render: (row: SystemDetail) => React.ReactNode;
}

const SortIcon = ({ direction }: { direction: SortDirection }) => {
  if (direction === 'none') {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="ml-1">
        <path d="M6 2L9 5H3L6 2Z" fill="#d1d5db" />
        <path d="M6 10L3 7H9L6 10Z" fill="#d1d5db" />
      </svg>
    );
  }
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="ml-1">
      {direction === 'asc' ? (
        <path d="M6 2L9 7H3L6 2Z" fill="#0064FF" />
      ) : (
        <path d="M6 10L3 5H9L6 10Z" fill="#0064FF" />
      )}
    </svg>
  );
};

const INTEGRATION_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  AWS: { bg: '#fef3c7', text: '#92400e', border: '#fde68a' },
  Azure: { bg: '#dbeafe', text: '#1e40af', border: '#bfdbfe' },
  GCP: { bg: '#dcfce7', text: '#166534', border: '#bbf7d0' },
  IDC: { bg: '#f3e8ff', text: '#6b21a8', border: '#e9d5ff' },
  SDU: { bg: '#ffe4e6', text: '#9f1239', border: '#fecdd3' },
  '수동조사': { bg: '#f3f4f6', text: '#374151', border: '#e5e7eb' },
};

const PillTag = ({ text, variant = 'gray' }: { text: string; variant?: 'gray' | 'integration' }) => {
  if (variant === 'integration') {
    const colors = INTEGRATION_COLORS[text] ?? INTEGRATION_COLORS['수동조사'];
    return (
      <span
        className="inline-block text-xs font-medium px-2.5 py-0.5 rounded-full"
        style={{
          backgroundColor: colors.bg,
          color: colors.text,
          border: `1px solid ${colors.border}`,
        }}
      >
        {text}
      </span>
    );
  }
  return (
    <span
      className="inline-block text-xs px-2 py-0.5 rounded-full"
      style={{ backgroundColor: '#f3f4f6', color: '#6b7280' }}
    >
      {text}
    </span>
  );
};

const StatusBadge = ({ healthy, unhealthy }: { healthy: number; unhealthy: number }) => {
  if (unhealthy === 0) {
    return (
      <span
        className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
        style={{ backgroundColor: '#dcfce7', color: '#166534' }}
      >
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: '#16a34a' }}
        />
        Healthy
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
      style={{ backgroundColor: '#fef2f2', color: '#991b1b' }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: '#dc2626' }}
      />
      {unhealthy} Unhealthy
    </span>
  );
};

const columns: ColumnDef[] = [
  {
    key: 'service_name',
    label: '시스템명',
    width: 'flex-1 min-w-[180px]',
    sortable: true,
    render: (row) => (
      <div>
        <p className="text-sm font-medium" style={{ color: '#111827' }}>{row.service_name}</p>
        <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>{row.service_code}</p>
      </div>
    ),
  },
  {
    key: 'linked_sys',
    label: 'Linked Sys',
    width: 'w-[200px]',
    sortable: false,
    render: (row) => {
      const all = [...row.nirp_codes, ...row.sw_plm_codes];
      if (all.length === 0) return <span className="text-xs" style={{ color: '#d1d5db' }}>-</span>;
      return (
        <div className="flex flex-wrap gap-1">
          {all.map((code) => <PillTag key={code} text={code} />)}
        </div>
      );
    },
  },
  {
    key: 'svc_installed',
    label: '설치완료',
    width: 'w-[90px]',
    sortable: false,
    render: (row) => (
      <span
        className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full"
        style={
          row.svc_installed
            ? { backgroundColor: '#dcfce7', color: '#166534' }
            : { backgroundColor: '#f3f4f6', color: '#6b7280' }
        }
      >
        {row.svc_installed ? 'True' : 'False'}
      </span>
    ),
  },
  {
    key: 'integration_methods',
    label: '연동 방식',
    width: 'w-[180px]',
    sortable: false,
    render: (row) => (
      <div className="flex flex-wrap gap-1.5">
        {row.integration_methods.map((method) => (
          <PillTag key={method} text={method} variant="integration" />
        ))}
      </div>
    ),
  },
  {
    key: 'status',
    label: '상태',
    width: 'w-[130px]',
    sortable: false,
    render: (row) => (
      <StatusBadge healthy={row.db_status.healthy_db_count} unhealthy={row.db_status.unhealthy_db_count} />
    ),
  },
  {
    key: 'target_db_count',
    label: '대상 DB',
    width: 'w-[80px]',
    sortable: true,
    align: 'right',
    render: (row) => <span className="text-sm tabular-nums" style={{ color: '#374151' }}>{row.db_status.target_db_count}</span>,
  },
  {
    key: 'healthy_db_count',
    label: 'Healthy',
    width: 'w-[80px]',
    sortable: true,
    align: 'right',
    render: (row) => (
      <span className="text-sm font-medium tabular-nums" style={{ color: '#059669' }}>{row.db_status.healthy_db_count}</span>
    ),
  },
  {
    key: 'unhealthy_db_count',
    label: 'Unhealthy',
    width: 'w-[90px]',
    sortable: true,
    align: 'right',
    render: (row) => {
      const count = row.db_status.unhealthy_db_count;
      return (
        <span
          className="text-sm tabular-nums"
          style={{
            color: count > 0 ? '#dc2626' : '#d1d5db',
            fontWeight: count > 0 ? 600 : 400,
          }}
        >
          {count}
        </span>
      );
    },
  },
  {
    key: 'active_db_count',
    label: '연동중',
    width: 'w-[80px]',
    sortable: true,
    align: 'right',
    render: (row) => <span className="text-sm tabular-nums" style={{ color: '#374151' }}>{row.db_status.active_db_count}</span>,
  },
];

const SkeletonRow = () => (
  <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
    {columns.map((col) => (
      <td key={col.key} className="px-5 py-4">
        <div
          className="h-4 rounded animate-pulse"
          style={{ width: '60%', backgroundColor: '#f3f4f6' }}
        />
      </td>
    ))}
  </tr>
);

const Pagination = ({
  page,
  totalPages,
  totalCount,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  totalCount: number;
  onPageChange: (page: number) => void;
}) => {
  const getPageNumbers = (): (number | 'ellipsis')[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i);
    }

    const pages: (number | 'ellipsis')[] = [0];
    if (page > 2) pages.push('ellipsis');

    const start = Math.max(1, page - 1);
    const end = Math.min(totalPages - 2, page + 1);
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (page < totalPages - 3) pages.push('ellipsis');
    if (totalPages > 1) pages.push(totalPages - 1);

    return pages;
  };

  return (
    <div
      className="flex items-center justify-between px-5 py-4"
      style={{ borderTop: '1px solid #f3f4f6' }}
    >
      <span className="text-sm" style={{ color: '#6b7280' }}>
        총 <span className="font-medium" style={{ color: '#374151' }}>{totalCount.toLocaleString('ko-KR')}</span>건
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page === 0}
          onClick={() => onPageChange(page - 1)}
          aria-label="이전 페이지"
          className="w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed"
          style={{ color: '#6b7280' }}
          onMouseEnter={(e) => {
            if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = '#f3f4f6';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M8.75 3.5L5.25 7L8.75 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {getPageNumbers().map((item, idx) =>
          item === 'ellipsis' ? (
            <span key={`ellipsis-${idx}`} className="w-8 h-8 flex items-center justify-center text-sm" style={{ color: '#9ca3af' }}>
              ...
            </span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => onPageChange(item)}
              className="w-8 h-8 flex items-center justify-center text-sm rounded-lg transition-all duration-150"
              style={
                item === page
                  ? {
                      background: 'linear-gradient(135deg, #0064FF 0%, #4f46e5 100%)',
                      color: '#ffffff',
                      fontWeight: 600,
                      boxShadow: '0 1px 3px 0 rgba(0, 100, 255, 0.3)',
                    }
                  : { color: '#6b7280' }
              }
              onMouseEnter={(e) => {
                if (item !== page) e.currentTarget.style.backgroundColor = '#f3f4f6';
              }}
              onMouseLeave={(e) => {
                if (item !== page) e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              {item + 1}
            </button>
          ),
        )}

        <button
          type="button"
          disabled={page >= totalPages - 1}
          onClick={() => onPageChange(page + 1)}
          aria-label="다음 페이지"
          className="w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed"
          style={{ color: '#6b7280' }}
          onMouseEnter={(e) => {
            if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = '#f3f4f6';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M5.25 3.5L8.75 7L5.25 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
};

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

  // Loading skeleton
  if (loading) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr style={{ backgroundColor: '#f8fafc' }}>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-5 py-3.5 text-xs font-semibold uppercase tracking-wider ${col.width} ${col.align === 'right' ? 'text-right' : 'text-left'}`}
                  style={{ color: '#64748b', borderBottom: '1px solid #e2e8f0' }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // Empty state
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
                  className={`px-5 py-3.5 text-xs font-semibold uppercase tracking-wider ${col.width} ${col.align === 'right' ? 'text-right' : 'text-left'} ${col.sortable ? 'cursor-pointer select-none' : ''}`}
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
                    className={`px-5 py-4 ${col.align === 'right' ? 'text-right' : ''}`}
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
