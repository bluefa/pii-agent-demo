'use client';

import { useState, useEffect, useMemo } from 'react';
import { Project, ProcessStatus, SecretKey, needsCredential, VmDatabaseConfig } from '@/lib/types';
import type { ApprovalRequestFormData } from '@/app/components/features/process-status/ApprovalRequestModal';
import type { AzureV1Settings } from '@/lib/types/azure';
import {
  createApprovalRequest,
  updateResourceCredential,
  runConnectionTest,
  getProject,
  ResourceCredentialInput,
} from '@/app/lib/api';
import { getAzureSettings } from '@/app/lib/api/azure';
import { getProjectCurrentStep } from '@/lib/process';
import { ScanPanel } from '@/app/components/features/scan';
import { ProjectInfoCard } from '@/app/components/features/ProjectInfoCard';
import { AzureInfoCard } from '@/app/components/features/AzureInfoCard';
import { ProcessStatusCard } from '@/app/components/features/ProcessStatusCard';
import { ResourceTable } from '@/app/components/features/ResourceTable';
import { LoadingSpinner } from '@/app/components/ui/LoadingSpinner';
import { ProjectHeader, RejectionAlert } from '../common';
import { isVmResource } from '@/app/components/features/resource-table';
import { ResourceTransitionPanel } from '@/app/components/features/process-status/ResourceTransitionPanel';
import { getButtonClass } from '@/lib/theme';
import { ProjectSidebar } from '@/app/components/layout/ProjectSidebar';

interface AzureProjectPageProps {
  project: Project;
  credentials: SecretKey[];
  onProjectUpdate: (project: Project) => void;
}

