'use client';

import { useState, useEffect, useMemo } from 'react';
import { Resource } from '@/lib/types';
import { AzureInstallationStatus, AzureVmInstallationStatus, PrivateEndpointStatus } from '@/lib/types/azure';
import { getAzureInstallationStatus, checkAzureInstallation, getAzureVmInstallationStatus } from '@/app/lib/api/azure';
import { AzureSubnetGuide } from '@/app/projects/[projectId]/azure/AzureSubnetGuide';
import { AzureServiceIcon, AzureResourceType, isAzureResourceType } from '@/app/components/ui/AzureServiceIcon';

interface AzureInstallationInlineProps {
  projectId: string;
  resources: Resource[];
  onInstallComplete?: () => void;
}

type TabType = 'all' | 'action';

// 설치 단계
type InstallStep =
  | 'SUBNET_REQUIRED'    // VM: Subnet 설정 필요
  | 'VM_TF_REQUIRED'     // VM: Terraform 설치 필요
  | 'PE_NOT_REQUESTED'   // PE 승인 요청 필요 (BDC측 확인)
  | 'PE_PENDING'         // PE 승인 대기 중
  | 'PE_REJECTED'        // PE 거부됨
  | 'COMPLETED';         // 완료

// 통합 설치 리소스
interface UnifiedInstallResource {
  id: string;
  name: string;
  resourceType: string;
  isVm: boolean;
  // 현재 설치 단계
  step: InstallStep;
  // PE 정보 (있는 경우)
  peId?: string;
  isCompleted: boolean;
}

const ITEMS_PER_PAGE = 5;

// 단계별 표시 정보
const STEP_INFO: Record<InstallStep, { label: string; color: string; bgColor: string }> = {
  SUBNET_REQUIRED: { label: 'Subnet 설정 필요', color: 'text-orange-600', bgColor: 'bg-orange-50' },
  VM_TF_REQUIRED: { label: 'VM TF 설치 필요', color: 'text-blue-600', bgColor: 'bg-blue-50' },
  PE_NOT_REQUESTED: { label: 'BDC측 Private Endpoint 승인요청 필요', color: 'text-gray-600', bgColor: 'bg-gray-50' },
  PE_PENDING: { label: 'PE 승인 대기', color: 'text-orange-600', bgColor: 'bg-orange-50' },
  PE_REJECTED: { label: 'PE 거부됨 (재신청 필요)', color: 'text-red-600', bgColor: 'bg-red-50' },
  COMPLETED: { label: '완료', color: 'text-green-600', bgColor: 'bg-green-50' },
};

// TF Script 다운로드
const downloadTfScript = (projectId: string) => {
  window.open(`/api/azure/projects/${projectId}/vm-terraform-script`, '_blank');
};

// PE 승인 가이드 모달
const PeApprovalGuide = ({ peId, onClose }: { peId?: string; onClose: () => void }) => (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
    <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 p-6" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Private Endpoint 승인 방법</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="space-y-4 text-sm text-gray-600">
        <p>Azure Portal에서 Private Endpoint 연결 요청을 승인해야 합니다.</p>

        {peId && (
          <div className="p-3 bg-gray-50 rounded-lg">
            <span className="text-xs text-gray-500">Private Endpoint ID</span>
            <p className="font-mono text-sm text-gray-900 break-all">{peId}</p>
          </div>
        )}

        <div className="space-y-2">
          <p className="font-medium text-gray-900">승인 절차:</p>
          <ol className="list-decimal list-inside space-y-1 text-gray-600">
            <li>Azure Portal에 로그인</li>
            <li>해당 리소스 (DB/Storage 등)로 이동</li>
            <li><span className="font-medium">네트워킹 → 프라이빗 엔드포인트 연결</span> 메뉴 선택</li>
            <li>대기 중인 연결 요청 선택 후 <span className="font-medium text-green-600">승인</span> 클릭</li>
          </ol>
        </div>

        <a
          href="https://portal.azure.com/#browse/Microsoft.Network%2FprivateEndpoints"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700"
        >
          Azure Portal에서 Private Endpoints 보기
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          onClick={onClose}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
        >
          닫기
        </button>
      </div>
    </div>
  </div>
);

