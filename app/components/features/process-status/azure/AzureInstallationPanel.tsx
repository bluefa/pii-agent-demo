'use client';

import { useState, useEffect } from 'react';
import { AzureInstallationStatus } from '@/lib/types/azure';
import { getAzureInstallationStatus, checkAzureInstallation } from '@/app/lib/api/azure';
import { PrivateEndpointStatusRow } from './PrivateEndpointStatusRow';

interface AzureInstallationPanelProps {
  projectId: string;
  onClose: () => void;
  onInstallComplete?: () => void;
}

export const AzureInstallationPanel = ({
  projectId,
  onClose,
  onInstallComplete,
}: AzureInstallationPanelProps) => {
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Azure DB 설치 상태</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-3 max-h-80 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="ml-2 text-gray-500">로딩 중...</span>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-500 mb-2">{error}</p>
              <button
                onClick={fetchStatus}
                className="text-blue-600 hover:underline text-sm"
              >
                다시 시도
              </button>
            </div>
          ) : status?.resources.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              DB 리소스가 없습니다.
            </div>
          ) : (
            status?.resources.map((resource) => (
              <PrivateEndpointStatusRow key={resource.resourceId} resource={resource} />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-xl">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">
              {status?.installed ? (
                <span className="text-green-600 font-medium">모든 Private Endpoint가 승인되었습니다.</span>
              ) : (
                <span>{approvedCount}/{totalCount} 승인 완료</span>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-medium"
              >
                {refreshing ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                )}
                새로고침
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium text-sm"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
