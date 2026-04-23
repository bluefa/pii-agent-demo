'use client';

import { useState, useMemo } from 'react';
import { Project, ProcessStatus, SecretKey, VmDatabaseConfig } from '@/lib/types';
import type { ApprovalRequestFormData } from '@/app/components/features/process-status/ApprovalRequestModal';
import {
  createApprovalRequest,
  updateResourceCredential,
  getProject,
} from '@/app/lib/api';
import { getProjectCurrentStep } from '@/lib/process';
import { DbSelectionCard } from '@/app/components/features/scan';
import { ProcessStatusCard } from '@/app/components/features/ProcessStatusCard';
import { GuideCard } from '@/app/components/features/process-status/GuideCard';
import { useToast } from '@/app/components/ui/toast';
import { AwsInstallationModeSelector } from '@/app/components/features/process-status/aws/AwsInstallationModeSelector';
import { DeleteInfrastructureButton, ProjectPageMeta, RejectionAlert, type ProjectIdentity } from '@/app/projects/[targetSourceId]/common';
import { isVmResource } from '@/app/components/features/resource-table';
import { ResourceTransitionPanel } from '@/app/components/features/process-status/ResourceTransitionPanel';

interface AwsProjectPageProps {
  project: Project;
  credentials: SecretKey[];
  onProjectUpdate: (project: Project) => void;
}

export const AwsProjectPage = ({
  project,
  credentials,
  onProjectUpdate,
}: AwsProjectPageProps) => {
  const toast = useToast();
  const [selectedIds, setSelectedIds] = useState<string[]>(
    project.resources.filter((r) => r.isSelected).map((r) => r.id)
  );
  const [submitting, setSubmitting] = useState(false);
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);

  // VM 설정 상태
  const [expandedVmId, setExpandedVmId] = useState<string | null>(null);
  const [vmConfigs, setVmConfigs] = useState<Record<string, VmDatabaseConfig>>(() => {
    const initial: Record<string, VmDatabaseConfig> = {};
    project.resources.forEach((r) => {
      if (r.vmDatabaseConfig) {
        initial[r.id] = r.vmDatabaseConfig;
      }
    });
    return initial;
  });

  const handleModeSelected = (updatedProject: Project) => {
    onProjectUpdate(updatedProject);
  };

  // 모달에 전달할 리소스: selectedIds 기준으로 isSelected 반영
  const approvalResources = useMemo(
    () => project.resources.map((r) => ({ ...r, isSelected: selectedIds.includes(r.id) })),
    [project.resources, selectedIds],
  );

  const identity: ProjectIdentity = {
    cloudProvider: 'AWS',
    monitoringMethod: 'AWS Agent',
    jiraLink: null,
    identifiers: [
      { label: 'AWS Account ID', value: project.awsAccountId ?? null, mono: true },
      ...(project.awsRegionType
        ? [{ label: 'Region Type', value: project.awsRegionType === 'china' ? 'China' : 'Global' }]
        : []),
    ],
  };

  // 설치 모드 미선택 시 선택 UI 표시
  if (!project.awsInstallationMode) {
    return (
      <main className="max-w-[1200px] mx-auto p-7 space-y-6">
        <ProjectPageMeta project={project} providerLabel="AWS Infrastructure" identity={identity} action={<DeleteInfrastructureButton />} />
        <AwsInstallationModeSelector
          targetSourceId={project.targetSourceId}
          onModeSelected={handleModeSelected}
        />
      </main>
    );
  }

  const handleCredentialChange = async (resourceId: string, credentialId: string | null) => {
    try {
      await updateResourceCredential(project.targetSourceId, resourceId, credentialId);
      const updatedProject = await getProject(project.targetSourceId);
      onProjectUpdate(updatedProject);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Credential 변경에 실패했습니다.');
    }
  };

  const currentStep = getProjectCurrentStep(project);

  const handleVmConfigSave = (resourceId: string, config: VmDatabaseConfig) => {
    setVmConfigs((prev) => ({ ...prev, [resourceId]: config }));
  };

  const handleConfirmTargets = () => {
    if (selectedIds.length === 0) return;

    // VM 리소스 중 설정되지 않은 것 체크
    const selectedVmResources = project.resources.filter(
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
      // Build resource_inputs per confirm.yaml SelectedResourceInput/ExcludedResourceInput
      const resourceInputs = project.resources.map(r => {
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
      onProjectUpdate(updatedProject);
      setExpandedVmId(null);
      setApprovalModalOpen(false);
    } catch (err) {
      setApprovalError(err instanceof Error ? err.message : '승인 요청에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="max-w-[1200px] mx-auto p-7 space-y-6">
      <ProjectPageMeta project={project} providerLabel="AWS Infrastructure" identity={identity} action={<DeleteInfrastructureButton />} />

      <ProcessStatusCard
        project={project}
        resources={project.resources}
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
        installationMode={project.awsInstallationMode}
      />

      {currentStep === ProcessStatus.APPLYING_APPROVED ? (
        <ResourceTransitionPanel
          targetSourceId={project.targetSourceId}
          resources={project.resources}
          cloudProvider={project.cloudProvider}
          processStatus={currentStep}
        />
      ) : (
        <DbSelectionCard
          targetSourceId={project.targetSourceId}
          cloudProvider={project.cloudProvider}
          onScanComplete={async () => {
            const updatedProject = await getProject(project.targetSourceId);
            onProjectUpdate(updatedProject);
          }}
          resources={project.resources.map((r) => ({
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
      )}

      <RejectionAlert project={project} />
    </main>
  );
};
