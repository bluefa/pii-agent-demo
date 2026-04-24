'use client';

import type { ColumnDef } from './types';
import { PillTag } from './PillTag';
import { StatusBadge } from './StatusBadge';

export const columns: ColumnDef[] = [
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
