'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { Project, ProcessStatus, SecretKey } from '@/lib/types';
import { IdcInstallationStatus as IdcInstallationStatusType, IdcResourceInput } from '@/lib/types/idc';
import {
  updateResourceCredential,
  getProject,
} from '@/app/lib/api';
import {
  getIdcInstallationStatus as fetchIdcInstallationStatus,
  checkIdcInstallation,
  confirmIdcFirewall,
  updateIdcResourcesList,
  confirmIdcTargets,
} from '@/app/lib/api/idc';
import { ProjectInfoCard } from '@/app/components/features/ProjectInfoCard';
import { LoadingSpinner } from '@/app/components/ui/LoadingSpinner';
import { Modal } from '@/app/components/ui/Modal';
import { ProjectHeader, RejectionAlert } from '../common';
import { IdcResourceInputPanel, IdcPendingResourceList, IdcResourceTable } from '@/app/components/features/idc';
import { IdcProcessStatusCard } from './IdcProcessStatusCard';
import { cn, getButtonClass } from '@/lib/theme';

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
      fetchIdcInstallationStatus(project.targetSourceId)
        .then((data) => setIdcInstallationStatus(data))
        .catch(() => {});
    }
  }, [isInstalling, project.targetSourceId]);

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
      await updateResourceCredential(project.targetSourceId, resourceId, credentialId);
      const updatedProject = await getProject(project.targetSourceId);
      onProjectUpdate(updatedProject);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Credential 변경에 실패했습니다.');
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
      const data = await updateIdcResourcesList(
        project.targetSourceId,
        keepResourceIds,
        editPendingResources,
      );

      if (data.project) {
        onProjectUpdate(data.project as Project);
      } else {
        const updatedProject = await getProject(project.targetSourceId);
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
  }, [project.targetSourceId, project.resources, editDeletedIds, editPendingResources, onProjectUpdate]);

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
      await confirmIdcFirewall(project.targetSourceId);

      const statusData = await fetchIdcInstallationStatus(project.targetSourceId);
      setIdcInstallationStatus(statusData);

      const updatedProject = await getProject(project.targetSourceId);
      onProjectUpdate(updatedProject);
    } catch (err) {
      alert(err instanceof Error ? err.message : '방화벽 확인에 실패했습니다.');
    }
  }, [project.targetSourceId, onProjectUpdate]);

  // IDC: 설치 재시도 핸들러
  const handleIdcRetry = useCallback(async () => {
    try {
      await checkIdcInstallation(project.targetSourceId);

      const statusData = await fetchIdcInstallationStatus(project.targetSourceId);
      setIdcInstallationStatus(statusData);
    } catch (err) {
      alert(err instanceof Error ? err.message : '재시도에 실패했습니다.');
    }
  }, [project.targetSourceId]);

  // IDC: 연동 대상 확정 (모든 입력된 리소스를 API로 전송)
  const handleIdcConfirmTargets = useCallback(async () => {
    if (pendingResources.length === 0) {
      alert('확정할 리소스가 없습니다. 먼저 리소스를 추가해주세요.');
      return;
    }

    try {
      setSubmitting(true);
      const data = await confirmIdcTargets(project.targetSourceId, pendingResources);

      if (data.project) {
        onProjectUpdate(data.project as Project);
      } else {
        const updatedProject = await getProject(project.targetSourceId);
        onProjectUpdate(updatedProject);
      }

      // 상태 초기화
      setPendingResources([]);
      setIsEditMode(false);

      // 설치 상태 가져오기
      const statusData = await fetchIdcInstallationStatus(project.targetSourceId);
      setIdcInstallationStatus(statusData);
    } catch (err) {
      alert(err instanceof Error ? err.message : '연동 대상 확정에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  }, [project.targetSourceId, pendingResources, onProjectUpdate]);

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
            hasPendingResources={hasPendingResources}
            onShowResourceInput={() => setShowIdcResourceInput(true)}
            onConfirmFirewall={handleIdcConfirmFirewall}
            onRetry={handleIdcRetry}
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
                  className={cn(getButtonClass('primary'), 'text-sm flex items-center gap-2')}
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
              className={cn(getButtonClass('primary'), 'flex items-center gap-2')}
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
                className={cn(getButtonClass('primary'), 'flex items-center gap-2')}
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
