'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { CloudTargetSource, ProcessStatus, SecretKey, VmDatabaseConfig, Resource } from '@/lib/types';
import type { ApprovalRequestFormData } from '@/app/components/features/process-status/ApprovalRequestModal';
import {
  createApprovalRequest,
  updateResourceCredential,
  getProject,
  getConfirmResources,
  getConfirmedIntegration,
} from '@/app/lib/api';
import { DbSelectionCard } from '@/app/components/features/scan';
import { IntegrationTargetInfoCard } from '@/app/components/features/integration-target-info';
import { ProcessStatusCard } from '@/app/components/features/ProcessStatusCard';
import { GuideCard } from '@/app/components/features/process-status/GuideCard';
import { LoadingSpinner } from '@/app/components/ui/LoadingSpinner';
import { useToast } from '@/app/components/ui/toast';
import { DeleteInfrastructureButton, ProjectPageMeta, RejectionAlert, type ProjectIdentity } from '@/app/integration/target-sources/[targetSourceId]/_components/common';
import { getButtonClass, cn, textColors, statusColors } from '@/lib/theme';
import { isVmResource } from '@/app/components/features/resource-table';
import { ResourceTransitionPanel } from '@/app/components/features/process-status/ResourceTransitionPanel';
import { AppError, isMissingConfirmedIntegrationError } from '@/lib/errors';
import {
  EMPTY_CONFIRMED_INTEGRATION,
  catalogToResources,
  confirmedIntegrationToResources,
} from '@/lib/resource-catalog';

interface GcpProjectPageProps {
  project: CloudTargetSource;
  credentials: SecretKey[];
  onProjectUpdate: (project: CloudTargetSource) => void;
}

