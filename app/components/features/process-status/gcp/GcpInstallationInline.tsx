'use client';

import {
  borderColors,
  cardStyles,
  cn,
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

  const { status, loading, error, fetchStatus } =
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

  return (
    <section className={cn(cardStyles.base, 'overflow-hidden')}>
      <header className={cn(cardStyles.header, 'flex items-center justify-between')}>
        <div>
          <h2 className={cardStyles.cardTitle}>Agent 설치</h2>
          <p className={cn('mt-2.5', cardStyles.subtitle)}>
            승인된 인프라에 PII Agent를 배포하기 위한 설치 작업을 진행합니다.
          </p>
        </div>
        {/* v16 L6606 — provider indicator (not a control), short provider name. */}
        <span className="text-[11.5px] text-[#8B95A1]">
          Provider: <strong className="text-[#191F28]">GCP</strong>
        </span>
      </header>
      <div className={cn(cardStyles.body, 'space-y-3')}>
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
        <InstallResourceTable rows={joinedRows} provider="GCP" />
      </div>

      <InstallTaskDetailModal
        open={detailModal.isOpen}
        onClose={detailModal.close}
        stepKey={detailModal.data ?? null}
        rows={joinedRows}
      />
    </section>
  );
};
