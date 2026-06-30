'use client';

import { useMemo, useState } from 'react';
import { cn, statusColors, textColors } from '@/lib/theme';
import type { ProjectSummary } from '@/lib/types';
import { InfrastructureEmptyState } from '@/app/components/features/admin/infrastructure/InfrastructureEmptyState';
import { InfraListToolbar } from '@/app/components/features/admin/v7/InfraListToolbar';
import { InfraRow } from '@/app/components/features/admin/v7/InfraRow';

interface InfraRowListProps {
  projects: ProjectSummary[];
  loading: boolean;
  actionLoading: string | null;
  onAddInfra: () => void;
  onOpenDetail: (targetSourceId: number) => void;
  onManageAction: (action: 'view' | 'delete', targetSourceId: number) => void;
  onViewApproval?: (project: ProjectSummary, e: React.MouseEvent) => void;
  onConfirmCompletion: (targetSourceId: number, e: React.MouseEvent) => void;
}

const matchesQuery = (project: ProjectSummary, query: string): boolean => {
  if (!query) return true;
  const haystack = [
    project.cloudProvider,
    project.projectCode,
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
  actionLoading,
  onAddInfra,
  onOpenDetail,
  onManageAction,
  onViewApproval,
  onConfirmCompletion,
}: InfraRowListProps) => {
  const [query, setQuery] = useState('');
  const filtered = useMemo(
    () => projects.filter((p) => matchesQuery(p, query)),
    [projects, query],
  );

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
      <InfraListToolbar
        totalCount={projects.length}
        query={query}
        onQueryChange={setQuery}
      />
      {filtered.length === 0 ? (
        <div className={cn('py-10 text-center text-sm', textColors.tertiary)}>
          검색 결과가 없습니다.
        </div>
      ) : (
        filtered.map((project) => (
          <InfraRow
            key={project.id}
            project={project}
            actionLoading={actionLoading}
            onConfirmCompletion={onConfirmCompletion}
            onViewApproval={onViewApproval}
            onManageAction={onManageAction}
            onOpenDetail={onOpenDetail}
          />
        ))
      )}
    </div>
  );
};
