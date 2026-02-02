'use client';

import { useState, useEffect, useMemo } from 'react';
import { Resource } from '@/lib/types';
import { AzureInstallationStatus, AzureVmInstallationStatus } from '@/lib/types/azure';
import { getAzureInstallationStatus, checkAzureInstallation, getAzureVmInstallationStatus } from '@/app/lib/api/azure';
import { AzureSubnetGuide } from '@/app/projects/[projectId]/azure/AzureSubnetGuide';

interface AzureInstallationInlineProps {
  projectId: string;
  resources: Resource[];  // project.resources
  onInstallComplete?: () => void;
}

type TabType = 'all' | 'action';

// 통합 설치 리소스
interface UnifiedInstallResource {
  id: string;
  name: string;
  tfStatus: 'PENDING' | 'COMPLETED';
  actionRequired?: {
    type: 'PE_APPROVAL' | 'SUBNET_SETUP' | 'BDC_CHECK' | 'BDC_RESUBMIT';
    message: string;
    peId?: string;
  };
  isCompleted: boolean;
}

const ITEMS_PER_PAGE = 5;

// 조치 필요 여부
const needsAction = (resource: UnifiedInstallResource): boolean => {
  return !resource.isCompleted;
};

// 조치 메시지 매핑
const ACTION_MESSAGES = {
  PE_APPROVAL: 'Azure Portal에서 승인 필요',
  SUBNET_SETUP: 'Subnet 미설정',
  BDC_CHECK: 'BDC측 확인 필요',
  BDC_RESUBMIT: 'BDC측 재신청 필요',
};

// 리소스 행 컴포넌트
const ResourceRow = ({
  resource,
  onShowSubnetGuide
}: {
  resource: UnifiedInstallResource;
  onShowSubnetGuide: () => void;
}) => {
  return (
    <div className={`p-3 rounded-lg border ${resource.isCompleted ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${resource.isCompleted ? 'bg-green-500' : 'bg-orange-500'}`} />
          <div className="min-w-0 flex-1">
            {/* 리소스 이름 */}
            <div className="text-sm font-medium text-gray-900 truncate">
              {resource.name}
            </div>

            {/* TF 상태 | 추가 조치 */}
            <div className="flex items-center gap-1 mt-1 text-xs text-gray-600">
              <span>TF: {resource.tfStatus === 'COMPLETED' ? '완료' : '대기 중'}</span>
              {resource.actionRequired && (
                <>
                  <span className="text-gray-400">|</span>
                  <span className="text-orange-600">
                    {ACTION_MESSAGES[resource.actionRequired.type]}
                  </span>
                </>
              )}
            </div>

            {/* PE ID (있는 경우) */}
            {resource.actionRequired?.peId && (
              <div className="text-xs text-gray-400 mt-0.5 font-mono truncate">
                PE: {resource.actionRequired.peId}
              </div>
            )}

            {/* Subnet 가이드 링크 */}
            {resource.actionRequired?.type === 'SUBNET_SETUP' && (
              <button
                onClick={onShowSubnetGuide}
                className="text-xs text-blue-600 hover:underline mt-1"
              >
                Subnet 설정 가이드
              </button>
            )}
          </div>
        </div>

        {/* 완료 체크 아이콘 */}
        {resource.isCompleted && (
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
  resources,
  onInstallComplete,
}: AzureInstallationInlineProps) => {
  const [dbStatus, setDbStatus] = useState<AzureInstallationStatus | null>(null);
  const [vmStatus, setVmStatus] = useState<AzureVmInstallationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [showSubnetGuide, setShowSubnetGuide] = useState(false);

  // 선택된 리소스만 필터링
  const selectedResources = resources.filter(r => r.isSelected);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      setError(null);

      const [dbData, vmData] = await Promise.all([
        getAzureInstallationStatus(projectId),
        getAzureVmInstallationStatus(projectId).catch(() => null),
      ]);

      setDbStatus(dbData);
      setVmStatus(vmData);

      if (dbData.installed) {
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

      const [dbData, vmData] = await Promise.all([
        checkAzureInstallation(projectId),
        getAzureVmInstallationStatus(projectId).catch(() => null),
      ]);

      setDbStatus(dbData);
      setVmStatus(vmData);

      if (dbData.installed) {
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

  // project.resources + API 응답을 통합
  const unifiedResources: UnifiedInstallResource[] = useMemo(() => {
    // DB 상태 맵 (resourceId -> AzureResourceStatus)
    const dbStatusMap = new Map(
      (dbStatus?.resources || []).map(r => [r.resourceId, r])
    );

    // VM 상태 맵 (vmId -> AzureVmStatus)
    const vmStatusMap = new Map(
      (vmStatus?.vms || []).map(v => [v.vmId, v])
    );

    return selectedResources.map(resource => {
      const isVm = resource.type === 'AZURE_VM';

      if (isVm) {
        // VM 리소스
        const vm = vmStatusMap.get(resource.id);
        const tfCompleted = vm?.terraformInstalled ?? false;
        const subnetExists = vm?.subnetExists ?? false;
        const isCompleted = tfCompleted && subnetExists;

        return {
          id: resource.id,
          name: resource.resourceId,
          tfStatus: tfCompleted ? 'COMPLETED' : 'PENDING',
          actionRequired: !subnetExists ? {
            type: 'SUBNET_SETUP' as const,
            message: ACTION_MESSAGES.SUBNET_SETUP,
          } : undefined,
          isCompleted,
        };
      } else {
        // DB 리소스 (PE 기반)
        const db = dbStatusMap.get(resource.id);
        const peStatus = db?.privateEndpoint.status;
        const tfCompleted = peStatus && peStatus !== 'NOT_REQUESTED';
        const isCompleted = peStatus === 'APPROVED';

        let actionRequired: UnifiedInstallResource['actionRequired'] = undefined;
        if (peStatus === 'PENDING_APPROVAL') {
          actionRequired = {
            type: 'PE_APPROVAL',
            message: ACTION_MESSAGES.PE_APPROVAL,
            peId: db?.privateEndpoint.id,
          };
        } else if (peStatus === 'REJECTED') {
          actionRequired = {
            type: 'BDC_RESUBMIT',
            message: ACTION_MESSAGES.BDC_RESUBMIT,
          };
        } else if (peStatus === 'NOT_REQUESTED') {
          actionRequired = {
            type: 'BDC_CHECK',
            message: ACTION_MESSAGES.BDC_CHECK,
          };
        }

        return {
          id: resource.id,
          name: resource.resourceId,
          tfStatus: tfCompleted ? 'COMPLETED' : 'PENDING',
          actionRequired,
          isCompleted,
        };
      }
    });
  }, [selectedResources, dbStatus, vmStatus]);

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
  const completedCount = unifiedResources.filter(r => r.isCompleted).length;
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
                key={resource.id}
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
