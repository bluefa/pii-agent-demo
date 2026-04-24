'use client';

import { ProcessStatus, type CloudProvider, type ProjectSummary } from '@/lib/types';
import { cn, providerColors, textColors } from '@/lib/theme';
import { ManagementSplitButton } from './ManagementSplitButton';

interface InfraCardHeaderProps {
  project: ProjectSummary;
  canExpand: boolean;
  expanded: boolean;
  onToggle: () => void;
  actionLoading: string | null;
  onConfirmCompletion: (targetSourceId: number, e: React.MouseEvent) => void;
  onViewApproval?: (project: ProjectSummary, e: React.MouseEvent) => void;
  onManageAction: (action: 'view' | 'delete', targetSourceId: number) => void;
  onOpenDetail: (targetSourceId: number) => void;
}

const PROVIDER_LABEL: Record<CloudProvider, string> = {
  AWS: 'AWS',
  Azure: 'Azure',
  GCP: 'GCP',
};

const KvInline = ({ k, v }: { k: string; v: string }) => (
  <div className="flex flex-col gap-0.5 min-w-[140px]">
    <span className={cn('text-[11px]', textColors.tertiary)}>{k}</span>
    <span className={cn('text-xs font-medium', textColors.primary)}>{v}</span>
  </div>
);

const DOCUMENT_ICON = (
  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const CHECK_ICON = (
  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const CTA_SPINNER = (
  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
);

const StatusCta = ({
  project,
  actionLoading,
  onConfirmCompletion,
  onViewApproval,
}: Pick<InfraCardHeaderProps, 'project' | 'actionLoading' | 'onConfirmCompletion' | 'onViewApproval'>) => {
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
          className="px-3 py-1.5 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)]"
        >
          {DOCUMENT_ICON}
          승인 요청 확인
        </button>
      );
    case ProcessStatus.APPLYING_APPROVED:
      return (
        <span className="px-3 py-1.5 bg-orange-100 text-orange-600 text-xs font-medium rounded-lg">
          연동대상 반영 중
        </span>
      );
    case ProcessStatus.INSTALLING:
      return (
        <span className="px-3 py-1.5 bg-orange-100 text-orange-600 text-xs font-medium rounded-lg">
          설치 진행 중
        </span>
      );
    case ProcessStatus.WAITING_CONNECTION_TEST:
      return (
        <span className="px-3 py-1.5 bg-gray-100 text-gray-500 text-xs font-medium rounded-lg">
          연결 테스트 대기
        </span>
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
          className="px-3 py-1.5 bg-green-500 text-white text-xs font-medium rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
        >
          {busy ? CTA_SPINNER : CHECK_ICON}
          설치 완료 확정
        </button>
      );
    }
    default:
      return null;
  }
};

export const InfraCardHeader = ({
  project,
  canExpand,
  expanded,
  onToggle,
  actionLoading,
  onConfirmCompletion,
  onViewApproval,
  onManageAction,
  onOpenDetail,
}: InfraCardHeaderProps) => {
  const providerColor = providerColors[project.cloudProvider];

  const handleHeaderClick = () => {
    if (canExpand) onToggle();
  };

  return (
    <div
      onClick={handleHeaderClick}
      className={cn(
        'flex items-center gap-6 px-5 py-4',
        canExpand ? 'cursor-pointer' : 'cursor-default',
      )}
    >
      {canExpand ? (
        <svg
          className={cn('w-4 h-4 flex-shrink-0 transition-transform text-gray-400', expanded && 'rotate-90')}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      ) : null}

      <span className={cn('inline-flex items-center gap-2 text-sm font-semibold', providerColor.text)}>
        <span className={cn('inline-block w-1 h-[18px] rounded', providerColor.bar)} />
        {PROVIDER_LABEL[project.cloudProvider]}
      </span>

      <KvInline k="타겟 소스 ID" v={`TS-${project.targetSourceId}`} />
      <KvInline k="설명" v={project.description || '-'} />
      <KvInline k="리소스 수" v={`${project.resourceCount}개`} />

      <div className="flex-1" />

      <div className="flex items-center gap-2">
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
