'use client';

import { isScanFinalizing, useScanPolling } from '@/app/hooks/useScanPolling';
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
  /** 스캔은 끝났고 집계만 남은 구간 — IN_PROGRESS의 마지막 단계다. */
  finalizing: boolean;
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
    totalFound: entries.reduce((sum, [, count]) => sum + (count ?? 0), 0),
    byResourceType: entries.map(([resourceType, count]) => ({
      resourceType: resourceType as ResourceType,
      count: count ?? 0,
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
  const { latestJob, uiState, loading, refresh, startPolling, expectCompletion } = useScanPolling(targetSourceId, {
    onScanComplete,
  });

  const { execute: doStartScan, loading: starting } = useApiAction(
    async () => {
      const minSpinnerDelay = new Promise<void>((resolve) => setTimeout(resolve, 500));
      const startedJob = await startScan(targetSourceId);
      // Arm completion detection BEFORE the refresh: a fast scan may already be
      // terminal (and id-less) on that very read, which identity/edge detection
      // alone would miss. Pin the arm to the started job's id (when the backend
      // returns one) so a stale response for an OLDER job cannot satisfy it.
      expectCompletion(startedJob.id ?? undefined);
      await refresh();
      startPolling();
      await minSpinnerDelay;
    },
    {
      errorMessage: '스캔을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.',
    }
  );

  const isInProgress = uiState === 'IN_PROGRESS';
  const canStart = !starting && !isInProgress;
  const lastResult = latestJob && latestJob.scan_status === 'SUCCESS' ? scanJobToResult(latestJob) : null;
  const lastScanAt = latestJob?.scan_status === 'SUCCESS' ? (latestJob.updated_at ?? undefined) : undefined;
  const state = uiStateToScanUiState(uiState);
  // 집계 대기 구간에는 scan_progress가 없다(스캔 자체는 끝났으므로) — 바는 가득 찬
  // 채로 두고 문구가 남은 일을 말한다.
  const finalizing = isScanFinalizing(latestJob);
  const progress = finalizing
    ? 100
    : isInProgress
      ? (latestJob?.scan_progress ?? 0)
      : state === 'SUCCESS' ? 100 : 0;

  return <>{children({
    state,
    latestJob,
    lastResult,
    lastScanAt,
    progress,
    finalizing,
    starting,
    loading,
    isInProgress,
    canStart,
    startScan: doStartScan,
    refresh,
  })}</>;
};
