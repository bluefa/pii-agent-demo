'use client';

import {
  cn,
  textColors,
  bgColors,
  interactiveColors,
} from '@/lib/theme';
import type { CloudProvider, ProjectSummary } from '@/lib/types';
import { ManagementSplitButton } from '@/app/components/features/admin/infrastructure/ManagementSplitButton';
import { ProviderLogo } from '@/app/components/features/admin/v7/ProviderLogo';

const MONITORING_LABEL: Record<CloudProvider, string> = {
  AWS: 'AWS Agent',
  Azure: 'Azure Agent',
  GCP: 'GCP Agent',
  IDC: 'IDC Agent',
};

interface InfraRowProps {
  project: ProjectSummary;
  onOpenDetail: (targetSourceId: number) => void;
  onManageAction: (action: 'view' | 'delete', targetSourceId: number) => void;
}

export const InfraRow = ({
  project,
  onOpenDetail,
  onManageAction,
}: InfraRowProps) => {
  const handleRowClick = () => onOpenDetail(project.targetSourceId);

  // The row is a click target but not a focusable button — WAI-ARIA forbids
  // interactive descendants (ManagementSplitButton) inside a role="button"
  // wrapper. Keyboard activation of "open detail" lives on the
  // ManagementSplitButton primary action so tab-order users can still reach it.
  return (
    <div
      onClick={handleRowClick}
      className={cn(
        'group relative grid items-center gap-4 cursor-pointer',
        'grid-cols-[minmax(160px,1fr)_minmax(180px,1.4fr)_minmax(120px,1fr)_104px]',
        bgColors.surface,
        interactiveColors.unselectedBorder,
        'border rounded-[12px] px-4 py-3 mb-2.5 transition-colors',
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <ProviderLogo provider={project.cloudProvider} />
        <div className="min-w-0">
          <div className={cn('text-sm font-semibold', textColors.primary)}>
            {project.cloudProvider}
          </div>
          <div className={cn('text-[11px]', textColors.tertiary)}>
            TS-{project.targetSourceId}
          </div>
        </div>
      </div>

      <div className="min-w-0">
        <div className={cn('text-[11px]', textColors.tertiary)}>설명</div>
        <div className={cn('text-sm font-medium truncate', textColors.primary)}>
          {project.description || '—'}
        </div>
      </div>

      <div className="min-w-0">
        <div className={cn('text-[11px]', textColors.tertiary)}>모니터링</div>
        <div className={cn('text-sm', textColors.primary)}>
          {MONITORING_LABEL[project.cloudProvider]}
        </div>
      </div>

      <div
        className="flex items-center justify-end gap-1"
        onClick={(e) => e.stopPropagation()}
      >
        <ManagementSplitButton
          onPrimary={() => onOpenDetail(project.targetSourceId)}
          onViewDetail={() => onManageAction('view', project.targetSourceId)}
          onDelete={() => onManageAction('delete', project.targetSourceId)}
        />
      </div>
    </div>
  );
};
