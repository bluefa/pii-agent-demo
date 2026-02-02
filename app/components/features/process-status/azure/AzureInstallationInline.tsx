'use client';

import { useState, useEffect, useMemo } from 'react';
import { AzureInstallationStatus, AzureVmStatus, AzureResourceStatus } from '@/lib/types/azure';
import { getAzureInstallationStatus, checkAzureInstallation } from '@/app/lib/api/azure';
import { AzureSubnetGuide } from '@/app/projects/[projectId]/azure/AzureSubnetGuide';

interface AzureInstallationInlineProps {
  projectId: string;
  vmStatus?: AzureVmStatus[];
  onInstallComplete?: () => void;
}

type TabType = 'all' | 'action';
type UnifiedResource =
  | { type: 'db'; data: AzureResourceStatus }
  | { type: 'vm'; data: AzureVmStatus };

const ITEMS_PER_PAGE = 5;

// 조치 필요 여부 판단
const needsAction = (resource: UnifiedResource): boolean => {
  if (resource.type === 'db') {
    const status = resource.data.privateEndpoint.status;
    return status !== 'APPROVED';
  } else {
    return !resource.data.subnetExists || !resource.data.terraformInstalled;
  }
};

// 완료 여부 판단
const isCompleted = (resource: UnifiedResource): boolean => {
  if (resource.type === 'db') {
    return resource.data.privateEndpoint.status === 'APPROVED';
  } else {
    return resource.data.subnetExists && resource.data.terraformInstalled;
  }
};

// 조치 안내 메시지
const getActionMessage = (resource: UnifiedResource): string | null => {
  if (resource.type === 'db') {
    const status = resource.data.privateEndpoint.status;
    switch (status) {
      case 'PENDING_APPROVAL':
        return 'Azure Portal에서 Private Endpoint 승인';
      case 'REJECTED':
        return 'BDC측 재신청 필요';
      case 'NOT_REQUESTED':
        return 'BDC측 확인 필요';
      default:
        return null;
    }
  } else {
    if (!resource.data.subnetExists) {
      return 'Subnet 설정 필요';
    }
    if (!resource.data.terraformInstalled) {
      return 'Terraform 설치 대기 중';
    }
    return null;
  }
};

