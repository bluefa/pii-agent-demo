'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Project, ProcessStatus, SecretKey, VmDatabaseConfig } from '@/lib/types';
import type { ApprovalRequestFormData } from '@/app/components/features/process-status/ApprovalRequestModal';
import type {
  ApprovalHistoryResponse,
  ApprovedIntegrationResponse,
  ConfirmedIntegrationResponse,
  ConfirmResourceItem,
} from '@/app/lib/api';
import {
  createApprovalRequest,
  getApprovalHistory,
  getApprovedIntegration,
  getConfirmResources,
  getConfirmedIntegration,
  getProject,
  updateResourceCredential,
} from '@/app/lib/api';
import {
  getAzureScanApp,
  getAzureSettings,
  resolveAzureProjectIdentifiers,
  type AzureScanApp,
} from '@/app/lib/api/azure';
import type { AzureV1Settings } from '@/lib/types/azure';
import { ScanPanel } from '@/app/components/features/scan';
import { ProjectInfoCard } from '@/app/components/features/ProjectInfoCard';
import { AzureInfoCard } from '@/app/components/features/AzureInfoCard';
import { ProcessStatusCard } from '@/app/components/features/ProcessStatusCard';
import { ResourceTable } from '@/app/components/features/ResourceTable';
import { LoadingSpinner } from '@/app/components/ui/LoadingSpinner';
import { ProjectHeader, RejectionAlert } from '@/app/projects/[projectId]/common';
import { isVmResource } from '@/app/components/features/resource-table';
import { ResourceTransitionPanel } from '@/app/components/features/process-status/ResourceTransitionPanel';
import { AppError } from '@/lib/errors';
import { buildAzureOwnedResources } from '@/lib/azure-resource-ownership';
import { getProjectCurrentStep } from '@/lib/process';
import { cn, getButtonClass, statusColors, textColors } from '@/lib/theme';
import { ProjectSidebar } from '@/app/components/layout/ProjectSidebar';

interface AzureProjectPageProps {
  project: Project;
  credentials: SecretKey[];
  onProjectUpdate: (project: Project) => void;
}

const EMPTY_CONFIRMED_INTEGRATION: ConfirmedIntegrationResponse = {
  resource_infos: [],
};

const EMPTY_APPROVAL_HISTORY_PAGE: ApprovalHistoryResponse = {
  content: [],
  page: {
    totalElements: 0,
    totalPages: 0,
    number: 0,
    size: 1,
  },
};

const isMissingSnapshotError = (error: unknown): boolean =>
  error instanceof AppError
  && (error.code === 'NOT_FOUND' || error.code === 'CONFIRMED_INTEGRATION_NOT_FOUND');

const getResourceErrorMessage = (error: unknown): string => {
  if (error instanceof AppError && error.isUserFacing) return error.message;
  if (error instanceof Error) return error.message;
  return 'Azure 리소스 정보를 불러오지 못했습니다.';
};

const getScanAppErrorMessage = (error: unknown): string => {
  if (error instanceof AppError && error.isUserFacing) return error.message;
  if (error instanceof Error) return error.message;
  return 'Azure scan app 정보를 불러오지 못했습니다.';
};

