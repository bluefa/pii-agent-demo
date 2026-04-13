'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { Project, ProcessStatus, SecretKey, VmDatabaseConfig, Resource, VmDatabaseType } from '@/lib/types';
import type { ApprovalRequestFormData } from '@/app/components/features/process-status/ApprovalRequestModal';
import {
  createApprovalRequest,
  updateResourceCredential,
  getProject,
  getConfirmResources,
} from '@/app/lib/api';
import { getProjectCurrentStep } from '@/lib/process';
import { ScanPanel } from '@/app/components/features/scan';
import { ProjectInfoCard } from '@/app/components/features/ProjectInfoCard';
import { GcpInfoCard } from '@/app/components/features/GcpInfoCard';
import { ProcessStatusCard } from '@/app/components/features/ProcessStatusCard';
import { ResourceTable } from '@/app/components/features/ResourceTable';
import { LoadingSpinner } from '@/app/components/ui/LoadingSpinner';
import { ProjectHeader, RejectionAlert } from '@/app/projects/[projectId]/common';
import { getButtonClass, cn, textColors, statusColors } from '@/lib/theme';
import { isVmResource } from '@/app/components/features/resource-table';
import { ResourceTransitionPanel } from '@/app/components/features/process-status/ResourceTransitionPanel';
import { ProjectSidebar } from '@/app/components/layout/ProjectSidebar';
import { AppError } from '@/lib/errors';

interface GcpProjectPageProps {
  project: Project;
  credentials: SecretKey[];
  onProjectUpdate: (project: Project) => void;
}

export const GcpProjectPage = ({
  project,
  credentials,
  onProjectUpdate,
}: GcpProjectPageProps) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>(
    project.resources.filter((r) => r.isSelected).map((r) => r.id)
  );
  const [submitting, setSubmitting] = useState(false);
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);

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

  // Resource loading state
  const [resources, setResources] = useState<Resource[]>(project.resources);
  const [resourceLoading, setResourceLoading] = useState(true);
  const [resourceError, setResourceError] = useState<string | null>(null);

  const loadGcpResources = useCallback(async () => {
    setResourceLoading(true);
    setResourceError(null);

    try {
      const response = await getConfirmResources(project.targetSourceId);
      // Convert ConfirmResourceItem[] to Resource[]
      const convertedResources: Resource[] = response.resources.map(resource => {
        // Only create VM config for actual VM database types
        let vmDatabaseConfig: VmDatabaseConfig | undefined;
        if (resource.resourceType === 'AZURE_VM') {
          const vmDatabaseTypes: VmDatabaseType[] = ['MYSQL', 'POSTGRESQL', 'MSSQL', 'MONGODB', 'ORACLE'];
          if (vmDatabaseTypes.includes(resource.databaseType as VmDatabaseType) && resource.port !== null) {
            vmDatabaseConfig = {
              databaseType: resource.databaseType as VmDatabaseType,
              port: resource.port ?? 0,
              host: resource.host ?? '',
              ...(resource.oracleServiceId ? { oracleServiceId: resource.oracleServiceId } : {}),
              ...(resource.networkInterfaceId ? { selectedNicId: resource.networkInterfaceId } : {}),
            };
          }
        }

        return {
          id: resource.id,
          type: resource.resourceType,
          resourceId: resource.resourceId,
          name: resource.name,
          databaseType: resource.databaseType,
          integrationCategory: resource.integrationCategory,
          isSelected: false, // Will be updated based on project state
          connectionStatus: 'PENDING',
          selectedCredentialId: undefined,
          vmDatabaseConfig,
        };
      });

      setResources(convertedResources);
    } catch (error) {
      const errorMessage = error instanceof AppError && error.isUserFacing 
        ? error.message 
        : error instanceof Error 
          ? error.message 
          : 'GCP 리소스 정보를 불러오지 못했습니다.';
      setResourceError(errorMessage);
    } finally {
      setResourceLoading(false);
    }
  }, [project.targetSourceId]);

  useEffect(() => {
    void loadGcpResources();
  }, [loadGcpResources]);

  const handleCredentialChange = async (resourceId: string, credentialId: string | null) => {
    try {
      await updateResourceCredential(project.targetSourceId, resourceId, credentialId);
      const updatedProject = await getProject(project.targetSourceId);
      onProjectUpdate(updatedProject);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Credential 변경에 실패했습니다.');
    }
  };

  const currentStep = getProjectCurrentStep(project);
  const isStep1 = currentStep === ProcessStatus.WAITING_TARGET_CONFIRMATION;
  const effectiveEditMode = isStep1 || isEditMode;
  const isProcessing = currentStep === ProcessStatus.WAITING_APPROVAL ||
    currentStep === ProcessStatus.APPLYING_APPROVED ||
    currentStep === ProcessStatus.INSTALLING;

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
      alert(`다음 VM 리소스의 데이터베이스 설정이 필요합니다:\n${unconfiguredVms.map((r) => r.resourceId).join('\n')}`);
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
    setSelectedIds(resources.filter((r) => r.isSelected).map((r) => r.id));
    setIsEditMode(true);
  };

  const handleOpenGuide = () => { /* TODO: 가이드 모달 연결 */ };
  const handleManageCredentials = () => { /* TODO: Credential 관리 페이지 이동 */ };

  const handleCancelEdit = () => {
    setSelectedIds(resources.filter((r) => r.isSelected).map((r) => r.id));
    setIsEditMode(false);
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-50">
      <ProjectHeader project={project} />

      <div className="flex flex-1 overflow-hidden">
        <ProjectSidebar cloudProvider={project.cloudProvider}>
          <GcpInfoCard
            project={project}
            credentials={credentials}
            onOpenGuide={handleOpenGuide}
            onManageCredentials={handleManageCredentials}
          />
          <ProjectInfoCard project={project} />
        </ProjectSidebar>

        <main className="flex-1 min-w-0 overflow-y-auto p-6 space-y-6">
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

        {/* Cloud 리소스 */}
        {currentStep === ProcessStatus.APPLYING_APPROVED ? (
          <ResourceTransitionPanel
            targetSourceId={project.targetSourceId}
            resources={resources}
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

            {resourceLoading ? (
              <div className="bg-white rounded-xl shadow-sm p-12 flex items-center justify-center gap-3">
                <LoadingSpinner />
                <span className={cn('text-sm', textColors.tertiary)}>GCP 리소스 정보를 불러오는 중입니다.</span>
              </div>
            ) : resourceError ? (
              <div className={cn('rounded-xl border p-6 space-y-3', statusColors.error.bg, statusColors.error.border)}>
                <p className={cn('text-sm font-medium', statusColors.error.textDark)}>
                  {resourceError}
                </p>
                <button
                  onClick={() => void loadGcpResources()}
                  className={getButtonClass('secondary')}
                >
                  다시 시도
                </button>
              </div>
            ) : (
              <ResourceTable
                resources={resources.map((r) => ({
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
            )}
          </>
        )}

        <RejectionAlert project={project} onRetryRequest={handleStartEdit} />

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
