'use client';

import {
  borderColors,
  cn,
  interactiveColors,
  statusColors,
  textColors,
} from '@/lib/theme';
import { getGcpInstallationStatus, checkGcpInstallation } from '@/app/lib/api/gcp';
import { InstallationLoadingView } from '@/app/components/features/process-status/shared/InstallationLoadingView';
import { InstallationErrorView } from '@/app/components/features/process-status/shared/InstallationErrorView';
import { InstallTaskPipeline } from '@/app/components/features/process-status/install-task-pipeline/InstallTaskPipeline';
import { InstallResourceTable } from '@/app/components/features/process-status/install-task-pipeline/InstallResourceTable';
import { InstallTaskDetailModal } from '@/app/components/features/process-status/install-task-pipeline/InstallTaskDetailModal';
import { joinGcpResources } from '@/app/components/features/process-status/install-task-pipeline/join-installation-resources';
import { useInstallationStatus } from '@/app/hooks/useInstallationStatus';
import { useModal } from '@/app/hooks/useModal';
import { useConfirmedIntegration } from '@/app/integration/target-sources/[targetSourceId]/_components/data/ConfirmedIntegrationDataProvider';
import { buildGcpPipelineItems, type GcpStepKey } from '@/lib/constants/gcp';
import type { GcpInstallationStatusResponse } from '@/app/api/_lib/v1-types';

interface GcpInstallationInlineProps {
  targetSourceId: number;
  onInstallComplete?: () => void;
}

export const GcpInstallationInline = ({
  targetSourceId,
  onInstallComplete,
}: GcpInstallationInlineProps) => {
  const detailModal = useModal<GcpStepKey>();
  const { state: confirmedState, retry: retryConfirmed } = useConfirmedIntegration();

  const { status, loading, refreshing, error, fetchStatus, refresh } =
    useInstallationStatus<GcpInstallationStatusResponse>({
      targetSourceId,
      getFn: getGcpInstallationStatus,
      checkFn: checkGcpInstallation,
      isComplete: (data) => data.summary.allCompleted,
      onComplete: onInstallComplete,
    });

  if (loading) return <InstallationLoadingView provider="GCP" />;
  if (error) return <InstallationErrorView message={error} onRetry={fetchStatus} />;

  const resources = status?.resources ?? [];
  const confirmedResources = confirmedState.status === 'ready' ? confirmedState.data : [];
  const joinedRows = joinGcpResources(resources, confirmedResources);
  const pipelineItems = buildGcpPipelineItems(resources).map((item) => ({
    ...item,
    onClick: () => detailModal.open(item.key),
  }));

  const lastCheck = status?.lastCheck;
  const checkedAt = lastCheck?.checkedAt
    ? new Date(lastCheck.checkedAt).toLocaleString('ko-KR')
    : null;

  return (
    <div className="w-full space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className={cn('text-sm font-semibold', textColors.primary)}>GCP 에이전트 설치 상태</h3>
          {checkedAt && (
            <span className={cn('text-xs', textColors.tertiary)}>
              마지막 확인: {checkedAt}
            </span>
          )}
        </div>
        <button
          onClick={refresh}
          disabled={refreshing}
          className={cn('p-1 rounded transition-colors disabled:opacity-50', interactiveColors.closeButton)}
          title="새로고침"
        >
          {refreshing ? (
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          )}
        </button>
      </div>

      {lastCheck?.status === 'FAILED' && lastCheck.failReason && (
        <div className={cn('px-4 py-2 rounded-lg border text-sm', statusColors.error.bg, statusColors.error.border, statusColors.error.textDark)}>
          상태 확인 실패: {lastCheck.failReason}
        </div>
      )}

      <InstallTaskPipeline items={pipelineItems} />

      {confirmedState.status === 'loading' && (
        <div
          className={cn(
            'px-4 py-2 rounded-lg border text-sm',
            borderColors.default,
            textColors.tertiary,
          )}
        >
          리소스 정보 불러오는 중...
        </div>
      )}
      {confirmedState.status === 'error' && (
        <div
          className={cn(
            'px-4 py-2 rounded-lg border text-sm flex items-center justify-between gap-3',
            statusColors.error.bg,
            statusColors.error.border,
            statusColors.error.textDark,
          )}
        >
          <span>리소스 정보 불러오기 실패: {confirmedState.message}</span>
          <button
            type="button"
            onClick={retryConfirmed}
            className={cn('text-xs font-semibold underline', statusColors.error.textDark)}
          >
            재시도
          </button>
        </div>
      )}
      <InstallResourceTable rows={joinedRows} />

      <InstallTaskDetailModal
        open={detailModal.isOpen}
        onClose={detailModal.close}
        stepKey={detailModal.data ?? null}
        rows={joinedRows}
      />
    </div>
  );
};
