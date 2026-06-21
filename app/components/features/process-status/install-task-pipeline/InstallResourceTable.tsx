'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  bgColors,
  borderColors,
  cn,
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
import { Pagination } from '@/app/components/ui/Pagination';

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

const RESOURCE_STATUS_COLUMN_LABEL: Record<CloudProvider, string> = {
  AWS: 'Service 상태',
  Azure: 'Private Link 상태',
  GCP: '서비스 리소스 상태',
  IDC: '서비스 리소스 상태',
};

export const InstallResourceTable = ({ rows, provider }: InstallResourceTableProps) => {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const visibleRows = useMemo(
    () => rows.slice(safePage * pageSize, safePage * pageSize + pageSize),
    [rows, safePage, pageSize],
  );

  const handlePageSizeChange = useCallback((next: number) => {
    setPageSize(next);
    setPage(0);
  }, []);

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
      <div className={cn('overflow-hidden rounded-lg border', bgColors.surface, borderColors.default)}>
        <table className="w-full text-sm">
          <thead className={bgColors.muted}>
            <tr>
              <th className={TABLE_HEADER_CELL}>DB Type</th>
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
                    <span className={cn(TABLE_TAG_PILL, tagStyles.info)}>{row.databaseType}</span>
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
        page={safePage}
        pageSize={pageSize}
        totalCount={rows.length}
        onPageChange={setPage}
        onPageSizeChange={handlePageSizeChange}
      />
    </div>
  );
};
