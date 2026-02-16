'use client';

import { useState, useEffect, useMemo } from 'react';
import { AzureServiceIcon, isAzureResourceType } from '@/app/components/ui/AzureServiceIcon';
import { InstallationLoadingView } from '@/app/components/features/process-status/shared/InstallationLoadingView';
import { InstallationErrorView } from '@/app/components/features/process-status/shared/InstallationErrorView';
import { ActionCard } from '@/app/components/features/process-status/shared/ActionCard';
import { AzureResourceList } from '@/app/components/features/process-status/azure/AzureResourceList';
import { AzurePeApprovalGuide } from '@/app/components/features/process-status/azure/AzurePeApprovalGuide';
import { AzureSubnetGuide } from '@/app/projects/[projectId]/azure/AzureSubnetGuide';
import { getAzureInstallationStatus, checkAzureInstallation } from '@/app/lib/api/azure';
import { AppError } from '@/lib/errors';
import { statusColors, cn } from '@/lib/theme';
import type { Resource } from '@/lib/types';
import type { AzureV1InstallationStatus, AzureV1Resource, PrivateEndpointStatus } from '@/lib/types/azure';
import type { AzureResourceType } from '@/app/components/ui/AzureServiceIcon';

export type InstallStep =
  | 'SUBNET_REQUIRED'
  | 'VM_TF_REQUIRED'
  | 'PE_NOT_REQUESTED'
  | 'PE_PENDING'
  | 'PE_REJECTED'
  | 'COMPLETED';

export interface UnifiedInstallResource {
  id: string;
  name: string;
  resourceType: string;
  isVm: boolean;
  step: InstallStep;
  peId?: string;
  isCompleted: boolean;
}

interface AzureInstallationInlineProps {
  targetSourceId: number;
  resources: Resource[];
  onInstallComplete?: () => void;
}

const getVmInstallStep = (
  subnetExists: boolean,
  lbInstalled: boolean,
  peStatus?: PrivateEndpointStatus
): InstallStep => {
  if (!subnetExists) return 'SUBNET_REQUIRED';
  if (!lbInstalled) return 'VM_TF_REQUIRED';
  if (!peStatus || peStatus === 'NOT_REQUESTED') return 'PE_NOT_REQUESTED';
  if (peStatus === 'PENDING_APPROVAL') return 'PE_PENDING';
  if (peStatus === 'REJECTED') return 'PE_REJECTED';
  return 'COMPLETED';
};

const getDbInstallStep = (peStatus?: PrivateEndpointStatus): InstallStep => {
  if (!peStatus || peStatus === 'NOT_REQUESTED') return 'PE_NOT_REQUESTED';
  if (peStatus === 'PENDING_APPROVAL') return 'PE_PENDING';
  if (peStatus === 'REJECTED') return 'PE_REJECTED';
  return 'COMPLETED';
};

const downloadTfScript = (targetSourceId: number) => {
  window.open(`/api/v1/azure/target-sources/${targetSourceId}/vm-terraform-script`, '_blank');
};

const toInstallStep = (v1Resource: AzureV1Resource): InstallStep => {
  if (v1Resource.isVm && v1Resource.vmInstallation) {
    return getVmInstallStep(
      v1Resource.vmInstallation.subnetExists ?? false,
      v1Resource.vmInstallation.loadBalancer?.installed ?? false,
      v1Resource.privateEndpoint?.status as PrivateEndpointStatus | undefined,
    );
  }
  return getDbInstallStep(v1Resource.privateEndpoint?.status as PrivateEndpointStatus | undefined);
};

const getErrorMessage = (err: unknown): string => {
  if (err instanceof AppError) return err.message;
  if (err instanceof Error) return err.message;
  return '상태 조회에 실패했습니다.';
};

