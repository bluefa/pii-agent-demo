'use client';

import { useMemo, useState } from 'react';
import { Project, ProcessStatus, SecretKey } from '@/lib/types';
import type { ApprovalRequestFormData } from '@/app/components/features/process-status/ApprovalRequestModal';
import { createApprovalRequest, getProject, updateResourceCredential } from '@/app/lib/api';
import { resolveAzureProjectIdentifiers } from '@/app/lib/api/azure';
import { DbSelectionCard } from '@/app/components/features/scan';
import { IntegrationTargetInfoCard } from '@/app/components/features/integration-target-info';
import { ProcessStatusCard } from '@/app/components/features/ProcessStatusCard';
import { GuideCard } from '@/app/components/features/process-status/GuideCard';
import { LoadingSpinner } from '@/app/components/ui/LoadingSpinner';
import { useToast } from '@/app/components/ui/toast';
import { DeleteInfrastructureButton, ProjectPageMeta, RejectionAlert, type ProjectIdentity } from '@/app/integration/target-sources/[targetSourceId]/_components/common';
import { isVmResource } from '@/app/components/features/resource-table';
import { ResourceTransitionPanel } from '@/app/components/features/process-status/ResourceTransitionPanel';
import { buildAzureOwnedResources } from '@/lib/azure-resource-ownership';
import { getProjectCurrentStep } from '@/lib/process';
import { cn, getButtonClass, statusColors, textColors } from '@/lib/theme';
import { useAzureProjectData } from './useAzureProjectData';
import { useVmConfigForm } from './useVmConfigForm';
import { buildApprovalResourceInputs } from './buildApprovalPayload';

interface AzureProjectPageProps {
  project: Project;
  credentials: SecretKey[];
  onProjectUpdate: (project: Project) => void;
}

type ApprovalFlow =
  | { kind: 'closed' }
  | { kind: 'open' }
  | { kind: 'submitting' };

