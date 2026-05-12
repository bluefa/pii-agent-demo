'use client';

import {
  buttonStyles,
  cn,
  statusColors,
  textColors,
  bgColors,
  interactiveColors,
} from '@/lib/theme';
import { ProcessStatus, type CloudProvider, type ProjectSummary } from '@/lib/types';
import { ManagementSplitButton } from '@/app/components/features/admin/infrastructure/ManagementSplitButton';
import { ProviderLogo } from '@/app/components/features/admin/v7/ProviderLogo';
import {
  StatusPillV2,
  deriveHealthFromProcessStatus,
  type HealthStatus,
} from '@/app/components/features/admin/v7/StatusPillV2';

const MONITORING_LABEL: Record<CloudProvider, string> = {
  AWS: 'AWS Agent',
  Azure: 'Azure Agent',
  GCP: 'GCP Agent',
  IDC: 'IDC Agent',
};

const BAR_TONE_BY_HEALTH: Record<HealthStatus, keyof typeof statusColors> = {
  HEALTHY: 'success',
  OPERATIONAL: 'success',
  PARTIAL: 'warning',
  UNHEALTHY: 'error',
  PENDING: 'pending',
};

interface InfraRowProps {
  project: ProjectSummary;
  onOpenDetail: (targetSourceId: number) => void;
  onManageAction: (action: 'view' | 'delete', targetSourceId: number) => void;
  onViewApproval?: (project: ProjectSummary, e: React.MouseEvent) => void;
  onConfirmCompletion: (targetSourceId: number, e: React.MouseEvent) => void;
  actionLoading: string | null;
}

const StatusCta = ({
  project,
  actionLoading,
  onConfirmCompletion,
  onViewApproval,
}: Pick<InfraRowProps, 'project' | 'actionLoading' | 'onConfirmCompletion' | 'onViewApproval'>) => {
  switch (project.processStatus) {
    case ProcessStatus.WAITING_APPROVAL:
      if (!onViewApproval) return null;
      return (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onViewApproval(project, e);
          }}
          className={cn(
            buttonStyles.base,
            buttonStyles.variants.primary,
            buttonStyles.sizes.sm,
            'text-xs',
          )}
        >
          승인 요청 확인
        </button>
      );
    case ProcessStatus.CONNECTION_VERIFIED: {
      const busy = actionLoading === String(project.targetSourceId);
      return (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onConfirmCompletion(project.targetSourceId, e);
          }}
          disabled={busy}
          className={cn(
            buttonStyles.base,
            buttonStyles.variants.success,
            buttonStyles.sizes.sm,
            'text-xs flex items-center gap-1.5',
          )}
        >
          {busy && (
            <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
          )}
          설치 완료 확정
        </button>
      );
    }
    default:
      return null;
  }
};

export const InfraRow = ({
  project,
  onOpenDetail,
  onManageAction,
  onViewApproval,
  onConfirmCompletion,
  actionLoading,
}: InfraRowProps) => {
  const health = deriveHealthFromProcessStatus(project.processStatus);
  const barTone = statusColors[BAR_TONE_BY_HEALTH[health]];

  const handleRowClick = () => onOpenDetail(project.targetSourceId);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleRowClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleRowClick();
        }
      }}
      className={cn(
        'group relative grid items-center gap-4 cursor-pointer',
        'grid-cols-[6px_minmax(160px,1fr)_minmax(180px,1.4fr)_minmax(120px,1fr)_120px_88px]',
        bgColors.surface,
        interactiveColors.unselectedBorder,
        'border rounded-[12px] px-4 py-3 mb-2.5 transition-colors',
      )}
    >
      <div className={cn('absolute left-0 top-3 bottom-3 w-[3px] rounded-r', barTone.dot)} />

      <div />

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

      <div className="flex items-center gap-2">
        <StatusPillV2 status={health} />
      </div>

      <div
        className="flex items-center justify-end gap-1"
        onClick={(e) => e.stopPropagation()}
      >
        <StatusCta
          project={project}
          actionLoading={actionLoading}
          onConfirmCompletion={onConfirmCompletion}
          onViewApproval={onViewApproval}
        />
        <ManagementSplitButton
          onPrimary={() => onOpenDetail(project.targetSourceId)}
          onViewDetail={() => onManageAction('view', project.targetSourceId)}
          onDelete={() => onManageAction('delete', project.targetSourceId)}
        />
      </div>
    </div>
  );
};