export const AzureProjectPage = ({
  project,
  credentials,
  onProjectUpdate,
}: AzureProjectPageProps) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [draftVmConfigs, setDraftVmConfigs] = useState<Record<string, VmDatabaseConfig>>({});
  const [submitting, setSubmitting] = useState(false);
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [expandedVmId, setExpandedVmId] = useState<string | null>(null);

  const [scanApp, setScanApp] = useState<AzureScanApp | null>(null);
  const [scanAppError, setScanAppError] = useState<string | null>(null);
  const [fallbackSettings, setFallbackSettings] = useState<AzureV1Settings | null>(null);

  const [catalogResources, setCatalogResources] = useState<ConfirmResourceItem[]>([]);
  const [latestApprovalRequest, setLatestApprovalRequest] = useState<ApprovalHistoryResponse['content'][number] | null>(null);
  const [approvedIntegration, setApprovedIntegration] = useState<ApprovedIntegrationResponse['approved_integration'] | null>(null);
  const [confirmedIntegration, setConfirmedIntegration] = useState<ConfirmedIntegrationResponse>(EMPTY_CONFIRMED_INTEGRATION);
  const [resourceLoading, setResourceLoading] = useState(true);
  const [resourceLoaded, setResourceLoaded] = useState(false);
  const [resourceError, setResourceError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const needsIdentifierFallback = !project.tenantId || !project.subscriptionId;

    setScanApp(null);
    setScanAppError(null);
    setFallbackSettings(null);

    void getAzureScanApp(project.targetSourceId)
      .then((response) => {
        if (cancelled) return;
        setScanApp(response);
      })
      .catch((error) => {
        if (cancelled) return;
        setScanAppError(getScanAppErrorMessage(error));
      });

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

  const handleOpenGuide = () => { /* TODO: 가이드 모달 연결 */ };
  const handleManageCredentials = () => { /* TODO: Credential 관리 페이지 이동 */ };

  const currentStep = getProjectCurrentStep(project);
  const isStep1 = currentStep === ProcessStatus.WAITING_TARGET_CONFIRMATION;
  const effectiveEditMode = isStep1 || isEditMode;
  const isProcessing = currentStep === ProcessStatus.WAITING_APPROVAL
    || currentStep === ProcessStatus.APPLYING_APPROVED
    || currentStep === ProcessStatus.INSTALLING;

  const loadAzureResources = useCallback(async () => {
    setResourceLoading(true);
    setResourceError(null);

    try {
      const [
        catalogResponse,
        approvalHistoryResponse,
        approvedIntegrationResponse,
        confirmedIntegrationResponse,
      ] = await Promise.all([
        getConfirmResources(project.targetSourceId),
        getApprovalHistory(project.targetSourceId, 0, 1).catch((error) => {
          if (isMissingSnapshotError(error)) return EMPTY_APPROVAL_HISTORY_PAGE;
          throw error;
        }),
        getApprovedIntegration(project.targetSourceId).catch((error) => {
          if (isMissingSnapshotError(error)) {
            return { approved_integration: null } satisfies ApprovedIntegrationResponse;
          }
          throw error;
        }),
        getConfirmedIntegration(project.targetSourceId).catch((error) => {
          if (isMissingSnapshotError(error)) return EMPTY_CONFIRMED_INTEGRATION;
          throw error;
        }),
      ]);

      setCatalogResources(catalogResponse.resources);
      setLatestApprovalRequest(approvalHistoryResponse.content[0] ?? null);
      setApprovedIntegration(approvedIntegrationResponse.approved_integration);
      setConfirmedIntegration(confirmedIntegrationResponse);
    } catch (error) {
      setResourceError(getResourceErrorMessage(error));
    } finally {
      setResourceLoading(false);
      setResourceLoaded(true);
    }
  }, [project.targetSourceId]);

  useEffect(() => {
    void loadAzureResources();
  }, [loadAzureResources, currentStep, project.updatedAt]);

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

  useEffect(() => {
    setSelectedIds(restoredSelectedIds);
    setDraftVmConfigs({});
    setExpandedVmId(null);
  }, [restoredSelectedIds, project.targetSourceId]);

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

  const handleVmConfigSave = (resourceId: string, config: VmDatabaseConfig) => {
    setDraftVmConfigs((previous) => ({ ...previous, [resourceId]: config }));
  };

  const handleCredentialChange = async (resourceId: string, credentialId: string | null) => {
    try {
      await updateResourceCredential(project.targetSourceId, resourceId, credentialId);
      const [updatedProject] = await Promise.all([
        getProject(project.targetSourceId),
        loadAzureResources(),
      ]);
      onProjectUpdate(updatedProject);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Credential 변경에 실패했습니다.');
    }
  };

  const handleConfirmTargets = () => {
    if (selectedIds.length === 0) return;

    const selectedVmResources = approvalResources.filter(
      (resource) => selectedIdSet.has(resource.id) && isVmResource(resource),
    );
    const unconfiguredVms = selectedVmResources.filter((resource) => !resource.vmDatabaseConfig);

    if (unconfiguredVms.length > 0) {
      alert(`다음 VM 리소스의 데이터베이스 설정이 필요합니다:\n${unconfiguredVms.map((resource) => resource.resourceId).join('\n')}`);
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

      const [updatedProject] = await Promise.all([
        getProject(project.targetSourceId),
        loadAzureResources(),
      ]);
      onProjectUpdate(updatedProject);
      setIsEditMode(false);
      setApprovalModalOpen(false);
    } catch (error) {
      setApprovalError(error instanceof Error ? error.message : '승인 요청에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartEdit = () => {
    setSelectedIds(restoredSelectedIds);
    setDraftVmConfigs({});
    setExpandedVmId(null);
    setIsEditMode(true);
  };

  const handleCancelEdit = () => {
    setSelectedIds(restoredSelectedIds);
    setDraftVmConfigs({});
    setExpandedVmId(null);
    setIsEditMode(false);
  };

  const handleRefreshAfterProjectChange = async () => {
    const [updatedProject] = await Promise.all([
      getProject(project.targetSourceId),
      loadAzureResources(),
    ]);
    onProjectUpdate(updatedProject);
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-50">
      <ProjectHeader project={project} />

      <div className="flex flex-1 overflow-hidden">
        <ProjectSidebar cloudProvider={project.cloudProvider}>
          <AzureInfoCard
            tenantId={azureIdentifiers.tenantId}
            subscriptionId={azureIdentifiers.subscriptionId}
            scanApp={scanApp}
            scanAppError={scanAppError}
            credentials={credentials}
            onOpenGuide={handleOpenGuide}
            onManageCredentials={handleManageCredentials}
          />
          <ProjectInfoCard project={project} />
        </ProjectSidebar>

        <main className="flex-1 min-w-0 overflow-y-auto p-6 space-y-6">
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
                onApprovalModalClose={() => setApprovalModalOpen(false)}
                onApprovalSubmit={handleApprovalSubmit}
                approvalLoading={submitting}
                approvalError={approvalError ?? resourceError}
                approvalResources={approvalResources}
              />

              {currentStep === ProcessStatus.APPLYING_APPROVED ? (
                <ResourceTransitionPanel
                  targetSourceId={project.targetSourceId}
                  resources={displayResources}
                  cloudProvider={project.cloudProvider}
                  processStatus={currentStep}
                />
              ) : (
                <>
                  <ScanPanel
                    targetSourceId={project.targetSourceId}
                    cloudProvider={project.cloudProvider}
                    onScanComplete={handleRefreshAfterProjectChange}
                  />

                  <ResourceTable
                    resources={displayResources}
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
                      disabled={submitting || resourceLoading || selectedIds.length === 0}
                      className={`${getButtonClass('primary')} flex items-center gap-2`}
                    >
                      {(submitting || resourceLoading) && <LoadingSpinner />}
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
            </>
          )}
        </main>
      </div>
    </div>
  );
};
