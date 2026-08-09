'use client';

import { useCallback, useEffect, useRef } from 'react';
import { getAwsInstallationStatus } from '@/app/lib/api/aws';
import { InstallationLoadingView } from '@/app/components/features/process-status/shared/InstallationLoadingView';
import { InstallationErrorView } from '@/app/components/features/process-status/shared/InstallationErrorView';
import { AwsInstallStatusDetail } from '@/app/components/features/process-status/aws/AwsInstallStatusDetail';
import { isAwsInstallationComplete } from '@/app/api/v1/aws/target-sources/_lib/installation-transform';
import { useInstallationStatus } from '@/app/hooks/useInstallationStatus';
import { useConfirmedIntegration } from '@/app/target-sources/[targetSourceId]/_components/data/ConfirmedIntegrationDataProvider';
import { borderColors, cardStyles, cn, stackGap, statusColors, textColors, textStyles } from '@/lib/theme';
import type { AwsInstallationStatus } from '@/lib/types';
import { InstallCardHeader } from '@/app/components/features/process-status/install-status-detail/InstallCardHeader';

interface AwsInstallationInlineProps {
  targetSourceId: number;
  /**
   * metadata.grant_service_terraform_execution_permission — only an explicit grant
   * is an auto install. Anything else (false, or never told) ⇒ manual, no
   * role-verify step. Same rule the meta bar and the list chip read.
   */
  terraformExecutionGranted?: boolean;
  onInstallComplete?: () => void;
}

export const AwsInstallationInline = ({
  targetSourceId,
  terraformExecutionGranted,
  onInstallComplete,
}: AwsInstallationInlineProps) => {
  const isManualInstall = terraformExecutionGranted !== true;
  const completionNotifiedRef = useRef(false);
  const { state: confirmedState, retry: retryConfirmed } = useConfirmedIntegration();

  useEffect(() => {
    completionNotifiedRef.current = false;
  }, [targetSourceId]);

  const isComplete = useCallback(
    (status: AwsInstallationStatus) => isAwsInstallationComplete(status, isManualInstall),
    [isManualInstall],
  );

  const { status, loading, error, fetchStatus } = useInstallationStatus<AwsInstallationStatus>({
    targetSourceId,
    getFn: getAwsInstallationStatus,
    // Refresh = re-GET installation-status (POST check-installation REMOVED-no-swagger).
    checkFn: getAwsInstallationStatus,
    isComplete,
    onComplete: () => {
      if (!completionNotifiedRef.current) {
        completionNotifiedRef.current = true;
        onInstallComplete?.();
      }
    },
  });

  // 로딩/에러는 카드 안에서 교체한다 — 카드 자체를 조기 반환하면 헤더까지
  // 사라졌다 나타나 스켈레톤의 목적(레이아웃 유지)이 깨진다.
  const confirmedResources = confirmedState.status === 'ready' ? confirmedState.data : [];

  return (
    <section className={cn(cardStyles.base, 'overflow-hidden')}>
      <InstallCardHeader />
      {/* 카드 내 블록 경계 = group 16px */}
      <div className={cn(cardStyles.body, 'flex flex-col', stackGap.group)}>
        {/* TF 스크립트 다운로드는 레일의 '참고' 항목이 갖는다 — 자동/수동 양쪽 모두
            제공하되(오너 요구) 단계 위에 얹지 않는다. */}
        {status?.lastCheck.status === 'FAILED' && status.lastCheck.failReason && (
          <div className={cn('px-4 py-2 rounded-lg border', textStyles.body, statusColors.error.bg, statusColors.error.border, statusColors.error.textDark)}>
            상태 확인 실패: {status.lastCheck.failReason}
          </div>
        )}
        {confirmedState.status === 'loading' && (
          <div
            className={cn(
              'px-4 py-2 rounded-lg border',
              textStyles.body,
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
              'px-4 py-2 rounded-lg border flex items-center justify-between gap-3',
              textStyles.body,
              statusColors.error.bg,
              statusColors.error.border,
              statusColors.error.textDark,
            )}
          >
            <span>리소스 정보 불러오기 실패: {confirmedState.message}</span>
            <button
              type="button"
              onClick={retryConfirmed}
              className={cn(textStyles.captionStrong, 'underline', statusColors.error.textDark)}
            >
              재시도
            </button>
          </div>
        )}
        {loading ? (
          <InstallationLoadingView provider="AWS" grouped />
        ) : error ? (
          <InstallationErrorView message={error} onRetry={fetchStatus} />
        ) : status ? (
          <AwsInstallStatusDetail
            status={status}
            confirmed={confirmedResources}
            manualInstall={isManualInstall}
            targetSourceId={targetSourceId}
          />
        ) : null}
      </div>
    </section>
  );
};
