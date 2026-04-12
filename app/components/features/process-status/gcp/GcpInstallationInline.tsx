'use client';

import { useState, useEffect, useCallback } from 'react';
import { getGcpInstallationStatus, checkGcpInstallation } from '@/app/lib/api/gcp';
import { statusColors, textColors, interactiveColors, cn } from '@/lib/theme';
import { InstallationLoadingView } from '@/app/components/features/process-status/shared/InstallationLoadingView';
import { InstallationErrorView } from '@/app/components/features/process-status/shared/InstallationErrorView';
import { GcpStepSummaryRow } from './GcpStepSummaryRow';
import { GcpResourceStatusTable } from './GcpResourceStatusTable';
import type { GcpInstallationStatusResponse } from '@/app/api/_lib/v1-types';

interface GcpInstallationInlineProps {
  targetSourceId: number;
  onInstallComplete?: () => void;
}

export const GcpInstallationInline = ({
  targetSourceId,
  onInstallComplete,
}: GcpInstallationInlineProps) => {
  const [status, setStatus] = useState<GcpInstallationStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getGcpInstallationStatus(targetSourceId);
      setStatus(data);
      if (data.summary.allCompleted) onInstallComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : '상태 조회에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [targetSourceId, onInstallComplete]);

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      setError(null);
      const data = await checkGcpInstallation(targetSourceId);
      setStatus(data);
      if (data.summary.allCompleted) onInstallComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : '상태 새로고침에 실패했습니다.');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  if (loading) return <InstallationLoadingView provider="GCP" />;
  if (error) return <InstallationErrorView message={error} onRetry={fetchStatus} />;

  const resources = status?.resources || [];
  const lastCheck = status?.lastCheck;
  const checkedAt = lastCheck?.checkedAt
    ? new Date(lastCheck.checkedAt).toLocaleString('ko-KR')
    : null;

  return (
    <div className="w-full space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className={cn('text-sm font-semibold', textColors.primary)}>GCP 에이전트 설치 상태</h3>
          {checkedAt && (
            <span className={cn('text-xs', textColors.tertiary)}>
              마지막 확인: {checkedAt}
            </span>
          )}
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className={cn('p-1 rounded transition-colors disabled:opacity-50', interactiveColors.closeButton)}
          title="새로고침"
        >
          {refreshing ? (
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          )}
        </button>
      </div>

      {lastCheck?.status === 'FAILED' && lastCheck.failReason && (
        <div className={cn('px-4 py-2 rounded-lg border text-sm', statusColors.error.bg, statusColors.error.border, statusColors.error.textDark)}>
          상태 확인 실패: {lastCheck.failReason}
        </div>
      )}

      <GcpStepSummaryRow resources={resources} />
      <GcpResourceStatusTable resources={resources} />
    </div>
  );
};