export const AzureProjectPage = ({
  project,
  credentials,
  onProjectUpdate,
}: AzureProjectPageProps) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>(
    project.resources.filter((r) => r.isSelected).map((r) => r.id)
  );
  const [submitting, setSubmitting] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);

  // Prerequisite data
  const [serviceSettings, setServiceSettings] = useState<AzureV1Settings | null>(null);

  useEffect(() => {
    getAzureSettings(project.targetSourceId).then(setServiceSettings).catch(() => {});
  }, [project.targetSourceId]);

  const handleOpenGuide = () => { /* TODO: 가이드 모달 연결 */ };
  const handleManageCredentials = () => { /* TODO: Credential 관리 페이지 이동 */ };

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

  const handleCredentialChange = async (resourceId: string, credentialId: string | null) => {
    try {
      await updateResourceCredential(project.targetSourceId, resourceId, credentialId);
      const updatedProject = await getProject(project.targetSourceId);
      onProjectUpdate(updatedProject);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Credential 변경에 실패했습니다.');
    }
  };

  const handleTestConnection = async () => {
    const selectedResources = project.resources.filter((r) => r.isSelected);
    const missingCredentials = selectedResources.filter(
      (r) => needsCredential(r.databaseType) && !r.selectedCredentialId
    );

    if (missingCredentials.length > 0) {
      alert(`다음 리소스에 Credential을 선택해주세요:\n${missingCredentials.map((r) => r.resourceId).join('\n')}`);
      return;
    }

    try {
      setTestLoading(true);
      const resourceCredentials: ResourceCredentialInput[] = selectedResources.map((r) => ({
        resourceId: r.id,
        credentialId: r.selectedCredentialId,
      }));
      await runConnectionTest(project.targetSourceId, resourceCredentials);
      const updatedProject = await getProject(project.targetSourceId);
      onProjectUpdate(updatedProject);
    } catch (err) {
      alert(err instanceof Error ? err.message : '연결 테스트에 실패했습니다.');
    } finally {
      setTestLoading(false);
    }
  };

  // ADR-004: status 필드에서 현재 단계 계산
  const currentStep = getProjectCurrentStep(project);
  const isStep1 = currentStep === ProcessStatus.WAITING_TARGET_CONFIRMATION;
  const effectiveEditMode = isStep1 || isEditMode;
  const isProcessing = currentStep === ProcessStatus.WAITING_APPROVAL ||
    currentStep === ProcessStatus.APPLYING_APPROVED ||
    currentStep === ProcessStatus.INSTALLING;

  // 모달에 전달할 리소스: selectedIds 기준으로 isSelected 반영
  const approvalResources = useMemo(
    () => project.resources.map((r) => ({ ...r, isSelected: selectedIds.includes(r.id) })),
    [project.resources, selectedIds],
  );

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
      alert(`다음 VM 리소스의 데이터베이스 설정이 필요합니다:\n${unconfiguredVms.map((r) => r.resourceId).join('\n')}`);
      return;
    }

    setApprovalModalOpen(true);
  };

  const handleApprovalSubmit = async (formData: ApprovalRequestFormData) => {
    try {
      setSubmitting(true);
      setApprovalError(null);
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
      setIsEditMode(false);
      setExpandedVmId(null);
      setApprovalModalOpen(false);
    } catch (err) {
      setApprovalError(err instanceof Error ? err.message : '승인 요청에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartEdit = () => {
    setSelectedIds(project.resources.filter((r) => r.isSelected).map((r) => r.id));
    setIsEditMode(true);
  };

  const handleCancelEdit = () => {
    setSelectedIds(project.resources.filter((r) => r.isSelected).map((r) => r.id));
    setIsEditMode(false);
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-50">
      <ProjectHeader project={project} />

      <div className="flex flex-1 overflow-hidden">
        <ProjectSidebar cloudProvider={project.cloudProvider}>
          <AzureInfoCard
            project={project}
            serviceSettings={serviceSettings}
            credentials={credentials}
            onOpenGuide={handleOpenGuide}
            onManageCredentials={handleManageCredentials}
          />
          <ProjectInfoCard project={project} />
        </ProjectSidebar>

        <main className="flex-1 min-w-0 overflow-y-auto p-6 space-y-6">
          <ProcessStatusCard
            project={project}
            onProjectUpdate={onProjectUpdate}
            onTestConnection={handleTestConnection}
            testLoading={testLoading}
            credentials={credentials}
            onCredentialChange={handleCredentialChange}
            approvalModalOpen={approvalModalOpen}
            onApprovalModalClose={() => setApprovalModalOpen(false)}
            onApprovalSubmit={handleApprovalSubmit}
            approvalLoading={submitting}
            approvalError={approvalError}
            approvalResources={approvalResources}
          />

        {/* Cloud 리소스 */}
        {currentStep === ProcessStatus.APPLYING_APPROVED ? (
          <ResourceTransitionPanel
            targetSourceId={project.targetSourceId}
            resources={project.resources}
            cloudProvider={project.cloudProvider}
            processStatus={currentStep}
          />
        ) : (
          <>
            <ScanPanel
              targetSourceId={project.targetSourceId}
              cloudProvider={project.cloudProvider}
              onScanComplete={async () => {
                const updatedProject = await getProject(project.targetSourceId);
                onProjectUpdate(updatedProject);
              }}
            />

            <ResourceTable
              resources={project.resources.map((r) => ({
                ...r,
                vmDatabaseConfig: vmConfigs[r.id] || r.vmDatabaseConfig,
              }))}
              cloudProvider={project.cloudProvider}
              processStatus={currentStep}
              isEditMode={effectiveEditMode}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              credentials={credentials}
              onCredentialChange={handleCredentialChange}
              expandedVmId={expandedVmId}
              onVmConfigToggle={setExpandedVmId}
              onVmConfigSave={handleVmConfigSave}
            />
          </>
        )}

        <RejectionAlert project={project} onRetryRequest={handleStartEdit} />

        {/* Action Buttons */}
        <div className="flex justify-end gap-3">
          {effectiveEditMode ? (
            <>
              {!isStep1 && (
                <button
                  onClick={handleCancelEdit}
                  className={getButtonClass('secondary')}
                >
                  취소
                </button>
              )}
              <button
                onClick={handleConfirmTargets}
                disabled={submitting || selectedIds.length === 0}
                className={`${getButtonClass('primary')} flex items-center gap-2`}
              >
                {submitting && <LoadingSpinner />}
                연동 대상 확정 승인 요청
              </button>
            </>
          ) : !isProcessing && (
            <button
              onClick={handleStartEdit}
              className={getButtonClass('secondary')}
            >
              확정 대상 수정
            </button>
          )}
        </div>
        </main>
      </div>
    </div>
  );
};
