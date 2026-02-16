'use client';

import { useState, useEffect } from 'react';
import { Project, ProcessStatus, SecretKey, needsCredential, VmDatabaseConfig } from '@/lib/types';
import type { AzureV1Settings } from '@/lib/types/azure';
import {
  createApprovalRequest,
  updateResourceCredential,
  runConnectionTest,
  getProject,
  ResourceCredentialInput,
  VmConfigInput,
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

interface AzureProjectPageProps {
  project: Project;
  isAdmin: boolean;
  credentials: SecretKey[];
  onProjectUpdate: (project: Project) => void;
}

export const AzureProjectPage = ({
  project,
  isAdmin,
  credentials,
  onProjectUpdate,
}: AzureProjectPageProps) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>(
    project.resources.filter((r) => r.isSelected).map((r) => r.id)
  );
  const [submitting, setSubmitting] = useState(false);
  const [testLoading, setTestLoading] = useState(false);

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
      const updatedProject = await updateResourceCredential(project.id, resourceId, credentialId);
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
      const response = await runConnectionTest(project.id, resourceCredentials);
      onProjectUpdate(response.project);
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

  const handleVmConfigSave = (resourceId: string, config: VmDatabaseConfig) => {
    setVmConfigs((prev) => ({ ...prev, [resourceId]: config }));
  };

  const handleConfirmTargets = async () => {
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

    // vmConfigs를 API 형식으로 변환
    const vmConfigInputs: VmConfigInput[] = Object.entries(vmConfigs)
      .filter(([resourceId]) => selectedIds.includes(resourceId))
      .map(([resourceId, config]) => ({ resourceId, config }));

    try {
      setSubmitting(true);
      const vmConfigPayload = vmConfigInputs?.map(vc => ({
        resource_id: vc.resourceId,
        db_type: vc.config.databaseType,
        port: vc.config.port,
        host: vc.config.host ?? '',
        ...(vc.config.oracleServiceId && { oracleServiceId: vc.config.oracleServiceId }),
        ...(vc.config.selectedNicId && { selectedNicId: vc.config.selectedNicId }),
      }));
      const excludedIds = project.resources
        .filter(r => !selectedIds.includes(r.id) && r.integrationCategory === 'TARGET' && r.lifecycleStatus !== 'ACTIVE')
        .map(r => r.id);
      await createApprovalRequest(project.targetSourceId, {
        target_resource_ids: selectedIds,
        excluded_resource_ids: excludedIds,
        vm_configs: vmConfigPayload,
      });
      const updatedProject = await getProject(project.id);
      onProjectUpdate(updatedProject);
      setIsEditMode(false);
      setExpandedVmId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : '승인 요청에 실패했습니다.');
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
    <div className="min-h-screen bg-gray-50">
      <ProjectHeader project={project} />

      <main className="p-6 space-y-6">
        {/* Info & Process Status Cards */}
        <div className="grid grid-cols-[350px_1fr] gap-6 items-start">
          <div className="space-y-6">
            <AzureInfoCard
              project={project}
              serviceSettings={serviceSettings}
              credentials={credentials}
              onOpenGuide={handleOpenGuide}
              onManageCredentials={handleManageCredentials}
            />
            <ProjectInfoCard project={project} />
          </div>
          <ProcessStatusCard
            project={project}
            isAdmin={isAdmin}
            onProjectUpdate={onProjectUpdate}
            onTestConnection={handleTestConnection}
            testLoading={testLoading}
            credentials={credentials}
            onCredentialChange={handleCredentialChange}
          />
        </div>

        {/* Scan Panel */}
        <ScanPanel
          targetSourceId={project.targetSourceId}
          cloudProvider={project.cloudProvider}
          onScanComplete={async () => {
            const updatedProject = await getProject(project.id);
            onProjectUpdate(updatedProject);
          }}
        />

        {/* Resource Table */}
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

        <RejectionAlert project={project} />

        {/* Action Buttons */}
        <div className="flex justify-end gap-3">
          {effectiveEditMode ? (
            <>
              {!isStep1 && (
                <button
                  onClick={handleCancelEdit}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  취소
                </button>
              )}
              <button
                onClick={handleConfirmTargets}
                disabled={submitting || selectedIds.length === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {submitting && <LoadingSpinner />}
                연동 대상 확정 승인 요청
              </button>
            </>
          ) : (
            <button
              onClick={handleStartEdit}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              확정 대상 수정
            </button>
          )}
        </div>
      </main>
    </div>
  );
};
