'use client';

import { useState, useCallback } from 'react';
import { Project, ProcessStatus, DBCredential, needsCredential } from '@/lib/types';
import { IdcInstallationStatus as IdcInstallationStatusType, IdcResourceInput } from '@/lib/types/idc';
import {
  updateResourceCredential,
  runConnectionTest,
  getProject,
  ResourceCredentialInput,
} from '@/app/lib/api';
import { ProjectInfoCard } from '@/app/components/features/ProjectInfoCard';
import { ResourceTable } from '@/app/components/features/ResourceTable';
import { LoadingSpinner } from '@/app/components/ui/LoadingSpinner';
import { ProjectHeader, RejectionAlert } from '../common';
import { IdcResourceInputPanel } from '@/app/components/features/idc';
import { IdcProcessStatusCard } from './IdcProcessStatusCard';

interface IdcProjectPageProps {
  project: Project;
  isAdmin: boolean;
  credentials: DBCredential[];
  onProjectUpdate: (project: Project) => void;
}

export const IdcProjectPage = ({
  project,
  isAdmin,
  credentials,
  onProjectUpdate,
}: IdcProjectPageProps) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>(
    project.resources.filter((r) => r.isSelected).map((r) => r.id)
  );
  const [submitting, setSubmitting] = useState(false);
  const [testLoading, setTestLoading] = useState(false);

  // IDC-specific states
  const [showIdcResourceInput, setShowIdcResourceInput] = useState(false);
  const [idcInstallationStatus, setIdcInstallationStatus] = useState<IdcInstallationStatusType | null>(null);
  const [idcActionLoading, setIdcActionLoading] = useState(false);

  // 1단계이면 기본적으로 편집 모드
  const isStep1 = project.processStatus === ProcessStatus.WAITING_TARGET_CONFIRMATION;
  const effectiveEditMode = isStep1 || isEditMode;

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

  const handleStartEdit = () => {
    setSelectedIds(project.resources.filter((r) => r.isSelected).map((r) => r.id));
    setIsEditMode(true);
  };

  const handleCancelEdit = () => {
    setSelectedIds(project.resources.filter((r) => r.isSelected).map((r) => r.id));
    setIsEditMode(false);
  };

  // IDC: 리소스 저장 핸들러
  const handleIdcResourceSave = useCallback(async (data: IdcResourceInput) => {
    try {
      setIdcActionLoading(true);
      const res = await fetch(`/api/idc/projects/${project.id}/resources`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resources: [data] }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || '리소스 저장에 실패했습니다.');
      }

      const updatedProject = await getProject(project.id);
      onProjectUpdate(updatedProject);
      setShowIdcResourceInput(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : '리소스 저장에 실패했습니다.');
    } finally {
      setIdcActionLoading(false);
    }
  }, [project.id, onProjectUpdate]);

  // IDC: 방화벽 확인 완료 핸들러
  const handleIdcConfirmFirewall = useCallback(async () => {
    try {
      setIdcActionLoading(true);
      const res = await fetch(`/api/idc/projects/${project.id}/confirm-firewall`, {
        method: 'POST',
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || '방화벽 확인에 실패했습니다.');
      }

      // 설치 상태 새로고침
      const statusRes = await fetch(`/api/idc/projects/${project.id}/installation-status`);
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setIdcInstallationStatus(statusData);
      }

      const updatedProject = await getProject(project.id);
      onProjectUpdate(updatedProject);
    } catch (err) {
      alert(err instanceof Error ? err.message : '방화벽 확인에 실패했습니다.');
    } finally {
      setIdcActionLoading(false);
    }
  }, [project.id, onProjectUpdate]);

  // IDC: 설치 재시도 핸들러
  const handleIdcRetry = useCallback(async () => {
    try {
      setIdcActionLoading(true);
      const res = await fetch(`/api/idc/projects/${project.id}/check-installation`, {
        method: 'POST',
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || '재시도에 실패했습니다.');
      }

      const statusRes = await fetch(`/api/idc/projects/${project.id}/installation-status`);
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setIdcInstallationStatus(statusData);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : '재시도에 실패했습니다.');
    } finally {
      setIdcActionLoading(false);
    }
  }, [project.id]);

  // IDC: 연동 대상 확정 (승인 없이 바로 설치 시작)
  const handleIdcConfirmTargets = useCallback(async () => {
    if (selectedIds.length === 0) return;

    try {
      setSubmitting(true);
      const res = await fetch(`/api/idc/projects/${project.id}/confirm-targets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resourceIds: selectedIds }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || '연동 대상 확정에 실패했습니다.');
      }

      const updatedProject = await getProject(project.id);
      onProjectUpdate(updatedProject);
      setIsEditMode(false);

      // 설치 상태 가져오기
      if (updatedProject.processStatus === ProcessStatus.INSTALLING) {
        const statusRes = await fetch(`/api/idc/projects/${project.id}/installation-status`);
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          setIdcInstallationStatus(statusData);
        }
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : '연동 대상 확정에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  }, [project.id, selectedIds, onProjectUpdate]);

  return (
    <div className="min-h-screen bg-gray-50">
      <ProjectHeader project={project} />

      <main className="p-6 space-y-6">
        {/* Info & Process Status Cards - Side by Side */}
        <div className="grid grid-cols-[350px_1fr] gap-6">
          <ProjectInfoCard project={project} />

          <IdcProcessStatusCard
            project={project}
            idcInstallationStatus={idcInstallationStatus}
            showResourceInput={showIdcResourceInput}
            idcActionLoading={idcActionLoading}
            testLoading={testLoading}
            onShowResourceInput={() => setShowIdcResourceInput(true)}
            onConfirmFirewall={handleIdcConfirmFirewall}
            onRetry={handleIdcRetry}
            onTestConnection={handleTestConnection}
          />
        </div>

        {/* IDC Resource Input Panel - 1단계에서만 표시 */}
        {showIdcResourceInput && project.processStatus === ProcessStatus.WAITING_TARGET_CONFIRMATION && (
          <IdcResourceInputPanel
            onSave={handleIdcResourceSave}
            onCancel={() => setShowIdcResourceInput(false)}
          />
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

        {/* Rejection Alert */}
        <RejectionAlert project={project} />

        {/* Action Buttons */}
        <div className="flex justify-end gap-3">
          {effectiveEditMode && (
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
                onClick={handleIdcConfirmTargets}
                disabled={submitting || selectedIds.length === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {submitting && <LoadingSpinner />}
                연동 대상 확정
              </button>
            </>
          )}
          {!effectiveEditMode && project.processStatus !== ProcessStatus.INSTALLATION_COMPLETE && (
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
