'use client';

import { useState, useEffect } from 'react';
import { useScanPolling } from '@/app/hooks/useScanPolling';
import { useApiAction } from '@/app/hooks/useApiMutation';
import { startScan } from '@/app/lib/api/scan';
import { cn, statusColors, bgColors, textColors, borderColors } from '@/lib/theme';
import { formatDate } from '@/lib/utils/date';
import { ScanStatusBadge } from './ScanStatusBadge';
import { ScanProgressBar } from './ScanProgressBar';
import { ScanResultSummary } from './ScanResultSummary';
import { Button } from '@/app/components/ui/Button';
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

const ChevronIcon = ({ expanded }: { expanded: boolean }) => (
  <svg
    className={cn('w-4 h-4 transition-transform duration-200', expanded && 'rotate-90')}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

const ScanPanelView = ({
  state,
  latestJob,
  lastResult,
  lastScanAt,
  starting,
  loading,
  isInProgress,
  canStart,
  startScan: handleStart,
}: ScanControllerRenderProps) => {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (isInProgress) queueMicrotask(() => setExpanded(true));
  }, [isInProgress]);

  const handleStartScan = () => {
    if (canStart) handleStart();
  };

  const summaryBg = isInProgress ? statusColors.warning.bg : bgColors.muted;
  const badgeUiState = state === 'SUCCESS' ? 'COMPLETED' : state === 'EMPTY' ? 'IDLE' : state;

  return (
    <div className={cn('mx-4 mt-4 border rounded-lg overflow-hidden', borderColors.default)}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded(!expanded)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setExpanded(!expanded); }}
        className={cn(
          'w-full px-4 py-3 flex items-center justify-between cursor-pointer transition-colors',
          summaryBg
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          <ChevronIcon expanded={expanded} />
          <span className={cn('text-sm font-medium', textColors.secondary)}>리소스 스캔</span>
          {!loading && <ScanStatusBadge uiState={badgeUiState} />}

          {!loading && !isInProgress && lastResult && (
            <span className={cn('text-xs', textColors.tertiary)}>
              {lastResult.totalFound}개 발견
              {lastScanAt && ` | 마지막: ${formatDate(lastScanAt, 'short')}`}
            </span>
          )}

          {!loading && !isInProgress && !lastResult && (
            <span className={cn('text-xs', textColors.quaternary)}>
              스캔을 시작하여 리소스를 검색하세요
            </span>
          )}

          {!loading && isInProgress && (
            <span className={cn('text-xs', statusColors.warning.textDark)}>
              리소스를 검색하고 있습니다
            </span>
          )}
        </div>

        {!loading && !isInProgress && (
          <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            {starting ? (
              <Button variant="primary" disabled className="text-sm py-1.5">
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  시작 중...
                </span>
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={handleStartScan}
                disabled={!canStart}
                className="text-sm py-1.5"
              >
                스캔 시작
              </Button>
            )}
          </div>
        )}
      </div>

      {!loading && isInProgress && latestJob?.scanStatus === 'SCANNING' && (
        <div className={cn('px-4 pb-3', statusColors.warning.bg)}>
          <ScanProgressBar
            progress={latestJob.scanProgress ?? 0}
            startedAt={latestJob.createdAt}
          />
        </div>
      )}

      {expanded && !loading && (
        <div className={cn('px-4 py-4 space-y-4 border-t', borderColors.default)}>
          {state === 'FAILED' && (
            <div className={cn('flex items-center gap-2 py-4 px-3 rounded-lg', statusColors.error.bg)}>
              <svg className={cn('w-5 h-5', statusColors.error.text)} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className={cn('text-sm', statusColors.error.textDark)}>
                스캔 중 오류가 발생했습니다. 다시 시도해주세요.
              </span>
            </div>
          )}

          {state === 'SUCCESS' && lastResult && (
            <ScanResultSummary
              result={lastResult}
              completedAt={lastScanAt}
            />
          )}

          {state === 'EMPTY' && !lastResult && (
            <div className={cn('text-center py-6 text-sm', textColors.tertiary)}>
              스캔을 시작하여 리소스를 검색하세요.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

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
