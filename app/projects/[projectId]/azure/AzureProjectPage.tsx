'use client';

import { useState, useEffect } from 'react';
import { Project, ProcessStatus, DBCredential, needsCredential } from '@/lib/types';
import { AzureVmStatus } from '@/lib/types/azure';
import {
  confirmTargets,
  updateResourceCredential,
  runConnectionTest,
  ResourceCredentialInput,
} from '@/app/lib/api';
import { ProjectInfoCard } from '@/app/components/features/ProjectInfoCard';
import { ProcessStatusCard } from '@/app/components/features/ProcessStatusCard';
import { ResourceTable } from '@/app/components/features/ResourceTable';
import { LoadingSpinner } from '@/app/components/ui/LoadingSpinner';
import { ProjectHeader, RejectionAlert } from '../common';
import { AzureDbPanel } from './AzureDbPanel';
import { AzureVmPanel } from './AzureVmPanel';

interface AzureProjectPageProps {
  project: Project;
  isAdmin: boolean;
  credentials: DBCredential[];
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
  const [vmStatus, setVmStatus] = useState<AzureVmStatus[]>([]);
  const [vmRefreshing, setVmRefreshing] = useState(false);

  // VM 리소스 여부 확인
  const hasVmResources = project.resources.some(r => r.type === 'AZURE_VM' && r.isSelected);
  const hasDbResources = project.resources.some(r => r.type !== 'AZURE_VM' && r.isSelected);

  // VM 상태 조회 (INSTALLING 단계에서만)
  useEffect(() => {
    if (project.processStatus === ProcessStatus.INSTALLING && hasVmResources) {
      fetchVmStatus();
    }
  }, [project.processStatus, hasVmResources]);

  const fetchVmStatus = async () => {
    try {
      setVmRefreshing(true);
      // VM 리소스에서 상태 생성 (실제로는 API 호출 필요)
      const vmResources = project.resources.filter(r => r.type === 'AZURE_VM' && r.isSelected);
      const vms: AzureVmStatus[] = vmResources.map(r => ({
        vmId: r.resourceId,
        vmName: r.resourceId,
        subnetExists: false, // API에서 가져와야 함
        terraformInstalled: false, // API에서 가져와야 함
      }));
      setVmStatus(vms);
    } catch (err) {
      console.error('VM 상태 조회 실패:', err);
    } finally {
      setVmRefreshing(false);
    }
  };

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

  const isStep1 = project.processStatus === ProcessStatus.WAITING_TARGET_CONFIRMATION;
  const isInstalling = project.processStatus === ProcessStatus.INSTALLING;
  const effectiveEditMode = isStep1 || isEditMode;

  const handleConfirmTargets = async () => {
    if (selectedIds.length === 0) return;

    try {
      setSubmitting(true);
      const updatedProject = await confirmTargets(project.id, selectedIds);
      onProjectUpdate(updatedProject);
      setIsEditMode(false);
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
        <div className="grid grid-cols-[350px_1fr] gap-6">
          <ProjectInfoCard project={project} />
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

        {/* Azure Installation Panels (INSTALLING 단계) */}
        {isInstalling && (
          <div className={`grid gap-6 ${hasDbResources && hasVmResources ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {hasDbResources && (
              <AzureDbPanel
                projectId={project.id}
                onInstallComplete={() => {
                  // 설치 완료 시 프로젝트 새로고침
                }}
              />
            )}
            {hasVmResources && (
              <AzureVmPanel
                projectId={project.id}
                vms={vmStatus}
                onRefresh={fetchVmStatus}
                refreshing={vmRefreshing}
              />
            )}
          </div>
        )}

        {/* Resource Table */}
        <ResourceTable
          resources={project.resources}
          cloudProvider={project.cloudProvider}
          processStatus={project.processStatus}
          isEditMode={effectiveEditMode}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          credentials={credentials}
          onCredentialChange={handleCredentialChange}
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
