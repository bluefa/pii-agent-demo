'use client';

import type { ProjectSummary } from '@/lib/types';
import { cn, statusColors } from '@/lib/theme';
import { InfraCard } from './InfraCard';
import { InfrastructureEmptyState } from './InfrastructureEmptyState';

interface InfrastructureListProps {
  projects: ProjectSummary[];
  loading: boolean;
  onAddInfra: () => void;
  onOpenDetail: (targetSourceId: number) => void;
  onManageAction: (action: 'view' | 'delete', targetSourceId: number) => void;
  actionLoading: string | null;
  onConfirmCompletion: (targetSourceId: number, e: React.MouseEvent) => void;
  onViewApproval?: (project: ProjectSummary, e: React.MouseEvent) => void;
}

export const InfrastructureList = ({
  projects,
  loading,
  onAddInfra,
  onOpenDetail,
  onManageAction,
  actionLoading,
  onConfirmCompletion,
  onViewApproval,
}: InfrastructureListProps) => {
  if (loading) {
    return (
      <div className="p-12 text-center">
        <div
          className={cn(
            'w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-3',
            statusColors.info.border,
          )}
        />
        <p className="text-gray-500 text-sm">로딩 중...</p>
      </div>
    );
  }

  if (projects.length === 0) {
    return <InfrastructureEmptyState onAddInfra={onAddInfra} />;
  }

  return (
    <div>
      {projects.map((project) => (
        <InfraCard
          key={project.id}
          project={project}
          actionLoading={actionLoading}
          onConfirmCompletion={onConfirmCompletion}
          onViewApproval={onViewApproval}
          onManageAction={onManageAction}
          onOpenDetail={onOpenDetail}
        />
      ))}
    </div>
  );
};