export const AzureInstallationInline = ({
  targetSourceId,
  resources,
  onInstallComplete,
}: AzureInstallationInlineProps) => {
  const [status, setStatus] = useState<AzureV1InstallationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSubnetGuide, setShowSubnetGuide] = useState(false);
  const [showPeGuide, setShowPeGuide] = useState<{ show: boolean; peId?: string }>({ show: false });

  const selectedResources = resources.filter(r => r.isSelected);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAzureInstallationStatus(targetSourceId);
      setStatus(data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      setError(null);
      const data = await checkAzureInstallation(targetSourceId);
      setStatus(data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchStatus(); }, [targetSourceId]);

  const unifiedResources: UnifiedInstallResource[] = useMemo(() => {
    const v1ResourceMap = new Map(
      (status?.resources ?? []).map(r => [r.resourceId, r]),
    );

    return selectedResources.map(resource => {
      const v1 = v1ResourceMap.get(resource.resourceId);
      const isVm = resource.type === 'AZURE_VM';

      if (!v1) {
        return {
          id: resource.id,
          name: resource.resourceId,
          resourceType: resource.type,
          isVm,
          step: 'PE_NOT_REQUESTED' as InstallStep,
          isCompleted: false,
        };
      }

      const step = toInstallStep(v1);
      return {
        id: resource.id,
        name: resource.resourceId,
        resourceType: resource.type,
        isVm: v1.isVm,
        step,
        peId: v1.privateEndpoint?.id,
        isCompleted: step === 'COMPLETED',
      };
    });
  }, [selectedResources, status]);

  const completedCount = unifiedResources.filter(r => r.isCompleted).length;
  const totalCount = unifiedResources.length;
  const allCompleted = completedCount === totalCount && totalCount > 0;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const hasError = unifiedResources.some(r => r.step === 'PE_REJECTED');

  // allCompleted 시 부모에 알림
  useEffect(() => {
    if (allCompleted) onInstallComplete?.();
  }, [allCompleted]);

  const subnetNeeded = unifiedResources.filter(r => r.step === 'SUBNET_REQUIRED');
  const vmTfNeeded = unifiedResources.filter(r => r.step === 'VM_TF_REQUIRED');
  const pePending = unifiedResources.filter(r => r.step === 'PE_PENDING');
  const peRejected = unifiedResources.filter(r => r.step === 'PE_REJECTED');
  const hasActionOrError = subnetNeeded.length > 0 || vmTfNeeded.length > 0 || pePending.length > 0 || peRejected.length > 0;

  if (loading) return <InstallationLoadingView provider="Azure" />;
  if (error) return <InstallationErrorView message={error} onRetry={fetchStatus} />;

  const mainCardColor = allCompleted ? statusColors.success : hasError ? statusColors.error : statusColors.warning;
  const statusText = allCompleted
    ? `Azure 에이전트 설치 완료 (${completedCount}/${totalCount})`
    : `Azure 에이전트 설치 중... (${completedCount}/${totalCount} 완료)`;

  return (
    <>
      <div className="w-full space-y-3">
        <div className={cn('px-4 py-3 rounded-lg border', mainCardColor.bg, mainCardColor.border)}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {allCompleted ? (
                <svg className={cn('w-5 h-5 flex-shrink-0', mainCardColor.text)} fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              ) : (
                <div className={cn('w-4 h-4 border-2 border-t-transparent rounded-full animate-spin flex-shrink-0', mainCardColor.border)} />
              )}
              <span className={cn('text-sm font-medium', mainCardColor.textDark)}>{statusText}</span>
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

          <div className="mt-2 h-1.5 rounded-full bg-white/50 overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-500', mainCardColor.dot)}
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {!allCompleted && !hasActionOrError && (
            <p className="mt-2 text-xs text-gray-500">
              자동으로 설치가 진행 중입니다.{'\n'}각 리소스에 보안 연결을 설정하고 있습니다.
            </p>
          )}

          <AzureResourceList resources={unifiedResources} />
        </div>

        {subnetNeeded.map(resource => (
          <ActionCard key={resource.id} title="조치 필요">
            <div className="flex items-center gap-2 mb-1">
              <AzureServiceIcon type={isAzureResourceType(resource.resourceType) ? resource.resourceType as AzureResourceType : 'AZURE_VM'} size="sm" />
              <span className="text-sm font-medium text-gray-900">{resource.name}</span>
            </div>
            <p className="text-sm text-gray-600 mb-2">
              네트워크 설정이 필요합니다. VM을 연동하려면 전용 네트워크(서브넷)가 필요합니다.
            </p>
            <button
              onClick={() => setShowSubnetGuide(true)}
              className={cn('text-sm font-medium hover:underline', statusColors.warning.textDark)}
            >
              네트워크 설정 가이드
            </button>
          </ActionCard>
        ))}

        {vmTfNeeded.length > 0 && (
          <ActionCard title="조치 필요">
            <p className="text-sm text-gray-600 mb-2">
              VM 환경 설정이 필요합니다. 설치 스크립트를 다운로드하여 VM에서 실행해주세요.
            </p>
            <button
              onClick={() => downloadTfScript(targetSourceId)}
              className={cn('text-sm font-medium hover:underline', statusColors.warning.textDark)}
            >
              설치 스크립트 다운로드
            </button>
          </ActionCard>
        )}

        {pePending.length > 0 && (
          <ActionCard title="조치 필요">
            <p className="text-sm text-gray-600 mb-2">
              연결 승인이 필요한 리소스가 {pePending.length}건 있습니다
            </p>
            <div className="space-y-1 mb-2">
              {pePending.map(resource => {
                const iconType: AzureResourceType = isAzureResourceType(resource.resourceType)
                  ? resource.resourceType as AzureResourceType
                  : 'AZURE_MSSQL';
                return (
                  <div key={resource.id} className="flex items-center gap-2 py-1">
                    <AzureServiceIcon type={iconType} size="sm" />
                    <span className="text-sm text-gray-900">{resource.name}</span>
                    <span className={cn('text-xs', statusColors.warning.textDark)}>승인 대기 중</span>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-gray-500 mb-1">Azure Portal에서 보안 연결 요청을 승인해주세요.</p>
            <button
              onClick={() => setShowPeGuide({ show: true, peId: pePending[0]?.peId })}
              className={cn('text-sm font-medium hover:underline', statusColors.warning.textDark)}
            >
              승인 방법 보기
            </button>
          </ActionCard>
        )}

        {peRejected.map(resource => (
          <ActionCard key={resource.id} title="연결 거부" variant="error">
            <div className="flex items-center gap-2 mb-1">
              <AzureServiceIcon
                type={isAzureResourceType(resource.resourceType) ? resource.resourceType as AzureResourceType : 'AZURE_MSSQL'}
                size="sm"
              />
              <span className="text-sm font-medium text-gray-900">{resource.name}</span>
            </div>
            <p className="text-sm text-gray-600 mb-2">
              보안 연결이 거부되었습니다. 재승인이 필요합니다.
            </p>
            <p className="text-xs text-gray-500 mb-1">Azure Portal에서 연결 요청을 다시 승인해주세요.</p>
            <button
              onClick={() => setShowPeGuide({ show: true, peId: resource.peId })}
              className={cn('text-sm font-medium hover:underline', statusColors.error.textDark)}
            >
              승인 방법 보기
            </button>
          </ActionCard>
        ))}
      </div>

      {showSubnetGuide && <AzureSubnetGuide onClose={() => setShowSubnetGuide(false)} />}
      {showPeGuide.show && <AzurePeApprovalGuide peId={showPeGuide.peId} onClose={() => setShowPeGuide({ show: false })} />}
    </>
  );
};
