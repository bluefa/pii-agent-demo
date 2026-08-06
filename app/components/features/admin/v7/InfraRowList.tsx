'use client';

import { useMemo, useState } from 'react';
import { borderColors, cn, statusColors, textColors } from '@/lib/theme';
import type { ProjectSummary } from '@/lib/types';
import { Pagination } from '@/app/components/ui/Pagination';
import { InfrastructureEmptyState } from '@/app/components/features/admin/infrastructure/InfrastructureEmptyState';
import { InfraListToolbar } from '@/app/components/features/admin/v7/InfraListToolbar';
import { InfraRow, type InfraRowAction } from '@/app/components/features/admin/v7/InfraRow';

interface InfraRowListProps {
  projects: ProjectSummary[];
  loading: boolean;
  onAddInfra: () => void;
  onOpenDetail: (targetSourceId: number) => void;
  onManageAction: (action: InfraRowAction, targetSourceId: number) => void;
}

/**
 * Five rows a page, not ten. Each row now carries the account id, its identifying
 * metadata and the description — reading one takes real attention, so the page holds
 * fewer of them. The size control is still there for anyone who wants density back.
 */
const DEFAULT_PAGE_SIZE = 5;
const PAGE_SIZE_OPTIONS = [5, 10, 20, 50] as const;

const matchesQuery = (project: ProjectSummary, query: string): boolean => {
  if (!query) return true;
  const haystack = [
    project.cloudProvider,
    project.awsAccountId ?? '',
    project.subscriptionId ?? '',
    project.gcpProjectId ?? '',
    project.tenantId ?? '',
    project.description ?? '',
    `TS-${project.targetSourceId}`,
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
};

export const InfraRowList = ({
  projects,
  loading,
  onAddInfra,
  onOpenDetail,
  onManageAction,
}: InfraRowListProps) => {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);

  const filtered = useMemo(
    () => projects.filter((p) => matchesQuery(p, query)),
    [projects, query],
  );
  // A narrowed result set can leave the current page past the end — clamp at render
  // rather than resetting in an effect, which would paint one empty frame first.
  const lastPage = Math.max(0, Math.ceil(filtered.length / pageSize) - 1);
  const safePage = Math.min(page, lastPage);
  const visible = filtered.slice(safePage * pageSize, safePage * pageSize + pageSize);

  if (loading && projects.length === 0) {
    return (
      <div className="p-12 text-center">
        <div
          className={cn(
            'w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-3',
            statusColors.info.border,
          )}
        />
        <p className={cn('text-sm', textColors.tertiary)}>로딩 중...</p>
      </div>
    );
  }

  if (projects.length === 0) {
    return <InfrastructureEmptyState onAddInfra={onAddInfra} />;
  }

  return (
    <div aria-busy={loading}>
      {/* One sheet: header, rows and pager share a single border. Pagination owns the
          bottom edge and radius, so the sheet stops its own border above it.
          No `overflow-hidden` here — it would clip a bottom row's ⋮ menu. The header
          rounds its own top corners instead, which is all the clipping the sheet needed. */}
      <div className={cn('rounded-t-[10px] border border-b-0', borderColors.default)}>
        <InfraListToolbar
          totalCount={filtered.length}
          query={query}
          onQueryChange={(next) => {
            setQuery(next);
            setPage(0);
          }}
        />
        {visible.length === 0 ? (
          <div className={cn('py-10 text-center text-sm', textColors.tertiary)}>
            검색 결과가 없습니다.
          </div>
        ) : (
          visible.map((project) => (
            <InfraRow
              key={project.id}
              project={project}
              onManageAction={onManageAction}
              onOpenDetail={onOpenDetail}
            />
          ))
        )}
      </div>
      <Pagination
        page={safePage}
        pageSize={pageSize}
        totalCount={filtered.length}
        onPageChange={setPage}
        onPageSizeChange={(next) => {
          setPageSize(next);
          setPage(0);
        }}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
        controls="prevNext"
      />
    </div>
  );
};
