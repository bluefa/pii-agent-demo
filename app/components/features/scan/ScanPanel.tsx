'use client';

import { useState, useEffect } from 'react';
import { CloudProvider } from '@/lib/types';
import { useScanPolling } from '@/app/hooks/useScanPolling';
import { useApiAction } from '@/app/hooks/useApiMutation';
import { startScan } from '@/app/lib/api/scan';
import { cn, statusColors, bgColors, textColors, borderColors } from '@/lib/theme';
import { formatDate } from '@/lib/utils/date';
import { ScanStatusBadge } from './ScanStatusBadge';
import { ScanProgressBar } from './ScanProgressBar';
import { ScanResultSummary } from './ScanResultSummary';
import { ScanHistoryList } from './ScanHistoryList';
import { useCooldownTimer } from './CooldownTimer';
import { Button } from '@/app/components/ui/Button';


interface ScanPanelProps {
  projectId: string;
  cloudProvider: CloudProvider;
  onScanComplete?: () => void;
}

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

export const ScanPanel = ({ projectId, cloudProvider, onScanComplete }: ScanPanelProps) => {
  const [expanded, setExpanded] = useState(false);

  const {
    status,
    uiState,
    loading,
    refresh,
    startPolling,
  } = useScanPolling(projectId, {
    onScanComplete: () => {
      onScanComplete?.();
    },
  });

  const { execute: doStartScan, loading: starting } = useApiAction(
    () => startScan(projectId),
    {
      onSuccess: () => {
        startPolling();
        refresh();
      },
      errorMessage: '스캔을 시작할 수 없습니다.',
    }
  );

  const { remainingMs, formatted: cooldownText } = useCooldownTimer(
    status?.cooldownUntil,
    refresh
  );
  const isCooldown = uiState === 'COOLDOWN' && remainingMs > 0;
  const isInProgress = uiState === 'IN_PROGRESS';

  // Auto-expand when scan starts
  useEffect(() => {
    if (isInProgress) queueMicrotask(() => setExpanded(true));
  }, [isInProgress]);

  const handleStartScan = () => {
    if (status?.canScan) doStartScan();
  };

  const canStartScan = status?.canScan && !starting && !isInProgress;

  const lastResult = status?.lastCompletedScan?.result;
  const lastCompletedAt = status?.lastCompletedScan?.completedAt;

  const summaryBg = isInProgress ? statusColors.warning.bg : bgColors.muted;

  return (
    <div className={cn('mx-4 mt-4 border rounded-lg overflow-hidden', borderColors.default)}>
      {/* Collapsed Summary Bar */}
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
          {!loading && <ScanStatusBadge uiState={uiState} />}

          {/* Normal mode: key numbers + last scan time */}
          {!loading && !isInProgress && lastResult && (
            <span className={cn('text-xs', textColors.tertiary)}>
              {lastResult.totalFound}개 발견
              {lastCompletedAt && ` | 마지막: ${formatDate(lastCompletedAt, 'short')}`}
            </span>
          )}

          {/* No scan history */}
          {!loading && !isInProgress && !lastResult && (
            <span className={cn('text-xs', textColors.quaternary)}>
              스캔을 시작하여 리소스를 검색하세요
            </span>
          )}

          {/* In-progress mode: message */}
          {!loading && isInProgress && (
            <span className={cn('text-xs', statusColors.warning.textDark)}>
              리소스를 검색하고 있습니다
            </span>
          )}
        </div>

        {/* Right side: scan button (hidden during scan) */}
        {!loading && !isInProgress && (
          <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            {starting ? (
              <Button variant="primary" disabled className="text-sm py-1.5">
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  시작 중...
                </span>
              </Button>
            ) : isCooldown ? (
              <Button variant="secondary" disabled className="text-sm py-1.5">
                <span className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {cooldownText} 후
                </span>
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={handleStartScan}
                disabled={!canStartScan}
                className="text-sm py-1.5"
              >
                스캔 시작
              </Button>
            )}
          </div>
        )}
      </div>

      {/* In-progress inline progress bar (always visible in collapsed/expanded) */}
      {!loading && isInProgress && status?.currentScan && (
        <div className={cn('px-4 pb-3', statusColors.warning.bg)}>
          <ScanProgressBar
            progress={status.currentScan.progress}
            startedAt={status.currentScan.startedAt}
          />
        </div>
      )}

      {/* Expanded Detail */}
      {expanded && !loading && (
        <div className={cn('px-4 py-4 space-y-4 border-t', borderColors.default)}>
          {/* FAILED: Error Message */}
          {uiState === 'FAILED' && (
            <div className={cn('flex items-center gap-2 py-4 px-3 rounded-lg', statusColors.error.bg)}>
              <svg className={cn('w-5 h-5', statusColors.error.text)} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className={cn('text-sm', statusColors.error.textDark)}>
                스캔 중 오류가 발생했습니다. 다시 시도해주세요.
              </span>
            </div>
          )}

          {/* Result Summary (metrics grid + type chips) */}
          {(uiState === 'COMPLETED' || uiState === 'COOLDOWN') && lastResult && (
            <ScanResultSummary
              result={lastResult}
              completedAt={lastCompletedAt}
            />
          )}

          {/* IDLE: No scan yet */}
          {uiState === 'IDLE' && !lastResult && (
            <div className={cn('text-center py-6 text-sm', textColors.tertiary)}>
              스캔을 시작하여 리소스를 검색하세요.
            </div>
          )}

          {/* Scan History Table */}
          <div className="pt-2">
            <div className={cn('text-xs font-medium uppercase tracking-wide mb-2', textColors.tertiary)}>
              스캔 이력
            </div>
            <ScanHistoryList projectId={projectId} limit={5} lastCompletedAt={lastCompletedAt} />
          </div>
        </div>
      )}
    </div>
  );
};

export default ScanPanel;
