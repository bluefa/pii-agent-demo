'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import {
  getAwsInstallationStatus,
  checkAwsInstallation,
  getAwsTerraformScript,
} from '@/app/lib/api/aws';
import { InstallationLoadingView } from '@/app/components/features/process-status/shared/InstallationLoadingView';
import { InstallationErrorView } from '@/app/components/features/process-status/shared/InstallationErrorView';
import { InstallTaskPipeline } from '@/app/components/features/process-status/install-task-pipeline/InstallTaskPipeline';
import { InstallResourceTable } from '@/app/components/features/process-status/install-task-pipeline/InstallResourceTable';
import { TfDownloadCard } from '@/app/components/features/process-status/install-task-pipeline/TfDownloadCard';
import { TfScriptGuideModal } from '@/app/components/features/process-status/aws/TfScriptGuideModal';
import { joinAwsResources } from '@/app/components/features/process-status/aws/join-aws-install-resources';
import { useToast } from '@/app/components/ui/toast';
import { useInstallationStatus } from '@/app/hooks/useInstallationStatus';
import { useConfirmedIntegration } from '@/app/integration/target-sources/[targetSourceId]/_components/data/ConfirmedIntegrationDataProvider';
import { buildAwsAutoItems, buildAwsManualItems } from '@/lib/constants/aws-install';
import { borderColors, cardStyles, cn, statusColors, textColors } from '@/lib/theme';
import type { AwsInstallationStatus, AwsInstallationMode } from '@/lib/types';

interface AwsInstallationInlineProps {
  targetSourceId: number;
  mode: AwsInstallationMode;
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
  mode,
  onInstallComplete,
}: AwsInstallationInlineProps) => {
  const [guideOpen, setGuideOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const completionNotifiedRef = useRef(false);
  const toast = useToast();
  const { state: confirmedState, retry: retryConfirmed } = useConfirmedIntegration();

  useEffect(() => {
    completionNotifiedRef.current = false;
  }, [targetSourceId]);

  const { status, loading, error, fetchStatus } = useInstallationStatus<AwsInstallationStatus>({
    targetSourceId,
    getFn: getAwsInstallationStatus,
    checkFn: checkAwsInstallation,
    isComplete: isFullyCompleted,
    onComplete: () => {
      if (!completionNotifiedRef.current) {
        completionNotifiedRef.current = true;
        onInstallComplete?.();
      }
    },
  });

  const confirmedResources = confirmedState.status === 'ready' ? confirmedState.data : [];
  const joinedRows = useMemo(
    () => (status ? joinAwsResources(status, confirmedResources) : []),
    [status, confirmedResources],
  );

  const handleDownload = async () => {
    // Open the tab synchronously (inside the click) so the popup blocker allows
    // it; navigate it once the signed URL resolves.
    const tab = window.open('', '_blank');
    setDownloading(true);
    try {
      const res = await getAwsTerraformScript(targetSourceId);
      if (tab) tab.location.href = res.downloadUrl;
      else window.open(res.downloadUrl, '_blank');
    } catch {
      tab?.close();
      toast.error('Terraform 스크립트 다운로드에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setDownloading(false);
    }
  };

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
        {mode === 'AUTO' ? (
          <InstallTaskPipeline columns={3} items={buildAwsAutoItems(status)} />
        ) : (
          <>
            <TfDownloadCard
              sizeLabel="12.4 KB"
              onGuide={() => setGuideOpen(true)}
              onDownload={handleDownload}
              downloading={downloading}
            />
            <InstallTaskPipeline columns={2} items={buildAwsManualItems(status)} />
          </>
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
        <InstallResourceTable rows={joinedRows} provider="AWS" />

        {guideOpen && <TfScriptGuideModal onClose={() => setGuideOpen(false)} />}
      </div>
    </section>
  );
};
