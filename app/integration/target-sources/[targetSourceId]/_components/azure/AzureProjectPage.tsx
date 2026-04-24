'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Project, ProcessStatus, Resource, SecretKey, VmDatabaseConfig } from '@/lib/types';
import type { ApprovalRequestFormData } from '@/app/components/features/process-status/ApprovalRequestModal';
import {
  createApprovalRequest,
  getConfirmResources,
  getConfirmedIntegration,
  getProject,
  updateResourceCredential,
} from '@/app/lib/api';
import {
  getAzureSettings,
  resolveAzureProjectIdentifiers,
} from '@/app/lib/api/azure';
import type { AzureV1Settings } from '@/lib/types/azure';
import { DbSelectionCard } from '@/app/components/features/scan';
import { IntegrationTargetInfoCard } from '@/app/components/features/integration-target-info';
import { ProcessStatusCard } from '@/app/components/features/ProcessStatusCard';
import { GuideCard } from '@/app/components/features/process-status/GuideCard';
import { LoadingSpinner } from '@/app/components/ui/LoadingSpinner';
import { useToast } from '@/app/components/ui/toast';
import { DeleteInfrastructureButton, ProjectPageMeta, RejectionAlert, type ProjectIdentity } from '@/app/integration/target-sources/[targetSourceId]/_components/common';
import { isVmResource } from '@/app/components/features/resource-table';
import { ResourceTransitionPanel } from '@/app/components/features/process-status/ResourceTransitionPanel';
import { AppError, isMissingConfirmedIntegrationError } from '@/lib/errors';
import {
  EMPTY_CONFIRMED_INTEGRATION,
  catalogToResources,
  confirmedIntegrationToResources,
} from '@/lib/resource-catalog';
import { getProjectCurrentStep } from '@/lib/process';
import { cn, getButtonClass, statusColors, textColors } from '@/lib/theme';

interface AzureProjectPageProps {
  project: Project;
  credentials: SecretKey[];
  onProjectUpdate: (project: Project) => void;
}

const getResourceErrorMessage = (error: unknown): string => {
  if (error instanceof AppError && error.isUserFacing) return error.message;
  if (error instanceof Error) return error.message;
  return 'Azure 리소스 정보를 불러오지 못했습니다.';
};

