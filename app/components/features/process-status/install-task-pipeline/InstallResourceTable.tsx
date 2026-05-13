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
import type { InstallResourceRow } from '@/app/components/features/process-status/install-task-pipeline/join-installation-resources';
import {
  TABLE_BODY_CELL,
  TABLE_HEADER_CELL,
  TABLE_MONO_CELL,
  TABLE_TAG_PILL,
} from '@/app/components/features/process-status/install-task-pipeline/table-styles';
import { Pagination } from '@/app/components/ui/Pagination';

interface InstallResourceTableProps {
  rows: InstallResourceRow[];
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

export const InstallResourceTable = ({ rows }: InstallResourceTableProps) => {
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
              <th className={cn(TABLE_HEADER_CELL, textColors.tertiary)}>DB Type</th>
              <th className={cn(TABLE_HEADER_CELL, textColors.tertiary)}>Resource ID</th>
              <th className={cn(TABLE_HEADER_CELL, textColors.tertiary)}>Region</th>
              <th className={cn(TABLE_HEADER_CELL, textColors.tertiary)}>DB Name</th>
              <th className={cn(TABLE_HEADER_CELL, textColors.tertiary)}>서비스 리소스 상태</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr
                key={row.resourceId}
                className={cn('border-t', borderColors.light)}
              >
                <td className={TABLE_BODY_CELL}>
                  {row.databaseType ? (
                    <span className={cn(TABLE_TAG_PILL, tagStyles.info)}>{row.databaseType}</span>
                  ) : (
                    <span className={textColors.tertiary}>—</span>
                  )}
                </td>
                <td className={cn(TABLE_MONO_CELL, textColors.secondary)}>
                  {row.resourceId}
                </td>
                <td className={cn(TABLE_MONO_CELL, textColors.secondary)}>
                  {row.region ?? '—'}
                </td>
                <td className={cn(TABLE_MONO_CELL, textColors.secondary)}>
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
      {rows.length > pageSize && (
        <Pagination
          page={safePage}
          pageSize={pageSize}
          totalCount={rows.length}
          onPageChange={setPage}
          onPageSizeChange={handlePageSizeChange}
        />
      )}
    </div>
  );
};
