'use client';

import { useScanPolling } from '@/app/hooks/useScanPolling';
import { useApiAction } from '@/app/hooks/useApiMutation';
import { startScan } from '@/app/lib/api/scan';
import type { ScanResult, ResourceType } from '@/lib/types';
import type { z } from 'zod';
import type { schemas } from '@/lib/generated/install-v1';

type ScanJob = z.infer<typeof schemas.ScanJobResponse>;

export type ScanUiState = 'EMPTY' | 'IN_PROGRESS' | 'SUCCESS' | 'FAILED';

export interface ScanControllerRenderProps {
  state: ScanUiState;
  latestJob: ScanJob | null;
  lastResult: ScanResult | null;
  lastScanAt: string | undefined;
  progress: number;
  starting: boolean;
  loading: boolean;
  isInProgress: boolean;
  canStart: boolean;
  startScan: () => void;
  refresh: () => void;
}

interface ScanControllerProps {
  targetSourceId: number;
  onScanComplete?: () => void;
  children: (props: ScanControllerRenderProps) => React.ReactNode;
}

const scanJobToResult = (job: ScanJob): ScanResult | null => {
  const entries = Object.entries(job.resource_count_by_resource_type ?? {});
  if (entries.length === 0) return null;
  return {
    totalFound: entries.reduce((sum, [, count]) => sum + count, 0),
    byResourceType: entries.map(([resourceType, count]) => ({
      resourceType: resourceType as ResourceType,
      count,
    })),
  };
};

const uiStateToScanUiState = (uiState: 'IDLE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'): ScanUiState => {
  switch (uiState) {
    case 'IN_PROGRESS': return 'IN_PROGRESS';
    case 'COMPLETED': return 'SUCCESS';
    case 'FAILED': return 'FAILED';
    case 'IDLE':
    default: return 'EMPTY';
  }
};

export const ScanController = ({ targetSourceId, onScanComplete, children }: ScanControllerProps) => {
  const { latestJob, uiState, loading, refresh, startPolling } = useScanPolling(targetSourceId, {
    onScanComplete,
  });

  const { execute: doStartScan, loading: starting } = useApiAction(
    async () => {
      const minSpinnerDelay = new Promise<void>((resolve) => setTimeout(resolve, 500));
      await startScan(targetSourceId);
      await refresh();
      startPolling();
      await minSpinnerDelay;
    },
    {
      errorMessage: '스캔을 시작할 수 없습니다.',
    }
  );

  const isInProgress = uiState === 'IN_PROGRESS';
  const canStart = !starting && !isInProgress;
  const lastResult = latestJob && latestJob.scan_status === 'SUCCESS' ? scanJobToResult(latestJob) : null;
  const lastScanAt = latestJob?.scan_status === 'SUCCESS' ? latestJob.updated_at : undefined;
  const state = uiStateToScanUiState(uiState);
  const progress = isInProgress
    ? (latestJob?.scan_progress ?? 0)
    : state === 'SUCCESS' ? 100 : 0;

  return <>{children({
    state,
    latestJob,
    lastResult,
    lastScanAt,
    progress,
    starting,
    loading,
    isInProgress,
    canStart,
    startScan: doStartScan,
    refresh,
  })}</>;
};
