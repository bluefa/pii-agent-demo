'use client';

import { useState, useEffect, useRef } from 'react';
import { Project, ProcessStatus, SecretKey, needsCredential, VmDatabaseConfig } from '@/lib/types';
import type { AwsInstallationStatus, AwsSettings } from '@/lib/types';
import {
  createApprovalRequest,
  updateResourceCredential,
  runConnectionTest,
  getProject,
  ResourceCredentialInput,
  VmConfigInput,
} from '@/app/lib/api';
import { getAwsInstallationStatus, getAwsSettings } from '@/app/lib/api/aws';
import { getProjectCurrentStep } from '@/lib/process';
import { getProcessGuide } from '@/lib/constants/process-guides';
import { useModal } from '@/app/hooks/useModal';
import { ScanPanel } from '@/app/components/features/scan';
import { ProjectInfoCard } from '@/app/components/features/ProjectInfoCard';
import { AwsInfoCard } from '@/app/components/features/AwsInfoCard';
import { ProcessStatusCard } from '@/app/components/features/ProcessStatusCard';
import { ProcessGuideModal } from '@/app/components/features/process-status/ProcessGuideModal';
import { ResourceTable } from '@/app/components/features/ResourceTable';
import { LoadingSpinner } from '@/app/components/ui/LoadingSpinner';
import { AwsInstallationModeSelector } from '@/app/components/features/process-status/aws/AwsInstallationModeSelector';
import { ProjectHeader, RejectionAlert } from '../common';
import { isVmResource } from '@/app/components/features/resource-table';
import { cn, cardStyles, textColors, getButtonClass } from '@/lib/theme';

interface AwsProjectPageProps {
  project: Project;
  isAdmin: boolean;
  credentials: SecretKey[];
  onProjectUpdate: (project: Project) => void;
}

export const AwsProjectPage = ({
  project,
  isAdmin,
  credentials,
  onProjectUpdate,
}: AwsProjectPageProps) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>(
    project.resources.filter((r) => r.isSelected).map((r) => r.id)
  );
  const [submitting, setSubmitting] = useState(false);
  const [testLoading, setTestLoading] = useState(false);

  // Prerequisite data
  const [awsStatus, setAwsStatus] = useState<AwsInstallationStatus | null>(null);
  const [awsSettings, setAwsSettings] = useState<AwsSettings | null>(null);
  const guideModal = useModal();
  const resourceSectionRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    getAwsInstallationStatus(project.targetSourceId).then(setAwsStatus).catch(() => {});
    getAwsSettings(project.targetSourceId).then(setAwsSettings).catch(() => {});
  }, [project.targetSourceId]);

  const guideVariant = project.awsInstallationMode === 'AUTO' ? 'auto' : 'manual';
  const guide = getProcessGuide('AWS', guideVariant);

  const handleOpenGuide = () => {
    guideModal.open();
  };

  const handleManageCredentials = () => {
    resourceSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleModeSelected = (updatedProject: Project) => {
    onProjectUpdate(updatedProject);
  };

  // 설치 모드 미선택 시 선택 UI 표시
  if (!project.awsInstallationMode) {
    return (
      <div className="min-h-screen bg-gray-50">
        <ProjectHeader project={project} />
        <main className="p-6">
          <AwsInstallationModeSelector
            targetSourceId={project.targetSourceId}
            onModeSelected={handleModeSelected}
          />
        </main>
      </div>
    );
  }

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
        <div className="grid grid-cols-[350px_1fr] gap-6 items-start">
          <div className="space-y-6">
            <AwsInfoCard
              project={project}
              awsStatus={awsStatus}
              awsSettings={awsSettings}
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

        {/* Cloud 리소스 통합 컨테이너 */}
        <div ref={resourceSectionRef} className={cn(cardStyles.base, 'overflow-hidden')}>
          <div className="px-6 pt-6">
            <h2 className={cn('text-lg font-semibold', textColors.primary)}>Cloud 리소스</h2>
          </div>

          <ScanPanel
            targetSourceId={project.targetSourceId}
            cloudProvider={project.cloudProvider}
            onScanComplete={async () => {
              const updatedProject = await getProject(project.id);
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
            onEditModeChange={setIsEditMode}
          />
        </div>

        <RejectionAlert project={project} />

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
                className={cn(getButtonClass('primary'), 'flex items-center gap-2')}
              >
                {submitting && <LoadingSpinner />}
                연동 대상 확정 승인 요청
              </button>
            </>
          ) : (
            <button
              onClick={handleStartEdit}
              className={getButtonClass('secondary')}
            >
              확정 대상 수정
            </button>
          )}
        </div>
      </main>

      {guide && (
        <ProcessGuideModal
          isOpen={guideModal.isOpen}
          onClose={guideModal.close}
          guide={guide}
          currentStepNumber={currentStep}
        />
      )}
    </div>
  );
};
