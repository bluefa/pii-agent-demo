'use client';

import { useScanPolling } from '@/app/hooks/useScanPolling';
import { useApiAction } from '@/app/hooks/useApiMutation';
import { startScan } from '@/app/lib/api/scan';
import { cn, borderColors, textColors } from '@/lib/theme';
import { formatDate } from '@/lib/utils/date';
import { Button } from '@/app/components/ui/Button';
import { ScanEmptyState } from './ScanEmptyState';
import { ScanRunningState } from './ScanRunningState';
import { ScanErrorState } from './ScanErrorState';
import { ScanResultSummary } from './ScanResultSummary';
import type { CloudProvider, V1ScanJob, ScanResult, ResourceType } from '@/lib/types';

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
    () => startScan(targetSourceId),
    {
      onSuccess: () => {
        startPolling();
        refresh();
      },
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

const ScanPanelView = ({
  state,
  lastResult,
  lastScanAt,
  progress,
  starting,
  isInProgress,
  canStart,
  startScan: handleStart,
}: ScanControllerRenderProps) => (
  <div className={cn('mx-4 mt-4 border rounded-lg overflow-hidden bg-white', borderColors.default)}>
    <div className={cn('px-4 py-3 flex items-center justify-between border-b', borderColors.default)}>
      <div className="min-w-0">
        {lastScanAt ? (
          <span className={cn('text-xs inline-flex items-center gap-1', textColors.tertiary)}>
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            Last Scan: {formatDate(lastScanAt, 'datetime')}
          </span>
        ) : (
          <span className={cn('text-sm font-medium', textColors.secondary)}>리소스 스캔</span>
        )}
      </div>
      {!isInProgress && (
        <Button
          variant="primary"
          onClick={handleStart}
          disabled={!canStart}
          className="inline-flex items-center gap-1.5 text-sm py-1.5"
        >
          {starting ? (
            <>
              <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
              시작 중...
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              Run Infra Scan
            </>
          )}
        </Button>
      )}
    </div>

    {state === 'EMPTY' && <ScanEmptyState />}
    {state === 'IN_PROGRESS' && <ScanRunningState progress={progress} />}
    {state === 'FAILED' && <ScanErrorState onRetry={handleStart} />}
    {state === 'SUCCESS' && lastResult && (
      <div className="px-4 py-4">
        <ScanResultSummary result={lastResult} completedAt={lastScanAt} />
      </div>
    )}
  </div>
);

interface ScanPanelProps {
  targetSourceId: number;
  cloudProvider: CloudProvider;
  onScanComplete?: () => void;
}

export const ScanPanel = ({ targetSourceId, cloudProvider: _cloudProvider, onScanComplete }: ScanPanelProps) => (
  <ScanController targetSourceId={targetSourceId} onScanComplete={onScanComplete}>
    {(controller) => <ScanPanelView {...controller} />}
  </ScanController>
);

export default ScanPanel;
