'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { Project, ProcessStatus, SecretKey, needsCredential } from '@/lib/types';
import { IdcInstallationStatus as IdcInstallationStatusType, IdcResourceInput } from '@/lib/types/idc';
import {
  updateResourceCredential,
  runConnectionTest,
  getProject,
  ResourceCredentialInput,
} from '@/app/lib/api';
import { ProjectInfoCard } from '@/app/components/features/ProjectInfoCard';
import { LoadingSpinner } from '@/app/components/ui/LoadingSpinner';
import { Modal } from '@/app/components/ui/Modal';
import { ProjectHeader, RejectionAlert } from '../common';
import { IdcResourceInputPanel, IdcPendingResourceList, IdcResourceTable } from '@/app/components/features/idc';
import { IdcProcessStatusCard } from './IdcProcessStatusCard';

interface IdcProjectPageProps {
  project: Project;
  credentials: SecretKey[];
  onProjectUpdate: (project: Project) => void;
}

export const IdcProjectPage = ({
  project,
  credentials,
  onProjectUpdate,
}: IdcProjectPageProps) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [testLoading, setTestLoading] = useState(false);

  // IDC-specific states
  const [showIdcResourceInput, setShowIdcResourceInput] = useState(false);
  const [idcInstallationStatus, setIdcInstallationStatus] = useState<IdcInstallationStatusType | null>(null);

  // 임시 리소스 관리 (1단계에서만 사용)
  const [pendingResources, setPendingResources] = useState<IdcResourceInput[]>([]);

  // 편집 모드용 상태 (Step 1 이후)
  const [editPendingResources, setEditPendingResources] = useState<IdcResourceInput[]>([]);
  const [editDeletedIds, setEditDeletedIds] = useState<Set<string>>(new Set());

  // 1단계이면 기본적으로 편집 모드
  const isStep1 = project.processStatus === ProcessStatus.WAITING_TARGET_CONFIRMATION;
  const isInstalling = project.processStatus === ProcessStatus.INSTALLING;
  const effectiveEditMode = isStep1 || isEditMode;

  // 설치 단계일 때 설치 상태 가져오기
  useEffect(() => {
    if (isInstalling) {
      fetch(`/api/idc/projects/${project.id}/installation-status`)
        .then((res) => res.ok ? res.json() : null)
        .then((data) => {
          if (data) setIdcInstallationStatus(data);
        })
        .catch(() => {});
    }
  }, [isInstalling, project.id]);

  // 확정 후 표시할 리소스 목록 계산 (Step 1 이후에만 사용)
  const displayResources = useMemo(() => {
    // 기존 리소스 중 삭제되지 않은 것만 필터링
    return project.resources.filter((r) => !editDeletedIds.has(r.id));
  }, [project.resources, editDeletedIds]);

  // 선택된 ID 관리 (Step 1 이후에만 사용)
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    return project.resources.filter((r) => r.isSelected).map((r) => r.id);
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

  const handleStartEdit = () => {
    setEditPendingResources([]);
    setEditDeletedIds(new Set());
    setIsEditMode(true);
  };

  const handleCancelEdit = () => {
    setEditPendingResources([]);
    setEditDeletedIds(new Set());
    setIsEditMode(false);
  };

  // 편집 모드: 리소스 추가
  const handleEditAddResource = useCallback((data: IdcResourceInput) => {
    setEditPendingResources((prev) => [...prev, data]);
    setShowIdcResourceInput(false);
  }, []);

  // 편집 모드: 기존 리소스 삭제 표시
  const handleEditRemoveResource = useCallback((resourceId: string) => {
    setEditDeletedIds((prev) => new Set([...prev, resourceId]));
  }, []);

  // 편집 모드: 임시 리소스 삭제 (index 기반)
  const handleEditRemovePendingInput = useCallback((index: number) => {
    setEditPendingResources((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // 확정 수정 완료 핸들러
  const handleEditConfirm = useCallback(async () => {
    // 유지할 리소스 ID (기존 리소스 중 삭제되지 않은 것)
    const keepResourceIds = project.resources
      .filter((r) => !editDeletedIds.has(r.id))
      .map((r) => r.id);

    // 최소 1개 리소스 확인
    if (keepResourceIds.length === 0 && editPendingResources.length === 0) {
      alert('최소 1개 이상의 리소스가 필요합니다.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch(`/api/idc/projects/${project.id}/update-resources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keepResourceIds,
          newResources: editPendingResources,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || '리소스 업데이트에 실패했습니다.');
      }

      const data = await res.json();
      if (data.project) {
        onProjectUpdate(data.project);
      } else {
        const updatedProject = await getProject(project.id);
        onProjectUpdate(updatedProject);
      }

      // 편집 상태 초기화
      setEditPendingResources([]);
      setEditDeletedIds(new Set());
      setIsEditMode(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : '리소스 업데이트에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  }, [project.id, project.resources, editDeletedIds, editPendingResources, onProjectUpdate]);

  // IDC: 리소스 추가 (로컬 상태에만 - API 호출 안 함)
  const handleIdcResourceSave = useCallback((data: IdcResourceInput) => {
    setPendingResources((prev) => [...prev, data]);
    setShowIdcResourceInput(false);
  }, []);

  // IDC: 리소스 제거 (로컬 상태에만 - index 기반)
  const handleRemovePendingResource = useCallback((index: number) => {
    setPendingResources((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // IDC: 방화벽 확인 완료 핸들러
  const handleIdcConfirmFirewall = useCallback(async () => {
    try {
      const res = await fetch(`/api/idc/projects/${project.id}/confirm-firewall`, {
        method: 'POST',
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || '방화벽 확인에 실패했습니다.');
      }

      const statusRes = await fetch(`/api/idc/projects/${project.id}/installation-status`);
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setIdcInstallationStatus(statusData);
      }

      const updatedProject = await getProject(project.id);
      onProjectUpdate(updatedProject);
    } catch (err) {
      alert(err instanceof Error ? err.message : '방화벽 확인에 실패했습니다.');
    }
  }, [project.id, onProjectUpdate]);

  // IDC: 설치 재시도 핸들러
  const handleIdcRetry = useCallback(async () => {
    try {
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
    }
  }, [project.id]);

  // IDC: 연동 대상 확정 (모든 입력된 리소스를 API로 전송)
  const handleIdcConfirmTargets = useCallback(async () => {
    if (pendingResources.length === 0) {
      alert('확정할 리소스가 없습니다. 먼저 리소스를 추가해주세요.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch(`/api/idc/projects/${project.id}/confirm-targets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resources: pendingResources }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || '연동 대상 확정에 실패했습니다.');
      }

      const data = await res.json();
      if (data.project) {
        onProjectUpdate(data.project);
      } else {
        const updatedProject = await getProject(project.id);
        onProjectUpdate(updatedProject);
      }

      // 상태 초기화
      setPendingResources([]);
      setIsEditMode(false);

      // 설치 상태 가져오기
      const statusRes = await fetch(`/api/idc/projects/${project.id}/installation-status`);
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setIdcInstallationStatus(statusData);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : '연동 대상 확정에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  }, [project.id, pendingResources, onProjectUpdate]);

  const hasPendingResources = pendingResources.length > 0 && isStep1;

  return (
    <div className="min-h-screen bg-gray-50">
      <ProjectHeader project={project} />

      <main className="p-6 space-y-6">
        {/* Info & Process Status Cards - Side by Side */}
        <div className="grid grid-cols-[350px_1fr] gap-6 items-start">
          <ProjectInfoCard project={project} />

          <IdcProcessStatusCard
            project={project}
            idcInstallationStatus={idcInstallationStatus}
            showResourceInput={showIdcResourceInput}
            idcActionLoading={submitting}
            testLoading={testLoading}
            hasPendingResources={hasPendingResources}
            onShowResourceInput={() => setShowIdcResourceInput(true)}
            onConfirmFirewall={handleIdcConfirmFirewall}
            onRetry={handleIdcRetry}
            onTestConnection={handleTestConnection}
          />
        </div>

        {/* IDC Resource Input Panel - 1단계에서만 표시 */}
        {showIdcResourceInput && isStep1 && (
          <IdcResourceInputPanel
            credentials={credentials}
            onSave={handleIdcResourceSave}
            onCancel={() => setShowIdcResourceInput(false)}
          />
        )}

        {/* Resource Section - 1단계에서는 추가 버튼 표시 */}
        {isStep1 && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">리소스 목록</h3>
              {!showIdcResourceInput && (
                <button
                  onClick={() => setShowIdcResourceInput(true)}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  리소스 추가
                </button>
              )}
            </div>
            {pendingResources.length > 0 ? (
              <IdcPendingResourceList
                resources={pendingResources}
                onRemove={handleRemovePendingResource}
              />
            ) : (
              <div className="px-6 py-12 text-center">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                  </svg>
                </div>
                <p className="text-gray-500">등록된 리소스가 없습니다</p>
                <p className="text-sm text-gray-400 mt-1">위의 &quot;리소스 추가&quot; 버튼을 클릭하여 데이터베이스를 등록하세요</p>
              </div>
            )}
          </div>
        )}

        {/* IDC Resource Input Modal - 편집 모드에서 사용 */}
        <Modal
          isOpen={showIdcResourceInput && !isStep1 && isEditMode}
          onClose={() => setShowIdcResourceInput(false)}
          title="리소스 추가"
          subtitle="데이터베이스 연결 정보를 입력하세요"
          size="lg"
        >
          <IdcResourceInputPanel
            credentials={credentials}
            onSave={handleEditAddResource}
            onCancel={() => setShowIdcResourceInput(false)}
            variant="modal"
          />
        </Modal>

        {/* Resource Table - 1단계 이후 */}
        {!isStep1 && (displayResources.length > 0 || editPendingResources.length > 0) && (
          <IdcResourceTable
            resources={displayResources}
            processStatus={project.processStatus}
            credentials={credentials}
            onCredentialChange={handleCredentialChange}
            isEditMode={isEditMode}
            onRemove={handleEditRemoveResource}
            onAdd={() => setShowIdcResourceInput(true)}
            pendingInputs={editPendingResources}
            onRemovePendingInput={handleEditRemovePendingInput}
          />
        )}

        {/* Rejection Alert */}
        <RejectionAlert project={project} />

        {/* Action Buttons */}
        <div className="flex justify-end gap-3">
          {/* 1단계: 연동 대상 확정 */}
          {isStep1 && hasPendingResources && (
            <button
              onClick={handleIdcConfirmTargets}
              disabled={submitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {submitting && <LoadingSpinner />}
              연동 대상 확정
            </button>
          )}
          {/* 다른 단계: 편집 모드 */}
          {!isStep1 && isEditMode && (
            <>
              <button
                onClick={handleCancelEdit}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleEditConfirm}
                disabled={submitting || selectedIds.length === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {submitting && <LoadingSpinner />}
                확정 수정 완료
              </button>
            </>
          )}
          {/* 확정 대상 수정 버튼 */}
          {!isStep1 && !isEditMode && project.processStatus !== ProcessStatus.INSTALLATION_COMPLETE && (
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
