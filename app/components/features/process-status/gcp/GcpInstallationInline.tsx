'use client';

import { useState, useEffect } from 'react';
import { getGcpInstallationStatus, checkGcpInstallation } from '@/app/lib/api/gcp';
import { statusColors, cn } from '@/lib/theme';
import { GcpStepSummaryRow } from './GcpStepSummaryRow';
import { GcpResourceStatusTable } from './GcpResourceStatusTable';
import type { GcpInstallationStatusResponse } from '@/app/api/_lib/v1-types';

interface GcpInstallationInlineProps {
  targetSourceId: number;
  onInstallComplete?: () => void;
}

const formatCheckedAt = (checkedAt?: string): string => {
  if (!checkedAt) return '';
  try {
    return new Date(checkedAt).toLocaleString('ko-KR');
  } catch {
    return checkedAt;
  }
};

export const GcpInstallationInline = ({
  targetSourceId,
  onInstallComplete,
}: GcpInstallationInlineProps) => {
  const [status, setStatus] = useState<GcpInstallationStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkCompletion = (data: GcpInstallationStatusResponse) => {
    if (data.resources.every((r) => r.installationStatus === 'COMPLETED')) {
      onInstallComplete?.();
    }
  };

  const fetchStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getGcpInstallationStatus(targetSourceId);
      setStatus(data);
      checkCompletion(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '상태 조회에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      setError(null);
      const data = await checkGcpInstallation(targetSourceId);
      setStatus(data);
      checkCompletion(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '상태 새로고침에 실패했습니다.');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [targetSourceId]);

  if (loading) {
    return (
      <div className={cn('w-full px-4 py-3 rounded-lg border', statusColors.pending.bg, statusColors.pending.border)}>
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-600">GCP 설치 상태 확인 중...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('w-full px-4 py-3 rounded-lg border', statusColors.error.bg, statusColors.error.border)}>
        <div className="flex items-center justify-between">
          <span className={cn('text-sm', statusColors.error.textDark)}>{error}</span>
          <button onClick={fetchStatus} className={cn('text-sm hover:underline', statusColors.error.textDark)}>
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  const resources = status?.resources || [];
  const lastCheck = status?.lastCheck;

  return (
    <div className="w-full space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-900">GCP 에이전트 설치 상태</h3>
          {lastCheck?.checkedAt && (
            <span className="text-xs text-gray-500">
              마지막 확인: {formatCheckedAt(lastCheck.checkedAt)}
            </span>
          )}
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-1 rounded transition-colors disabled:opacity-50 text-gray-600 hover:bg-gray-100"
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
