'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getAwsInstallationStatus, getAwsTerraformScript } from '@/app/lib/api/aws';
import { InstallationLoadingView } from '@/app/components/features/process-status/shared/InstallationLoadingView';
import { InstallationErrorView } from '@/app/components/features/process-status/shared/InstallationErrorView';
import { AwsInstallStatusDetail } from '@/app/components/features/process-status/aws/AwsInstallStatusDetail';
import { isAwsInstallationComplete } from '@/app/api/v1/aws/target-sources/_lib/installation-transform';
import { useInstallationStatus } from '@/app/hooks/useInstallationStatus';
import { useConfirmedIntegration } from '@/app/target-sources/[targetSourceId]/_components/data/ConfirmedIntegrationDataProvider';
import { bgColors, borderColors, cardStyles, cn, getButtonClass, statusColors, textColors } from '@/lib/theme';
import type { AwsInstallationStatus } from '@/lib/types';

interface AwsInstallationInlineProps {
  targetSourceId: number;
  /**
   * metadata.grant_service_terraform_execution_permission — explicit false ⇒
   * manual install (no role-verify step); true/undefined ⇒ auto.
   */
  terraformExecutionGranted?: boolean;
  onInstallComplete?: () => void;
}

export const AwsInstallationInline = ({
  targetSourceId,
  terraformExecutionGranted,
  onInstallComplete,
}: AwsInstallationInlineProps) => {
  const isManualInstall = terraformExecutionGranted === false;
  const completionNotifiedRef = useRef(false);
  const { state: confirmedState, retry: retryConfirmed } = useConfirmedIntegration();
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // TF script download is available in BOTH install modes (owner requirement):
  // manual installs apply it directly; auto installs keep it for inspection.
  const handleDownloadScript = useCallback(async () => {
    setDownloading(true);
    setDownloadError(null);
    try {
      const blob = await getAwsTerraformScript(targetSourceId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `terraform-${targetSourceId}.zip`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setDownloadError('Terraform Script 다운로드에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setDownloading(false);
    }
  }, [targetSourceId]);

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

  if (loading) return <InstallationLoadingView provider="AWS" />;
  if (error) return <InstallationErrorView message={error} onRetry={fetchStatus} />;
  if (!status) return null;

  const confirmedResources = confirmedState.status === 'ready' ? confirmedState.data : [];

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
        {/* TF script download is available in BOTH install modes (owner requirement). */}
        <div className={cn('rounded-[14px] border px-5 py-4 flex items-center justify-between gap-4', borderColors.default, bgColors.muted)}>
          <div>
            <h3 className={cn('text-[14px] font-bold', textColors.primary)}>Terraform Script</h3>
            <p className={cn('mt-1 text-[13px]', textColors.secondary)}>
              Terraform Script를 다운로드 받아 어떤 리소스가 생성되는지 미리 리뷰할 수 있습니다.
            </p>
          </div>
          <button
            type="button"
            onClick={handleDownloadScript}
            disabled={downloading}
            className={cn(getButtonClass('soft', 'sm'), 'shrink-0 whitespace-nowrap')}
          >
            {downloading ? '다운로드 중...' : 'Terraform Script 다운로드'}
          </button>
        </div>
        {downloadError && (
          <div className={cn('px-4 py-2 rounded-lg border text-sm', statusColors.error.bg, statusColors.error.border, statusColors.error.textDark)}>
            {downloadError}
          </div>
        )}
        {status.lastCheck.status === 'FAILED' && status.lastCheck.failReason && (
          <div className={cn('px-4 py-2 rounded-lg border text-sm', statusColors.error.bg, statusColors.error.border, statusColors.error.textDark)}>
            상태 확인 실패: {status.lastCheck.failReason}
          </div>
        )}
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
        <AwsInstallStatusDetail
          status={status}
          confirmed={confirmedResources}
          manualInstall={isManualInstall}
        />
      </div>
    </section>
  );
};
