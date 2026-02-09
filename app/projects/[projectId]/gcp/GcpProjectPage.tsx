'use client';

import { useState } from 'react';
import { Project, ProcessStatus, DBCredential, needsCredential, VmDatabaseConfig } from '@/lib/types';
import {
  confirmTargets,
  updateResourceCredential,
  runConnectionTest,
  getProject,
  ResourceCredentialInput,
  VmConfigInput,
} from '@/app/lib/api';
import { getProjectCurrentStep } from '@/lib/process';
import { ScanPanel } from '@/app/components/features/scan';
import { ProjectInfoCard } from '@/app/components/features/ProjectInfoCard';
import { GcpInfoCard } from '@/app/components/features/GcpInfoCard';
import { ProcessStatusCard } from '@/app/components/features/ProcessStatusCard';
import { ResourceTable } from '@/app/components/features/ResourceTable';
import { LoadingSpinner } from '@/app/components/ui/LoadingSpinner';
import { ProjectHeader, RejectionAlert } from '../common';
import { getButtonClass } from '@/lib/theme';
import { isVmResource } from '@/app/components/features/resource-table';

interface GcpProjectPageProps {
  project: Project;
  isAdmin: boolean;
  credentials: DBCredential[];
  onProjectUpdate: (project: Project) => void;
}

export const GcpProjectPage = ({
  project,
  isAdmin,
  credentials,
  onProjectUpdate,
}: GcpProjectPageProps) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>(
    project.resources.filter((r) => r.isSelected).map((r) => r.id)
  );
  const [submitting, setSubmitting] = useState(false);
  const [testLoading, setTestLoading] = useState(false);

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

  const currentStep = getProjectCurrentStep(project);
  const isStep1 = currentStep === ProcessStatus.WAITING_TARGET_CONFIRMATION;
  const effectiveEditMode = isStep1 || isEditMode;

  const handleVmConfigSave = (resourceId: string, config: VmDatabaseConfig) => {
    setVmConfigs((prev) => ({ ...prev, [resourceId]: config }));
  };

  const handleConfirmTargets = async () => {
    if (selectedIds.length === 0) return;

    const selectedVmResources = project.resources.filter(
      (r) => selectedIds.includes(r.id) && isVmResource(r)
    );
    const unconfiguredVms = selectedVmResources.filter((r) => !vmConfigs[r.id] && !r.vmDatabaseConfig);

    if (unconfiguredVms.length > 0) {
      alert(`다음 VM 리소스의 데이터베이스 설정이 필요합니다:\n${unconfiguredVms.map((r) => r.resourceId).join('\n')}`);
      return;
    }

    const vmConfigInputs: VmConfigInput[] = Object.entries(vmConfigs)
      .filter(([resourceId]) => selectedIds.includes(resourceId))
      .map(([resourceId, config]) => ({ resourceId, config }));

    try {
      setSubmitting(true);
      const updatedProject = await confirmTargets(
        project.id,
        selectedIds,
        vmConfigInputs.length > 0 ? vmConfigInputs : undefined
      );
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

  const handleOpenGuide = () => { /* TODO: 가이드 모달 연결 */ };
  const handleManageCredentials = () => { /* TODO: Credential 관리 페이지 이동 */ };

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
            <ProjectInfoCard project={project} />
            <GcpInfoCard
              project={project}
              credentials={credentials}
              onOpenGuide={handleOpenGuide}
              onManageCredentials={handleManageCredentials}
            />
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

        <ScanPanel
          projectId={project.id}
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
        />

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
                className={`${getButtonClass('primary')} flex items-center gap-2`}
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
    </div>
  );
};
