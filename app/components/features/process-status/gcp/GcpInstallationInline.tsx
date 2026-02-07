'use client';

import { useState, useEffect, useMemo } from 'react';
import { getGcpInstallationStatus, checkGcpInstallation } from '@/app/lib/api/gcp';
import { GCP_CONNECTION_TYPE_LABELS, GCP_TF_STATUS_LABELS } from '@/lib/constants/gcp';
import { statusColors, cn } from '@/lib/theme';
import { RegionalManagedProxyPanel } from './RegionalManagedProxyPanel';
import { PscApprovalGuide } from './PscApprovalGuide';
import type { GcpInstallationStatus, GcpInstallResource, GcpTfStatus } from '@/lib/types/gcp';

interface GcpInstallationInlineProps {
  projectId: string;
  onInstallComplete?: () => void;
}

type TabType = 'all' | 'action';

const ITEMS_PER_PAGE = 5;

const getTfStatusColor = (status: GcpTfStatus) => {
  switch (status) {
    case 'COMPLETED': return statusColors.success;
    case 'FAILED': return statusColors.error;
    case 'IN_PROGRESS': return statusColors.warning;
    default: return statusColors.pending;
  }
};

const TfStatusRow = ({ label, status }: { label: string; status: GcpTfStatus }) => {
  const color = getTfStatusColor(status);
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-gray-600">{label}</span>
      <span className={cn('text-xs font-medium', color.textDark)}>
        {GCP_TF_STATUS_LABELS[status]}
      </span>
    </div>
  );
};

const ResourceRow = ({
  resource,
  projectId,
  onRefresh,
}: {
  resource: GcpInstallResource;
  projectId: string;
  onRefresh: () => void;
}) => {
  const connectionLabel = GCP_CONNECTION_TYPE_LABELS[resource.connectionType];

  return (
    <div className={cn(
      'p-3 rounded-lg border',
      resource.isCompleted
        ? cn(statusColors.success.bg, statusColors.success.border)
        : 'bg-white border-gray-200'
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900 truncate">
              {resource.name}
            </span>
            <span className={cn(
              'px-1.5 py-0.5 text-xs font-medium rounded',
              statusColors.info.bg, statusColors.info.textDark
            )}>
              {connectionLabel}
            </span>
          </div>

          <div className="mt-2 space-y-0.5">
            <TfStatusRow label="Service TF" status={resource.serviceTfStatus} />
            <TfStatusRow label="BDC TF" status={resource.bdcTfStatus} />
          </div>

          {resource.connectionType === 'PRIVATE_IP' && resource.regionalManagedProxy && (
            <RegionalManagedProxyPanel
              projectId={projectId}
              resourceId={resource.id}
              proxy={resource.regionalManagedProxy}
              onSubnetCreated={onRefresh}
            />
          )}

          {resource.connectionType === 'PSC' && resource.pscConnection && (
            <PscApprovalGuide pscConnection={resource.pscConnection} />
          )}
        </div>

        {resource.isCompleted && (
          <svg className={cn('w-5 h-5 flex-shrink-0 mt-1', statusColors.success.text)} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        )}
      </div>
    </div>
  );
};

const Pagination = ({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) => {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-2 pt-2">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <span className="text-xs text-gray-500">{currentPage} / {totalPages}</span>
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
};

export const GcpInstallationInline = ({
  projectId,
  onInstallComplete,
}: GcpInstallationInlineProps) => {
  const [status, setStatus] = useState<GcpInstallationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [currentPage, setCurrentPage] = useState(1);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getGcpInstallationStatus(projectId);
      setStatus(data);
      if (data.resources.every((r) => r.isCompleted)) {
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
      const data = await checkGcpInstallation(projectId);
      setStatus(data);
      if (data.resources.every((r) => r.isCompleted)) {
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
  }, [projectId]);

  const resources = status?.resources || [];
  const actionNeeded = useMemo(() => resources.filter((r) => !r.isCompleted), [resources]);
  const currentResources = activeTab === 'all' ? resources : actionNeeded;
  const totalPages = Math.ceil(currentResources.length / ITEMS_PER_PAGE);
  const paginatedResources = currentResources.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const completedCount = resources.filter((r) => r.isCompleted).length;
  const totalCount = resources.length;

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab]);

  if (loading) {
    return (
      <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg">
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

  return (
    <div className="w-full border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">GCP 설치 상태</span>
          <div className="flex items-center gap-2">
            <span className={cn(
              'px-2 py-0.5 text-xs font-medium rounded-full',
              completedCount === totalCount
                ? cn(statusColors.success.bg, statusColors.success.textDark)
                : cn(statusColors.warning.bg, statusColors.warning.textDark)
            )}>
              {completedCount}/{totalCount} 완료
            </span>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-50"
              title="새로고침"
            >
              {refreshing ? (
                <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="flex border-b border-gray-200 bg-white">
        <button
          onClick={() => setActiveTab('all')}
          className={cn(
            'flex-1 px-4 py-2 text-sm font-medium transition-colors',
            activeTab === 'all'
              ? cn('text-blue-600 border-b-2 border-blue-500', statusColors.info.bg)
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          )}
        >
          전체 ({resources.length})
        </button>
        <button
          onClick={() => setActiveTab('action')}
          className={cn(
            'flex-1 px-4 py-2 text-sm font-medium transition-colors',
            activeTab === 'action'
              ? cn('text-orange-600 border-b-2 border-orange-500', statusColors.warning.bg)
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          )}
        >
          조치 필요 ({actionNeeded.length})
        </button>
      </div>

      <div className="p-3 space-y-2 bg-white">
        {paginatedResources.length === 0 ? (
          <div className="text-center py-4 text-sm text-gray-500">
            {activeTab === 'action' ? '조치가 필요한 리소스가 없습니다.' : '리소스가 없습니다.'}
          </div>
        ) : (
          paginatedResources.map((resource) => (
            <ResourceRow key={resource.id} resource={resource} projectId={projectId} onRefresh={handleRefresh} />
          ))
        )}
        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
      </div>
    </div>
  );
};
