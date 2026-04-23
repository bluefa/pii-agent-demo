'use client';

import { useScanPolling } from '@/app/hooks/useScanPolling';
import { useApiAction } from '@/app/hooks/useApiMutation';
import { startScan } from '@/app/lib/api/scan';
import type { V1ScanJob, ScanResult, ResourceType } from '@/lib/types';

export type ScanUiState = 'EMPTY' | 'IN_PROGRESS' | 'SUCCESS' | 'FAILED';

export interface ScanControllerRenderProps {
  state: ScanUiState;
  latestJob: V1ScanJob | null;
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

const scanJobToResult = (job: V1ScanJob): ScanResult | null => {
  const entries = Object.entries(job.resourceCountByResourceType);
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
  const lastResult = latestJob && latestJob.scanStatus === 'SUCCESS' ? scanJobToResult(latestJob) : null;
  const lastScanAt = latestJob?.scanStatus === 'SUCCESS' ? latestJob.updatedAt : undefined;
  const state = uiStateToScanUiState(uiState);
  const progress = isInProgress
    ? (latestJob?.scanProgress ?? 0)
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
