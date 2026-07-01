'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { InstallationLoadingView } from '@/app/components/features/process-status/shared/InstallationLoadingView';
import { InstallationErrorView } from '@/app/components/features/process-status/shared/InstallationErrorView';
import { InstallTaskPipeline } from '@/app/components/features/process-status/install-task-pipeline/InstallTaskPipeline';
import { InstallResourceTable } from '@/app/components/features/process-status/install-task-pipeline/InstallResourceTable';
import { InstallTaskDetailModal } from '@/app/components/features/process-status/install-task-pipeline/InstallTaskDetailModal';
import { joinAzureResources } from '@/app/components/features/process-status/install-task-pipeline/join-installation-resources';
import { getAzureInstallationStatus } from '@/app/lib/api/azure';
import { buildAzureInstallationStatus } from '@/app/components/features/process-status/azure/installation-status-adapter';
import { useInstallationStatus } from '@/app/hooks/useInstallationStatus';
import { useModal } from '@/app/hooks/useModal';
import { buildAzurePipelineItems } from '@/lib/constants/azure-install';
import type { GcpStepKey } from '@/lib/constants/gcp';
import { cardStyles, statusColors, cn } from '@/lib/theme';
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

export const AzureInstallationInline = ({
  targetSourceId,
  confirmed,
  onInstallComplete,
}: AzureInstallationInlineProps) => {
  const detailModal = useModal<GcpStepKey>();
  // Must be stable: useInstallationStatus re-runs its fetch effect whenever
  // getFn's identity changes. An inline (unmemoized) getFn made the mount-only
  // fetch effect re-run every render → unbounded refetch loop, most visibly a
  // tight loop of retries when the endpoint keeps returning 500 (nothing
  // unmounts the component to break the cycle). Matches GcpInstallationInline.
  const getStatus = useCallback(
    (id: number) => getAzureInstallationStatus(id).then(buildAzureInstallationStatus),
    [],
  );
  const { status, loading, error, fetchStatus } =
    useInstallationStatus<AzureV1InstallationStatus>({
      targetSourceId,
      getFn: getStatus,
      // Refresh = re-GET installation-status (POST check-installation REMOVED-no-swagger).
      checkFn: getStatus,
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
  const hasSyncFailure = lastCheckStatus === 'FAILED';

  // allCompleted 시 부모에 알림
  useEffect(() => {
    if (allCompleted) onInstallComplete?.();
  }, [allCompleted, onInstallComplete]);

  if (loading) return <InstallationLoadingView provider="Azure" />;
  if (error) return <InstallationErrorView message={error} onRetry={fetchStatus} />;

  const joinedRows = joinAzureResources(unifiedResources, confirmed);

  // v16 L6598 — only the COMPLETED (done) install phase is clickable; running
  // phases stay non-interactive. The done phase title ('서비스 측 리소스 설치 진행')
  // matches GCP_STEP_PIPELINE_LABELS['serviceSideTerraformApply'], so the shared
  // detail modal renders the correct heading.
  const pipelineItems = buildAzurePipelineItems(unifiedResources).map((item) =>
    item.status === 'done'
      ? { ...item, onClick: () => detailModal.open('serviceSideTerraformApply') }
      : item,
  );

  return (
    <section className={cn(cardStyles.base, 'overflow-hidden')}>
      <header className={cn(cardStyles.header, 'flex items-center justify-between')}>
        <div>
          <h2 className={cardStyles.cardTitle}>Agent 설치</h2>
          <p className={cn('mt-2.5', cardStyles.subtitle)}>
            승인된 인프라에 PII Agent를 배포하기 위한 설치 작업을 진행합니다.
          </p>
        </div>
        {/* v16 L6606 — provider indicator (not a control), short provider name. */}
        <span className={cardStyles.providerTag}>
          Provider: <strong className={cardStyles.providerTagName}>Azure</strong>
        </span>
      </header>
      <div className={cn(cardStyles.body, 'space-y-3')}>
        {hasSyncFailure && (
          <div className={cn('px-4 py-2 rounded-lg border text-sm', statusColors.error.bg, statusColors.error.border, statusColors.error.textDark)}>
            상태 확인 실패: {status?.lastCheck.failReason ?? '최근 설치 상태 확인에 실패했습니다. 새로고침으로 다시 확인해주세요.'}
          </div>
        )}

        <InstallTaskPipeline columns={3} items={pipelineItems} />

        <InstallResourceTable rows={joinedRows} provider="Azure" />
      </div>

      <InstallTaskDetailModal
        open={detailModal.isOpen}
        onClose={detailModal.close}
        stepKey={detailModal.data ?? null}
        rows={joinedRows}
      />
    </section>
  );
};