export const GcpProjectPage = ({
  project,
  credentials,
  onProjectUpdate,
}: GcpProjectPageProps) => {
  const toast = useToast();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);

  const [expandedVmId, setExpandedVmId] = useState<string | null>(null);
  const [vmConfigs, setVmConfigs] = useState<Record<string, VmDatabaseConfig>>({});

  const [resources, setResources] = useState<Resource[]>([]);
  const [resourceLoading, setResourceLoading] = useState(true);
  const [resourceError, setResourceError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  const currentStep = project.processStatus;

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
        const message = error instanceof AppError && error.isUserFacing
          ? error.message
          : error instanceof Error
            ? error.message
            : 'GCP 리소스 정보를 불러오지 못했습니다.';
        setResourceError(message);
      } finally {
        if (!cancelled) setResourceLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentStep, project.targetSourceId, retryNonce]);

  const reloadResources = useCallback(() => setRetryNonce((n) => n + 1), []);

  const handleCredentialChange = async (resourceId: string, credentialId: string | null) => {
    try {
      await updateResourceCredential(project.targetSourceId, resourceId, credentialId);
      const updatedProject = await getProject(project.targetSourceId);
      onProjectUpdate(updatedProject as CloudTargetSource);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Credential 변경에 실패했습니다.');
    }
  };

  // 모달에 전달할 리소스: selectedIds 기준으로 isSelected 반영
  const approvalResources = useMemo(
    () => resources.map((r) => ({ ...r, isSelected: selectedIds.includes(r.id) })),
    [resources, selectedIds],
  );

  const handleVmConfigSave = (resourceId: string, config: VmDatabaseConfig) => {
    setVmConfigs((prev) => ({ ...prev, [resourceId]: config }));
  };

  const handleConfirmTargets = () => {
    if (selectedIds.length === 0) return;

    const selectedVmResources = resources.filter(
      (r) => selectedIds.includes(r.id) && isVmResource(r)
    );
    const unconfiguredVms = selectedVmResources.filter((r) => !vmConfigs[r.id] && !r.vmDatabaseConfig);

    if (unconfiguredVms.length > 0) {
      toast.warning(`다음 VM 리소스의 데이터베이스 설정이 필요합니다: ${unconfiguredVms.map((r) => r.resourceId).join(', ')}`);
      return;
    }

    setApprovalModalOpen(true);
  };

  const handleApprovalSubmit = async (formData: ApprovalRequestFormData) => {
    try {
      setSubmitting(true);
      setApprovalError(null);
      const resourceInputs = resources.map(r => {
        if (selectedIds.includes(r.id)) {
          const vmConfig = vmConfigs[r.id] ?? r.vmDatabaseConfig;
          let resourceInput: Record<string, unknown>;
          if (vmConfig) {
            resourceInput = {
              endpoint_config: {
                db_type: vmConfig.databaseType,
                port: vmConfig.port,
                host: vmConfig.host ?? '',
                ...(vmConfig.oracleServiceId && { oracleServiceId: vmConfig.oracleServiceId }),
                ...(vmConfig.selectedNicId && { selectedNicId: vmConfig.selectedNicId }),
              },
            };
          } else {
            resourceInput = { credential_id: r.selectedCredentialId ?? '' };
          }
          return {
            resource_id: r.id,
            selected: true as const,
            resource_input: resourceInput,
          };
        }
        return {
          resource_id: r.id,
          selected: false as const,
          ...(formData.exclusion_reason_default && { exclusion_reason: formData.exclusion_reason_default }),
        };
      });

      await createApprovalRequest(project.targetSourceId, {
        input_data: { resource_inputs: resourceInputs },
      });
      const updatedProject = await getProject(project.targetSourceId);
      onProjectUpdate(updatedProject as CloudTargetSource);
      setExpandedVmId(null);
      setApprovalModalOpen(false);
    } catch (err) {
      setApprovalError(err instanceof Error ? err.message : '승인 요청에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const identity: ProjectIdentity = {
    cloudProvider: 'GCP',
    monitoringMethod: 'GCP Agent',
    jiraLink: null,
    identifiers: [
      { label: 'GCP Project ID', value: project.gcpProjectId ?? null, mono: true },
    ],
  };

  const renderStepCard = () => {
    if (currentStep === ProcessStatus.APPLYING_APPROVED) {
      return (
        <ResourceTransitionPanel
          targetSourceId={project.targetSourceId}
          cloudProvider={project.cloudProvider}
          processStatus={currentStep}
        />
      );
    }
    if (currentStep >= ProcessStatus.INSTALLING) {
      return <IntegrationTargetInfoCard key={project.targetSourceId} targetSourceId={project.targetSourceId} />;
    }
    if (resourceLoading) {
      return (
        <div className="bg-white rounded-xl shadow-sm p-12 flex items-center justify-center gap-3">
          <LoadingSpinner />
          <span className={cn('text-sm', textColors.tertiary)}>GCP 리소스 정보를 불러오는 중입니다.</span>
        </div>
      );
    }
    if (resourceError) {
      return (
        <div className={cn('rounded-xl border p-6 space-y-3', statusColors.error.bg, statusColors.error.border)}>
          <p className={cn('text-sm font-medium', statusColors.error.textDark)}>
            {resourceError}
          </p>
          <button onClick={reloadResources} className={getButtonClass('secondary')}>
            다시 시도
          </button>
        </div>
      );
    }
    return (
      <DbSelectionCard
        targetSourceId={project.targetSourceId}
        cloudProvider={project.cloudProvider}
        onScanComplete={async () => {
          const updatedProject = await getProject(project.targetSourceId);
          reloadResources();
          onProjectUpdate(updatedProject as CloudTargetSource);
        }}
        resources={resources.map((r) => ({
          ...r,
          vmDatabaseConfig: vmConfigs[r.id] || r.vmDatabaseConfig,
        }))}
        processStatus={currentStep}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        credentials={credentials}
        onCredentialChange={handleCredentialChange}
        expandedVmId={expandedVmId}
        onVmConfigToggle={setExpandedVmId}
        onVmConfigSave={handleVmConfigSave}
        onRequestApproval={handleConfirmTargets}
        approvalSubmitting={submitting}
      />
    );
  };

  return (
    <main className="max-w-[1200px] mx-auto p-7 space-y-6">
      <ProjectPageMeta project={project} providerLabel="GCP Infrastructure" identity={identity} action={<DeleteInfrastructureButton />} />

      <ProcessStatusCard
        project={project}
        resources={resources}
        onProjectUpdate={onProjectUpdate}
        approvalModalOpen={approvalModalOpen}
        onApprovalModalClose={() => setApprovalModalOpen(false)}
        onApprovalSubmit={handleApprovalSubmit}
        approvalLoading={submitting}
        approvalError={approvalError}
        approvalResources={approvalResources}
      />

      <GuideCard
        currentStep={currentStep}
        provider={project.cloudProvider}
      />

      {renderStepCard()}

      <RejectionAlert project={project} />
    </main>
  );
};
