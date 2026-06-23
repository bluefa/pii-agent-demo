'use client';

import {
  bgColors,
  borderColors,
  cn,
  idcStyles,
  tagStyles,
  textColors,
} from '@/lib/theme';
import type { GcpInstallationStatusValue } from '@/app/api/_lib/v1-types';
import type { CloudProvider } from '@/lib/types';
import type { InstallResourceRow } from '@/app/components/features/process-status/install-task-pipeline/join-installation-resources';
import {
  TABLE_BODY_CELL,
  TABLE_HEADER_CELL,
  TABLE_MONO_CELL,
  TABLE_TAG_PILL,
} from '@/app/components/features/process-status/install-task-pipeline/table-styles';
import { CopyButton } from '@/app/components/ui/CopyButton';
import { getDatabaseShortLabel } from '@/app/components/ui/DatabaseIcon';
import { Pagination } from '@/app/components/ui/Pagination';
import { usePagination } from '@/app/hooks/usePagination';

interface InstallResourceTableProps {
  rows: InstallResourceRow[];
  provider: CloudProvider;
}

const DEFAULT_PAGE_SIZE = 10;

const STATUS_LABEL: Record<GcpInstallationStatusValue, string> = {
  COMPLETED: '완료',
  IN_PROGRESS: '진행중',
  FAIL: '실패',
};

const STATUS_TAG: Record<GcpInstallationStatusValue, string> = {
  COMPLETED: tagStyles.success,
  IN_PROGRESS: tagStyles.warning,
  FAIL: tagStyles.error,
};

// v16 `.db-list-table` status column header per provider (HTML 6811–6813):
// Azure = 'Private Link 상태', GCP = '서비스 리소스 상태', AWS = 'VPC Endpoint 상태'.
const RESOURCE_STATUS_COLUMN_LABEL: Record<CloudProvider, string> = {
  AWS: 'VPC Endpoint 상태',
  Azure: 'Private Link 상태',
  GCP: '서비스 리소스 상태',
  IDC: '서비스 리소스 상태',
};

export const InstallResourceTable = ({ rows, provider }: InstallResourceTableProps) => {
  const { page, pageSize, setPage, setPageSize, pageItems: visibleRows } = usePagination(rows, {
    initialPageSize: DEFAULT_PAGE_SIZE,
  });

  if (rows.length === 0) {
    return (
      <div
        className={cn(
          'px-4 py-3 rounded-lg border text-sm',
          borderColors.default,
          textColors.tertiary,
        )}
      >
        설치 대상 리소스가 없습니다.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className={idcStyles.table.frame}>
        <table className="w-full text-sm">
          <thead className={bgColors.muted}>
            <tr>
              <th className={TABLE_HEADER_CELL}>Database Type</th>
              <th className={TABLE_HEADER_CELL}>Resource ID</th>
              <th className={TABLE_HEADER_CELL}>Region</th>
              <th className={TABLE_HEADER_CELL}>Resource Name</th>
              <th className={TABLE_HEADER_CELL}>
                {RESOURCE_STATUS_COLUMN_LABEL[provider]}
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr
                key={row.resourceId}
                className="border-t border-[#EBEEF2] group"
              >
                <td className={TABLE_BODY_CELL}>
                  {row.databaseType ? (
                    <span className={cn(TABLE_TAG_PILL, tagStyles.info)}>
                      {getDatabaseShortLabel(row.databaseType)}
                    </span>
                  ) : (
                    <span className={textColors.tertiary}>—</span>
                  )}
                </td>
                <td className={TABLE_MONO_CELL}>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="max-w-[280px] overflow-hidden text-ellipsis whitespace-nowrap [direction:rtl] text-left">
                      {row.resourceId}
                    </span>
                    <CopyButton
                      value={row.resourceId}
                      label={`${row.resourceId} 복사`}
                      className="opacity-0 group-hover:opacity-100"
                    />
                  </span>
                </td>
                <td className={TABLE_MONO_CELL}>
                  {row.region ?? '—'}
                </td>
                <td className={TABLE_MONO_CELL}>
                  {row.databaseName ?? '—'}
                </td>
                <td className={TABLE_BODY_CELL}>
                  <span className={cn(TABLE_TAG_PILL, STATUS_TAG[row.installationStatus])}>
                    {STATUS_LABEL[row.installationStatus]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination
        page={page}
        pageSize={pageSize}
        totalCount={rows.length}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        pageSizeOptions={[10, 20, 50, 100]}
      />
    </div>
  );
};
