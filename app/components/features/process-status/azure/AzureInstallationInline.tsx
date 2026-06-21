'use client';

import { useEffect, useMemo } from 'react';
import { InstallationLoadingView } from '@/app/components/features/process-status/shared/InstallationLoadingView';
import { InstallationErrorView } from '@/app/components/features/process-status/shared/InstallationErrorView';
import { InstallTaskPipeline } from '@/app/components/features/process-status/install-task-pipeline/InstallTaskPipeline';
import { InstallResourceTable } from '@/app/components/features/process-status/install-task-pipeline/InstallResourceTable';
import { joinAzureResources } from '@/app/components/features/process-status/install-task-pipeline/join-installation-resources';
import { getAzureInstallationStatus, checkAzureInstallation } from '@/app/lib/api/azure';
import { useInstallationStatus } from '@/app/hooks/useInstallationStatus';
import { buildAzurePipelineItems } from '@/lib/constants/azure-install';
import { formatDateTime } from '@/lib/utils/date';
import { statusColors, interactiveColors, cn, textColors } from '@/lib/theme';
import type { ConfirmedResource } from '@/lib/types/resources';
import type { AzureV1InstallationStatus, AzureV1Resource, PrivateEndpointStatus } from '@/lib/types/azure';

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
  confirmed: readonly ConfirmedResource[];
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

const toInstallStep = (v1Resource: AzureV1Resource): InstallStep => {
  if (v1Resource.resourceType === 'AZURE_VM' && v1Resource.vmInstallation) {
    return getVmInstallStep(
      v1Resource.vmInstallation.subnetExists ?? false,
      v1Resource.vmInstallation.loadBalancer?.installed ?? false,
      v1Resource.privateEndpoint?.status as PrivateEndpointStatus | undefined,
    );
  }
  return getDbInstallStep(v1Resource.privateEndpoint?.status as PrivateEndpointStatus | undefined);
};

const getLastCheckedLabel = (checkedAt?: string): string | null =>
  checkedAt ? formatDateTime(checkedAt) : null;

export const AzureInstallationInline = ({
  targetSourceId,
  confirmed,
  onInstallComplete,
}: AzureInstallationInlineProps) => {
  const { status, loading, refreshing, error, fetchStatus, refresh } =
    useInstallationStatus<AzureV1InstallationStatus>({
      targetSourceId,
      getFn: getAzureInstallationStatus,
      checkFn: checkAzureInstallation,
    });

  const unifiedResources: UnifiedInstallResource[] = useMemo(() => {
    const v1ResourceMap = new Map(
      (status?.resources ?? []).map(r => [r.resourceId, r]),
    );

    return confirmed.map(resource => {
      const v1 = v1ResourceMap.get(resource.resourceId);
      const isVm = resource.type === 'AZURE_VM';

      if (!v1) {
        return {
          id: resource.resourceId,
          name: resource.resourceId,
          resourceType: resource.type,
          isVm,
          step: 'PE_NOT_REQUESTED' as InstallStep,
          isCompleted: false,
        };
      }

      const step = toInstallStep(v1);
      return {
        id: resource.resourceId,
        name: resource.resourceId,
        resourceType: resource.type,
        isVm: v1.resourceType === 'AZURE_VM',
        step,
        peId: v1.privateEndpoint?.id,
        isCompleted: step === 'COMPLETED',
      };
    });
  }, [confirmed, status]);

  const completedCount = unifiedResources.filter(r => r.isCompleted).length;
  const totalCount = unifiedResources.length;
  const allCompleted = completedCount === totalCount && totalCount > 0;
  const lastCheckStatus = status?.lastCheck.status ?? 'SUCCESS';
  const lastCheckedLabel = getLastCheckedLabel(status?.lastCheck.checkedAt);
  const hasSyncFailure = lastCheckStatus === 'FAILED';

  // allCompleted 시 부모에 알림
  useEffect(() => {
    if (allCompleted) onInstallComplete?.();
  }, [allCompleted, onInstallComplete]);

  if (loading) return <InstallationLoadingView provider="Azure" />;
  if (error) return <InstallationErrorView message={error} onRetry={fetchStatus} />;

  const joinedRows = joinAzureResources(unifiedResources, confirmed);

  return (
    <div className="w-full space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className={cn('text-sm font-semibold', textColors.primary)}>Azure 에이전트 설치 상태</h3>
          {lastCheckedLabel && (
            <span className={cn('text-xs', textColors.tertiary)}>
              마지막 확인: {lastCheckedLabel}
            </span>
          )}
        </div>
        <button
          onClick={refresh}
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

      {hasSyncFailure && (
        <div className={cn('px-4 py-2 rounded-lg border text-sm', statusColors.error.bg, statusColors.error.border, statusColors.error.textDark)}>
          상태 확인 실패: {status?.lastCheck.failReason ?? '최근 설치 상태 확인에 실패했습니다. 새로고침으로 다시 확인해주세요.'}
        </div>
      )}

      <InstallTaskPipeline columns={3} items={buildAzurePipelineItems(unifiedResources)} />

      <InstallResourceTable rows={joinedRows} provider="Azure" />
    </div>
  );
};
