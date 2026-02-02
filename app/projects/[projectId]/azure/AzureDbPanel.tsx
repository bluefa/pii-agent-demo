'use client';

import { useState, useEffect } from 'react';
import { AzureInstallationStatus, AzureResourceStatus } from '@/lib/types/azure';
import { getAzureInstallationStatus, checkAzureInstallation } from '@/app/lib/api/azure';
import { PRIVATE_ENDPOINT_STATUS_LABELS } from '@/lib/constants/azure';
import { AzureServiceIcon, isAzureResourceType } from '@/app/components/ui/AzureServiceIcon';

interface AzureDbPanelProps {
  projectId: string;
  onInstallComplete?: () => void;
}

const StatusBadge = ({ status }: { status: AzureResourceStatus['privateEndpoint']['status'] }) => {
  const colors = {
    NOT_REQUESTED: 'bg-gray-100 text-gray-600',
    PENDING_APPROVAL: 'bg-orange-100 text-orange-700',
    APPROVED: 'bg-green-100 text-green-700',
    REJECTED: 'bg-red-100 text-red-700',
  };

  return (
    <span className={`px-2 py-0.5 text-xs rounded-full ${colors[status]}`}>
      {PRIVATE_ENDPOINT_STATUS_LABELS[status]}
    </span>
  );
};

const ResourceRow = ({ resource }: { resource: AzureResourceStatus }) => {
  const isApproved = resource.privateEndpoint.status === 'APPROVED';
  const tfComplete = resource.privateEndpoint.status !== 'NOT_REQUESTED';

  return (
    <div className={`p-4 rounded-lg border ${isApproved ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-white'}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          {isAzureResourceType(resource.resourceType) && (
            <AzureServiceIcon type={resource.resourceType} size="md" />
          )}
          <div>
            <div className="font-medium text-gray-900">{resource.resourceName}</div>
            <div className="text-xs text-gray-500 font-mono">{resource.resourceId}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isApproved && (
            <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          )}
        </div>
      </div>
      <div className="mt-2 flex items-center gap-3 text-sm">
        <span className={tfComplete ? 'text-green-600' : 'text-gray-500'}>
          TF {tfComplete ? '완료' : '대기'}
        </span>
        <span className="text-gray-300">|</span>
        <StatusBadge status={resource.privateEndpoint.status} />
      </div>
    </div>
  );
};

export const AzureDbPanel = ({ projectId, onInstallComplete }: AzureDbPanelProps) => {
  const [status, setStatus] = useState<AzureInstallationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAzureInstallationStatus(projectId);
      setStatus(data);
      if (data.installed) {
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
      const data = await checkAzureInstallation(projectId);
      setStatus(data);
      if (data.installed) {
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

  const approvedCount = status?.resources.filter(r => r.privateEndpoint.status === 'APPROVED').length ?? 0;
  const totalCount = status?.resources.length ?? 0;

  return (
    <div className="bg-white rounded-xl shadow-sm">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            DB Private Endpoint 상태
          </h3>
          <button
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 disabled:opacity-50 transition-colors text-sm"
          >
            {refreshing ? (
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
            새로고침
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="ml-2 text-gray-500">로딩 중...</span>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-red-500 mb-2">{error}</p>
            <button onClick={fetchStatus} className="text-blue-600 hover:underline text-sm">
              다시 시도
            </button>
          </div>
        ) : status?.resources.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            DB 리소스가 없습니다.
          </div>
        ) : (
          status?.resources.map((resource) => (
            <ResourceRow key={resource.resourceId} resource={resource} />
          ))
        )}
      </div>

      {/* Footer */}
      {!loading && !error && totalCount > 0 && (
        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 rounded-b-xl">
          {status?.installed ? (
            <span className="text-green-600 font-medium text-sm">
              모든 Private Endpoint가 승인되었습니다.
            </span>
          ) : (
            <span className="text-gray-500 text-sm">
              {approvedCount}/{totalCount} 승인 완료
            </span>
          )}
        </div>
      )}
    </div>
  );
};