export const AzureProjectPage = ({
  project,
  credentials,
  onProjectUpdate,
}: AzureProjectPageProps) => {
  const toast = useToast();
  const [approvalFlow, setApprovalFlow] = useState<ApprovalFlow>({ kind: 'closed' });
  const [approvalError, setApprovalError] = useState<string | null>(null);

  const submitting = approvalFlow.kind === 'submitting';
  const approvalModalOpen = approvalFlow.kind !== 'closed';

  const currentStep = getProjectCurrentStep(project);

  const {
    settings: fallbackSettings,
    catalogResources,
    latestApprovalRequest,
    approvedIntegration,
    confirmedIntegration,
    loading: resourceLoading,
    loaded: resourceLoaded,
    error: resourceError,
    refresh: loadAzureResources,
  } = useAzureProjectData({
    targetSourceId: project.targetSourceId,
    tenantId: project.tenantId,
    subscriptionId: project.subscriptionId,
    currentStep,
    updatedAt: project.updatedAt,
  });

  const azureIdentifiers = useMemo(
    () => resolveAzureProjectIdentifiers(
      {
        tenantId: project.tenantId,
        subscriptionId: project.subscriptionId,
      },
      fallbackSettings,
    ),
    [fallbackSettings, project.subscriptionId, project.tenantId],
  );

  const azureResources = useMemo(
    () =>
      buildAzureOwnedResources({
        currentStep,
        projectResources: project.resources,
        catalog: catalogResources,
        latestApprovalRequest,
        approvedIntegration,
        confirmedIntegration,
      }).resources,
    [approvedIntegration, catalogResources, confirmedIntegration, currentStep, latestApprovalRequest, project.resources],
  );

  const restoredSelectedIds = useMemo(
    () => azureResources.filter((resource) => resource.isSelected).map((resource) => resource.id),
    [azureResources],
  );

  const {
    selectedIds,
    draftVmConfigs,
    expandedVmId,
    setSelectedIds,
    setExpandedVmId,
    saveVmConfig,
  } = useVmConfigForm({
    restoredSelectedIds,
    targetSourceId: project.targetSourceId,
  });

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const displayResources = useMemo(
    () =>
      azureResources.map((resource) => ({
        ...resource,
        vmDatabaseConfig: draftVmConfigs[resource.id] ?? resource.vmDatabaseConfig,
      })),
    [azureResources, draftVmConfigs],
  );

  const approvalResources = useMemo(
    () =>
      displayResources.map((resource) => ({
        ...resource,
        isSelected: selectedIdSet.has(resource.id),
      })),
    [displayResources, selectedIdSet],
  );

  const handleCredentialChange = async (resourceId: string, credentialId: string | null) => {
    try {
      await updateResourceCredential(project.targetSourceId, resourceId, credentialId);
      const [updatedProject] = await Promise.all([
        getProject(project.targetSourceId),
        loadAzureResources(),
      ]);
      onProjectUpdate(updatedProject);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Credential 변경에 실패했습니다.');
    }
  };

  const handleConfirmTargets = () => {
    if (selectedIds.length === 0) return;

    const selectedVmResources = approvalResources.filter(
      (resource) => selectedIdSet.has(resource.id) && isVmResource(resource),
    );
    const unconfiguredVms = selectedVmResources.filter((resource) => !resource.vmDatabaseConfig);

    if (unconfiguredVms.length > 0) {
      toast.warning(`다음 VM 리소스의 데이터베이스 설정이 필요합니다: ${unconfiguredVms.map((resource) => resource.resourceId).join(', ')}`);
      return;
    }

    setApprovalFlow({ kind: 'open' });
  };

  const handleApprovalSubmit = async (formData: ApprovalRequestFormData) => {
    try {
      setApprovalFlow({ kind: 'submitting' });
      setApprovalError(null);

      const resourceInputs = buildApprovalResourceInputs({
        displayResources,
        selectedIdSet,
        draftVmConfigs,
        exclusionReasonDefault: formData.exclusion_reason_default,
      });

      await createApprovalRequest(project.targetSourceId, {
        resource_inputs: resourceInputs,
      });

      const [updatedProject] = await Promise.all([
        getProject(project.targetSourceId),
        loadAzureResources(),
      ]);
      onProjectUpdate(updatedProject);
      setApprovalFlow({ kind: 'closed' });
    } catch (error) {
      setApprovalError(error instanceof Error ? error.message : '승인 요청에 실패했습니다.');
      setApprovalFlow({ kind: 'open' });
    }
  };

  const handleRefreshAfterProjectChange = async () => {
    const [updatedProject] = await Promise.all([
      getProject(project.targetSourceId),
      loadAzureResources(),
    ]);
    onProjectUpdate(updatedProject);
  };

  const identity: ProjectIdentity = {
    cloudProvider: 'Azure',
    monitoringMethod: 'Azure Agent',
    jiraLink: null,
    identifiers: [
      { label: 'Subscription ID', value: azureIdentifiers.subscriptionId ?? null, mono: true },
      { label: 'Tenant ID', value: azureIdentifiers.tenantId ?? null, mono: true },
    ],
  };

  return (
    <main className="max-w-[1200px] mx-auto p-7 space-y-6">
      <ProjectPageMeta project={project} providerLabel="Azure Infrastructure" identity={identity} action={<DeleteInfrastructureButton />} />

      {!resourceLoaded ? (
        <div className="bg-white rounded-xl shadow-sm p-12 flex items-center justify-center gap-3">
          <LoadingSpinner />
          <span className={cn('text-sm', textColors.tertiary)}>Azure 리소스 정보를 불러오는 중입니다.</span>
        </div>
      ) : resourceError && catalogResources.length === 0 ? (
        <div className={cn('rounded-xl border p-6 space-y-3', statusColors.error.bg, statusColors.error.border)}>
          <p className={cn('text-sm font-medium', statusColors.error.textDark)}>
            {resourceError}
          </p>
          <button
            onClick={() => void loadAzureResources()}
            className={getButtonClass('secondary')}
          >
            다시 시도
          </button>
        </div>
      ) : (
        <>
          <ProcessStatusCard
            project={project}
            resources={displayResources}
            onProjectUpdate={onProjectUpdate}
            approvalModalOpen={approvalModalOpen}
            onApprovalModalClose={() => setApprovalFlow({ kind: 'closed' })}
            onApprovalSubmit={handleApprovalSubmit}
            approvalLoading={submitting}
            approvalError={approvalError ?? resourceError}
            approvalResources={approvalResources}
          />

          <GuideCard
            currentStep={currentStep}
            provider={project.cloudProvider}
          />

          {currentStep === ProcessStatus.APPLYING_APPROVED ? (
            <ResourceTransitionPanel
              targetSourceId={project.targetSourceId}
              resources={displayResources}
              cloudProvider={project.cloudProvider}
              processStatus={currentStep}
            />
          ) : currentStep >= ProcessStatus.INSTALLING ? (
            <IntegrationTargetInfoCard key={project.targetSourceId} targetSourceId={project.targetSourceId} />
          ) : (
            <DbSelectionCard
              targetSourceId={project.targetSourceId}
              cloudProvider={project.cloudProvider}
              onScanComplete={handleRefreshAfterProjectChange}
              resources={displayResources}
              processStatus={currentStep}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              credentials={credentials}
              onCredentialChange={handleCredentialChange}
              expandedVmId={expandedVmId}
              onVmConfigToggle={setExpandedVmId}
              onVmConfigSave={saveVmConfig}
              onRequestApproval={handleConfirmTargets}
              approvalSubmitting={submitting || resourceLoading}
            />
          )}

          <RejectionAlert project={project} />
        </>
      )}
    </main>
  );
};