export const AzureProjectPage = ({
  project,
  credentials,
  onProjectUpdate,
}: AzureProjectPageProps) => {
  const toast = useToast();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [draftVmConfigs, setDraftVmConfigs] = useState<Record<string, VmDatabaseConfig>>({});
  const [submitting, setSubmitting] = useState(false);
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [expandedVmId, setExpandedVmId] = useState<string | null>(null);

  const [fallbackSettings, setFallbackSettings] = useState<AzureV1Settings | null>(null);

  const [resources, setResources] = useState<Resource[]>([]);
  const [resourceLoading, setResourceLoading] = useState(true);
  const [resourceLoaded, setResourceLoaded] = useState(false);
  const [resourceError, setResourceError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const needsIdentifierFallback = !project.tenantId || !project.subscriptionId;

    setFallbackSettings(null);

    if (needsIdentifierFallback) {
      void getAzureSettings(project.targetSourceId)
        .then((response) => {
          if (cancelled) return;
          setFallbackSettings(response);
        })
        .catch(() => {
          if (cancelled) return;
          setFallbackSettings(null);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [project.subscriptionId, project.targetSourceId, project.tenantId]);

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

  const currentStep = getProjectCurrentStep(project);

  useEffect(() => {
    let cancelled = false;
    setResourceLoading(true);
    setResourceError(null);
    (async () => {
      try {
        if (currentStep === ProcessStatus.WAITING_TARGET_CONFIRMATION) {
          const response = await getConfirmResources(project.targetSourceId);
          if (cancelled) return;
          setResources(catalogToResources(response.resources));
        } else if (currentStep >= ProcessStatus.INSTALLING) {
          const response = await getConfirmedIntegration(project.targetSourceId).catch((error) => {
            if (isMissingConfirmedIntegrationError(error)) return EMPTY_CONFIRMED_INTEGRATION;
            throw error;
          });
          if (cancelled) return;
          const confirmedResources = confirmedIntegrationToResources(response);
          setResources(confirmedResources);
          setSelectedIds(confirmedResources.map((r) => r.id));
        }
      } catch (error) {
        if (cancelled) return;
        setResourceError(getResourceErrorMessage(error));
      } finally {
        if (!cancelled) {
          setResourceLoading(false);
          setResourceLoaded(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentStep, project.targetSourceId, retryNonce]);

  const reloadResources = useCallback(() => setRetryNonce((n) => n + 1), []);

  const displayResources = useMemo(
    () =>
      resources.map((resource) => ({
        ...resource,
        vmDatabaseConfig: draftVmConfigs[resource.id] ?? resource.vmDatabaseConfig,
      })),
    [resources, draftVmConfigs],
  );

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const approvalResources = useMemo(
    () =>
      displayResources.map((resource) => ({
        ...resource,
        isSelected: selectedIdSet.has(resource.id),
      })),
    [displayResources, selectedIdSet],
  );

  const handleVmConfigSave = (resourceId: string, config: VmDatabaseConfig) => {
    setDraftVmConfigs((previous) => ({ ...previous, [resourceId]: config }));
  };

  const handleCredentialChange = async (resourceId: string, credentialId: string | null) => {
    try {
      await updateResourceCredential(project.targetSourceId, resourceId, credentialId);
      const updatedProject = await getProject(project.targetSourceId);
      reloadResources();
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

    setApprovalModalOpen(true);
  };

  const handleApprovalSubmit = async (formData: ApprovalRequestFormData) => {
    try {
      setSubmitting(true);
      setApprovalError(null);

      const resourceInputs = displayResources.map((resource) => {
        if (selectedIdSet.has(resource.id)) {
          const vmConfig = draftVmConfigs[resource.id] ?? resource.vmDatabaseConfig;

          if (vmConfig) {
            return {
              resource_id: resource.id,
              selected: true as const,
              resource_input: {
                resource_id: resource.id,
                resource_type: resource.type,
                database_type: vmConfig.databaseType,
                port: vmConfig.port,
                host: vmConfig.host ?? '',
                ...(vmConfig.oracleServiceId ? { oracle_service_id: vmConfig.oracleServiceId } : {}),
                ...(vmConfig.selectedNicId ? { network_interface_id: vmConfig.selectedNicId } : {}),
              },
            };
          }

          return {
            resource_id: resource.id,
            selected: true as const,
            resource_input: {
              resource_id: resource.id,
              resource_type: resource.type,
              credential_id: resource.selectedCredentialId ?? '',
            },
          };
        }

        return {
          resource_id: resource.id,
          selected: false as const,
          ...(formData.exclusion_reason_default ? { exclusion_reason: formData.exclusion_reason_default } : {}),
        };
      });

      await createApprovalRequest(project.targetSourceId, {
        resource_inputs: resourceInputs,
      });

      const updatedProject = await getProject(project.targetSourceId);
      reloadResources();
      onProjectUpdate(updatedProject);
      setApprovalModalOpen(false);
    } catch (error) {
      setApprovalError(error instanceof Error ? error.message : '승인 요청에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRefreshAfterProjectChange = async () => {
    const updatedProject = await getProject(project.targetSourceId);
    reloadResources();
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
      ) : resourceError && resources.length === 0 ? (
        <div className={cn('rounded-xl border p-6 space-y-3', statusColors.error.bg, statusColors.error.border)}>
          <p className={cn('text-sm font-medium', statusColors.error.textDark)}>
            {resourceError}
          </p>
          <button
            onClick={reloadResources}
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
            onApprovalModalClose={() => setApprovalModalOpen(false)}
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
              onVmConfigSave={handleVmConfigSave}
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
