'use client';

import { useEffect, useMemo, useRef } from 'react';
import { getAwsInstallationStatus } from '@/app/lib/api/aws';
import { InstallationLoadingView } from '@/app/components/features/process-status/shared/InstallationLoadingView';
import { InstallationErrorView } from '@/app/components/features/process-status/shared/InstallationErrorView';
import { InstallTaskPipeline } from '@/app/components/features/process-status/install-task-pipeline/InstallTaskPipeline';
import { InstallResourceTable } from '@/app/components/features/process-status/install-task-pipeline/InstallResourceTable';
import { joinAwsResources } from '@/app/components/features/process-status/aws/join-aws-install-resources';
import { useInstallationStatus } from '@/app/hooks/useInstallationStatus';
import { useConfirmedIntegration } from '@/app/integration/target-sources/[targetSourceId]/_components/data/ConfirmedIntegrationDataProvider';
import { buildAwsAutoItems } from '@/lib/constants/aws-install';
import { borderColors, cardStyles, cn, statusColors, textColors } from '@/lib/theme';
import type { AwsInstallationStatus } from '@/lib/types';

interface AwsInstallationInlineProps {
  targetSourceId: number;
  onInstallComplete?: () => void;
}

const getActionSummary = (status: AwsInstallationStatus) => {
  if (status.actionSummary) {
    return status.actionSummary;
  }

  return {
    serviceActionRequired: status.serviceScripts.some(script => script.status !== 'COMPLETED'),
    bdcInstallationRequired: status.bdcStatus.status !== 'COMPLETED',
  };
};

const isFullyCompleted = (status: AwsInstallationStatus): boolean => {
  const summary = getActionSummary(status);
  return !summary.serviceActionRequired && !summary.bdcInstallationRequired;
};

export const AwsInstallationInline = ({
  targetSourceId,
  onInstallComplete,
}: AwsInstallationInlineProps) => {
  const completionNotifiedRef = useRef(false);
  const { state: confirmedState, retry: retryConfirmed } = useConfirmedIntegration();

  useEffect(() => {
    completionNotifiedRef.current = false;
  }, [targetSourceId]);

  const { status, loading, error, fetchStatus } = useInstallationStatus<AwsInstallationStatus>({
    targetSourceId,
    getFn: getAwsInstallationStatus,
    // Refresh = re-GET installation-status (POST check-installation REMOVED-no-swagger).
    checkFn: getAwsInstallationStatus,
    isComplete: isFullyCompleted,
    onComplete: () => {
      if (!completionNotifiedRef.current) {
        completionNotifiedRef.current = true;
        onInstallComplete?.();
      }
    },
  });

  const joinedRows = useMemo(() => {
    if (!status) return [];
    const confirmedResources = confirmedState.status === 'ready' ? confirmedState.data : [];
    return joinAwsResources(status, confirmedResources);
  }, [status, confirmedState]);

  if (loading) return <InstallationLoadingView provider="AWS" />;
  if (error) return <InstallationErrorView message={error} onRetry={fetchStatus} />;
  if (!status) return null;

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
          Provider: <strong className="text-[#191F28]">AWS</strong>
        </span>
      </header>
      <div className={cn(cardStyles.body, 'space-y-3')}>
        <InstallTaskPipeline columns={3} items={buildAwsAutoItems(status)} />

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
        <InstallResourceTable rows={joinedRows} provider="AWS" />
      </div>
    </section>
  );
};