// 상태 색상
const getStatusColor = (resource: UnifiedResource): string => {
  if (resource.type === 'db') {
    const status = resource.data.privateEndpoint.status;
    switch (status) {
      case 'APPROVED': return 'bg-green-500';
      case 'PENDING_APPROVAL': return 'bg-orange-500';
      case 'REJECTED': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  } else {
    if (resource.data.subnetExists && resource.data.terraformInstalled) {
      return 'bg-green-500';
    }
    return 'bg-orange-500';
  }
};

// 리소스 행 컴포넌트
const ResourceRow = ({
  resource,
  onShowSubnetGuide
}: {
  resource: UnifiedResource;
  onShowSubnetGuide: () => void;
}) => {
  const actionMessage = getActionMessage(resource);
  const statusColor = getStatusColor(resource);
  const completed = isCompleted(resource);

  const name = resource.type === 'db' ? resource.data.resourceName : resource.data.vmName;
  const peId = resource.type === 'db' ? resource.data.privateEndpoint.id : null;

  return (
    <div className={`p-3 rounded-lg border ${completed ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${statusColor}`} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-900 truncate">{name}</span>
              <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${
                resource.type === 'db' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
              }`}>
                {resource.type === 'db' ? 'DB' : 'VM'}
              </span>
            </div>
            {peId && (
              <div className="text-xs text-gray-500 mt-0.5 font-mono truncate">
                PE: {peId}
              </div>
            )}
            {actionMessage && (
              <div className="flex items-center gap-1 mt-1">
                <span className="text-xs text-orange-600">👉 {actionMessage}</span>
                {resource.type === 'vm' && !resource.data.subnetExists && (
                  <button
                    onClick={onShowSubnetGuide}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    [가이드]
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
        {completed && (
          <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        )}
      </div>
    </div>
  );
};

// Pagination 컴포넌트
const Pagination = ({
  currentPage,
  totalPages,
  onPageChange
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
      <span className="text-xs text-gray-500">
        {currentPage} / {totalPages}
      </span>
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

export const AzureInstallationInline = ({
  projectId,
  vmStatus = [],
  onInstallComplete,
}: AzureInstallationInlineProps) => {
  const [status, setStatus] = useState<AzureInstallationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [showSubnetGuide, setShowSubnetGuide] = useState(false);

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

  // 통합 리소스 목록
  const unifiedResources: UnifiedResource[] = useMemo(() => {
    const dbResources: UnifiedResource[] = (status?.resources || []).map(r => ({ type: 'db', data: r }));
    const vmResources: UnifiedResource[] = vmStatus.map(v => ({ type: 'vm', data: v }));
    return [...dbResources, ...vmResources];
  }, [status, vmStatus]);

  // 조치 필요 리소스
  const actionNeededResources = useMemo(() =>
    unifiedResources.filter(needsAction),
    [unifiedResources]
  );

  // 현재 탭의 리소스
  const currentResources = activeTab === 'all' ? unifiedResources : actionNeededResources;

  // 페이지네이션
  const totalPages = Math.ceil(currentResources.length / ITEMS_PER_PAGE);
  const paginatedResources = currentResources.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // 탭 변경 시 페이지 리셋
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab]);

  // 진행률
  const completedCount = unifiedResources.filter(isCompleted).length;
  const totalCount = unifiedResources.length;

  // 로딩 상태
  if (loading) {
    return (
      <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-600">Azure 설치 상태 확인 중...</span>
        </div>
      </div>
    );
  }

  // 에러 상태
  if (error) {
    return (
      <div className="w-full px-4 py-3 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center justify-between">
          <span className="text-sm text-red-600">{error}</span>
          <button onClick={fetchStatus} className="text-sm text-red-700 hover:underline">
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="w-full border border-gray-200 rounded-lg overflow-hidden">
        {/* 헤더 */}
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Azure 설치 상태</span>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                completedCount === totalCount
                  ? 'bg-green-100 text-green-700'
                  : 'bg-orange-100 text-orange-700'
              }`}>
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

        {/* 탭 */}
        <div className="flex border-b border-gray-200 bg-white">
          <button
            onClick={() => setActiveTab('all')}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'all'
                ? 'text-blue-600 border-b-2 border-blue-500 bg-blue-50'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            전체 ({unifiedResources.length})
          </button>
          <button
            onClick={() => setActiveTab('action')}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'action'
                ? 'text-orange-600 border-b-2 border-orange-500 bg-orange-50'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <span className="flex items-center justify-center gap-1">
              {actionNeededResources.length > 0 && (
                <span className="text-orange-500">⚠️</span>
              )}
              조치 필요 ({actionNeededResources.length})
            </span>
          </button>
        </div>

        {/* 리소스 목록 */}
        <div className="p-3 space-y-2 bg-white">
          {paginatedResources.length === 0 ? (
            <div className="text-center py-4 text-sm text-gray-500">
              {activeTab === 'action' ? '조치가 필요한 리소스가 없습니다.' : '리소스가 없습니다.'}
            </div>
          ) : (
            paginatedResources.map((resource) => (
              <ResourceRow
                key={resource.type === 'db' ? resource.data.resourceId : resource.data.vmId}
                resource={resource}
                onShowSubnetGuide={() => setShowSubnetGuide(true)}
              />
            ))
          )}

          {/* 페이지네이션 */}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </div>
      </div>

      {/* Subnet 가이드 모달 */}
      {showSubnetGuide && (
        <AzureSubnetGuide onClose={() => setShowSubnetGuide(false)} />
      )}
    </>
  );
};