// 리소스 행 컴포넌트
const ResourceRow = ({
  resource,
  onShowSubnetGuide,
  onShowPeGuide,
}: {
  resource: UnifiedInstallResource;
  onShowSubnetGuide: () => void;
  onShowPeGuide: (peId?: string) => void;
}) => {
  const iconType = isAzureResourceType(resource.resourceType)
    ? resource.resourceType as AzureResourceType
    : 'AZURE_MSSQL';

  const stepInfo = STEP_INFO[resource.step];

  return (
    <div className={`p-3 rounded-lg border ${resource.isCompleted ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`}>
      <div className="flex items-start justify-between gap-3">
        {/* 아이콘 */}
        <div className="flex-shrink-0 mt-0.5">
          <AzureServiceIcon type={iconType} size="md" />
        </div>

        {/* 내용 */}
        <div className="min-w-0 flex-1">
          {/* 리소스 이름 */}
          <div className="text-sm font-medium text-gray-900 truncate">
            {resource.name}
          </div>

          {/* 상태 표시 */}
          <div className="flex items-center flex-wrap gap-x-2 gap-y-1 mt-1">
            <span className={`text-xs font-medium ${stepInfo.color}`}>
              {stepInfo.label}
            </span>
          </div>

          {/* PE ID (PE 상태일 때만) */}
          {resource.peId && (resource.step === 'PE_PENDING' || resource.step === 'PE_REJECTED') && (
            <div className="text-xs text-gray-400 mt-1 font-mono truncate">
              PE: {resource.peId}
            </div>
          )}

          {/* 안내 문구 및 액션 버튼 */}
          {!resource.isCompleted && (
            <div className="mt-2">
              {resource.step === 'PE_NOT_REQUESTED' && (
                <p className="text-xs text-gray-500">
                  현재는 조치가 필요 없습니다. BDC에서 승인요청 완료 후 Azure Portal에서 승인하시면 됩니다.
                </p>
              )}

              <div className="flex items-center gap-2 mt-1">
                {resource.step === 'SUBNET_REQUIRED' && (
                  <button
                    onClick={onShowSubnetGuide}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-orange-50 text-orange-600 rounded hover:bg-orange-100 transition-colors"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Subnet 가이드
                  </button>
                )}

                {resource.step === 'PE_PENDING' && (
                  <button
                    onClick={() => onShowPeGuide(resource.peId)}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-orange-50 text-orange-600 rounded hover:bg-orange-100 transition-colors"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    승인 가이드
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 완료 체크 아이콘 */}
        {resource.isCompleted && (
          <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
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

// VM 설치 단계 결정
const getVmInstallStep = (
  subnetExists: boolean,
  terraformInstalled: boolean,
  peStatus?: PrivateEndpointStatus
): InstallStep => {
  // 1. Subnet 확인
  if (!subnetExists) return 'SUBNET_REQUIRED';
  // 2. TF 설치 확인
  if (!terraformInstalled) return 'VM_TF_REQUIRED';
  // 3. PE 상태 확인
  if (!peStatus || peStatus === 'NOT_REQUESTED') return 'PE_NOT_REQUESTED';
  if (peStatus === 'PENDING_APPROVAL') return 'PE_PENDING';
  if (peStatus === 'REJECTED') return 'PE_REJECTED';
  return 'COMPLETED';
};

// Non-VM (DB) 설치 단계 결정
const getDbInstallStep = (peStatus?: PrivateEndpointStatus): InstallStep => {
  if (!peStatus || peStatus === 'NOT_REQUESTED') return 'PE_NOT_REQUESTED';
  if (peStatus === 'PENDING_APPROVAL') return 'PE_PENDING';
  if (peStatus === 'REJECTED') return 'PE_REJECTED';
  return 'COMPLETED';
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
  const [showPeGuide, setShowPeGuide] = useState<{ show: boolean; peId?: string }>({ show: false });

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
        const vm = vmStatusMap.get(resource.resourceId);
        const subnetExists = vm?.subnetExists ?? false;
        const terraformInstalled = vm?.terraformInstalled ?? false;
        const peStatus = vm?.privateEndpoint?.status;
        const step = getVmInstallStep(subnetExists, terraformInstalled, peStatus);

        return {
          id: resource.id,
          name: resource.resourceId,
          resourceType: resource.type,
          isVm: true,
          step,
          peId: vm?.privateEndpoint?.id,
          isCompleted: step === 'COMPLETED',
        };
      } else {
        // DB 리소스
        const db = dbStatusMap.get(resource.resourceId);
        const peStatus = db?.privateEndpoint?.status;
        const step = getDbInstallStep(peStatus);

        return {
          id: resource.id,
          name: resource.resourceId,
          resourceType: resource.type,
          isVm: false,
          step,
          peId: db?.privateEndpoint?.id,
          isCompleted: step === 'COMPLETED',
        };
      }
    });
  }, [selectedResources, dbStatus, vmStatus]);

  // 조치 필요 리소스
  const actionNeededResources = useMemo(() =>
    unifiedResources.filter(r => !r.isCompleted),
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

  // VM TF Script 다운로드 필요 여부
  const hasVmNeedingTf = unifiedResources.some(r => r.isVm && r.step === 'VM_TF_REQUIRED');

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
              {/* VM TF Script 일괄 다운로드 */}
              {hasVmNeedingTf && (
                <button
                  onClick={() => downloadTfScript(projectId)}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors"
                  title="VM Terraform 스크립트 일괄 다운로드"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  TF Script
                </button>
              )}
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
                onShowPeGuide={(peId) => setShowPeGuide({ show: true, peId })}
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

      {/* PE 승인 가이드 모달 */}
      {showPeGuide.show && (
        <PeApprovalGuide
          peId={showPeGuide.peId}
          onClose={() => setShowPeGuide({ show: false })}
        />
      )}
    </>
  );
};
