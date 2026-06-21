'use client';

import { useState, useEffect, useRef } from 'react';
import {
  getAwsInstallationStatus,
  checkAwsInstallation,
  getAwsTerraformScript,
} from '@/app/lib/api/aws';
import { InstallationLoadingView } from '@/app/components/features/process-status/shared/InstallationLoadingView';
import { InstallationErrorView } from '@/app/components/features/process-status/shared/InstallationErrorView';
import { InstallTaskPipeline } from '@/app/components/features/process-status/install-task-pipeline/InstallTaskPipeline';
import { TfDownloadCard } from '@/app/components/features/process-status/install-task-pipeline/TfDownloadCard';
import { TfScriptGuideModal } from '@/app/components/features/process-status/aws/TfScriptGuideModal';
import { useToast } from '@/app/components/ui/toast';
import { useInstallationStatus } from '@/app/hooks/useInstallationStatus';
import { buildAwsAutoItems, buildAwsManualItems } from '@/lib/constants/aws-install';
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
    <div className="w-full">
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

      {guideOpen && <TfScriptGuideModal onClose={() => setGuideOpen(false)} />}
    </div>
  );
};
