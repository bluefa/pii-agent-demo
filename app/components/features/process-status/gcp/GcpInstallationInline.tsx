'use client';

import { useState, useEffect } from 'react';
import { getGcpInstallationStatus, checkGcpInstallation } from '@/app/lib/api/gcp';
import { getGcpUnifiedStatus, getGcpGroupStatus, GCP_GROUP_STATUS_LABELS } from '@/lib/constants/gcp';
import { statusColors, cn } from '@/lib/theme';
import { RegionalManagedProxyPanel } from './RegionalManagedProxyPanel';
import { PscApprovalGuide } from './PscApprovalGuide';
import type { GcpInstallationStatusResponse, GcpResourceStatus } from '@/app/api/_lib/v1-types';
import type { GcpGroupStatus } from '@/lib/constants/gcp';

interface GcpInstallationInlineProps {
  targetSourceId: number;
  onInstallComplete?: () => void;
}

const getResourceDisplayName = (name: string): string => {
  const parts = name.split('/');
  return parts[parts.length - 1] || name;
};

export const GcpInstallationInline = ({
  targetSourceId,
  onInstallComplete,
}: GcpInstallationInlineProps) => {
  const [status, setStatus] = useState<GcpInstallationStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getGcpInstallationStatus(targetSourceId);
      setStatus(data);
      if (data.resources.every((r) => r.isInstallCompleted)) {
        onInstallComplete?.();
      }
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
      if (data.resources.every((r) => r.isInstallCompleted)) {
        onInstallComplete?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '상태 새로고침에 실패했습니다.');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [targetSourceId]);

  const resources = status?.resources || [];
  const completedCount = resources.filter((r) => r.isInstallCompleted).length;
  const totalCount = resources.length;
  const failedResources = resources.filter((r) => getGcpUnifiedStatus(r) === 'FAILED');
  const actionNeeded = resources.filter((r) => getGcpUnifiedStatus(r) === 'ACTION_REQUIRED');
  const allCompleted = completedCount === totalCount && totalCount > 0;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const serviceStatus = getGcpGroupStatus(resources, 'serviceTfStatus');
  const bdcStatus = getGcpGroupStatus(resources, 'bdcTfStatus');

  const getGroupStatusColor = (groupStatus: GcpGroupStatus) => {
    if (groupStatus === 'COMPLETED') return statusColors.success;
    if (groupStatus === 'FAILED') return statusColors.error;
    if (groupStatus === 'IN_PROGRESS') return statusColors.warning;
    return statusColors.pending;
  };

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

  const mainCardColor = allCompleted ? statusColors.success : (failedResources.length > 0 ? statusColors.error : statusColors.warning);
  const statusText = allCompleted
    ? 'GCP 에이전트 설치 완료'
    : failedResources.length > 0
    ? 'GCP 에이전트 설치 중 오류 발생'
    : 'GCP 에이전트 설치 중...';

  const renderActionResource = (resource: GcpResourceStatus) => {
    const displayName = getResourceDisplayName(resource.name);

    return (
      <div key={resource.id} className={cn('px-4 py-3 rounded-lg border', statusColors.warning.bg, statusColors.warning.border)}>
        <div className="flex items-start gap-2">
          <svg className={cn('w-5 h-5 flex-shrink-0 mt-0.5', statusColors.warning.text)} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium text-gray-900">{displayName}</span>

            {resource.pendingAction === 'CREATE_PROXY_SUBNET' && resource.regionalManagedProxy && (
              <RegionalManagedProxyPanel proxy={resource.regionalManagedProxy} />
            )}

            {resource.pendingAction === 'APPROVE_PSC_CONNECTION' && resource.pscConnection && (
              <PscApprovalGuide pscConnection={resource.pscConnection} />
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full space-y-3">
      <div className={cn('px-4 py-3 rounded-lg border', mainCardColor.bg, mainCardColor.border)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {allCompleted ? (
              <svg className={cn('w-5 h-5 flex-shrink-0', mainCardColor.text)} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            ) : failedResources.length === 0 ? (
              <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            ) : null}
            <span className={cn('text-sm font-medium', mainCardColor.textDark)}>
              {statusText} ({completedCount}/{totalCount} 완료)
            </span>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className={cn('p-1 rounded transition-colors disabled:opacity-50 flex-shrink-0 ml-2', mainCardColor.textDark, 'hover:bg-white/50')}
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

        <div className="mt-3 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className={cn('text-xs', getGroupStatusColor(serviceStatus).textDark)}>
              ● GCP 리소스 생성: {GCP_GROUP_STATUS_LABELS[serviceStatus]}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn('text-xs', getGroupStatusColor(bdcStatus).textDark)}>
              ● 에이전트 연동: {GCP_GROUP_STATUS_LABELS[bdcStatus]}
            </span>
          </div>
        </div>

        <div className="mt-2 h-1.5 rounded-full bg-white/50 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-500', mainCardColor.dot)}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        {actionNeeded.length === 0 && failedResources.length === 0 && !allCompleted && (
          <p className="mt-1.5 text-xs text-gray-500">자동으로 설치가 진행 중입니다.</p>
        )}
      </div>

      {failedResources.length > 0 && failedResources.map((resource) => (
        <div key={resource.id} className={cn('px-4 py-3 rounded-lg border', statusColors.error.bg, statusColors.error.border)}>
          <div className="flex items-start gap-2">
            <svg className={cn('w-5 h-5 flex-shrink-0 mt-0.5', statusColors.error.text)} fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-gray-900">{getResourceDisplayName(resource.name)}</span>
              <span className={cn('ml-2 text-xs', statusColors.error.textDark)}>설치 중 오류가 발생했습니다</span>
              <p className="mt-0.5 text-xs text-gray-500">자동 복구를 시도합니다. 지속되면 관리자에게 문의하세요.</p>
            </div>
          </div>
        </div>
      ))}

      {actionNeeded.length > 0 && actionNeeded.map(renderActionResource)}
    </div>
  );
};
