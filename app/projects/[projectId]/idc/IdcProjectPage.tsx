'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { Project, ProcessStatus, DBCredential, needsCredential, Resource } from '@/lib/types';
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

// IdcResourceInput을 임시 Resource로 변환 (표시용)
const convertToTempResource = (input: IdcResourceInput, index: number): Resource => {
  const hostInfo = input.inputFormat === 'IP'
    ? (input.ips?.join(', ') || '')
    : (input.host || '');

  return {
    id: `temp-idc-${index}-${Date.now()}`,
    type: 'IDC',
    resourceId: `${input.name} (${hostInfo}:${input.port})`,
    connectionStatus: 'PENDING',
    isSelected: false,
    databaseType: input.databaseType,
    lifecycleStatus: 'DISCOVERED',
  };
};

export const IdcProjectPage = ({
  project,
  isAdmin,
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
  const [excludedTempIds, setExcludedTempIds] = useState<Set<string>>(new Set());

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

  // 표시할 리소스 목록 계산
  const displayResources = useMemo(() => {
    if (isStep1) {
      // 1단계: 임시 리소스를 Resource 형태로 변환하여 표시
      return pendingResources
        .map((r, i) => convertToTempResource(r, i))
        .filter((r) => !excludedTempIds.has(r.id));
    }
    // 다른 단계: 프로젝트 리소스 표시
    return project.resources;
  }, [isStep1, pendingResources, excludedTempIds, project.resources]);

  // 선택된 ID 관리 (1단계에서는 임시 리소스 ID 사용)
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    if (isStep1) {
      return displayResources.map((r) => r.id); // 기본적으로 모두 선택
    }
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
    setSelectedIds(project.resources.filter((r) => r.isSelected).map((r) => r.id));
    setIsEditMode(true);
  };

  const handleCancelEdit = () => {
    setSelectedIds(project.resources.filter((r) => r.isSelected).map((r) => r.id));
    setIsEditMode(false);
  };

  // 확정 수정 완료 핸들러
  const handleEditConfirm = useCallback(async () => {
    if (selectedIds.length === 0) {
      alert('최소 1개 이상의 리소스를 선택해주세요.');
      return;
    }

    try {
      setSubmitting(true);
      // 선택된 리소스 업데이트 API 호출
      const res = await fetch(`/api/projects/${project.id}/resources`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedIds }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || '리소스 업데이트에 실패했습니다.');
      }

      const updatedProject = await getProject(project.id);
      onProjectUpdate(updatedProject);
      setIsEditMode(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : '리소스 업데이트에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  }, [project.id, selectedIds, onProjectUpdate]);

  // IDC: 리소스 추가 (로컬 상태에만 - API 호출 안 함)
  const handleIdcResourceSave = useCallback((data: IdcResourceInput) => {
    setPendingResources((prev) => [...prev, data]);
    setShowIdcResourceInput(false);
    // 새로 추가된 리소스는 기본 선택
    const newResource = convertToTempResource(data, pendingResources.length);
    setSelectedIds((prev) => [...prev, newResource.id]);
  }, [pendingResources.length]);

  // IDC: 리소스 제외 (로컬 상태에만)
  const handleExcludeResource = useCallback((resourceId: string) => {
    setExcludedTempIds((prev) => new Set([...prev, resourceId]));
    setSelectedIds((prev) => prev.filter((id) => id !== resourceId));
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

  // IDC: 연동 대상 확정 (선택된 리소스만 API로 전송)
  const handleIdcConfirmTargets = useCallback(async () => {
    // 선택된 임시 리소스만 필터링
    const selectedResources = pendingResources.filter((_, index) => {
      const tempId = `temp-idc-${index}-${Date.now()}`;
      // displayResources에서 해당 인덱스의 리소스가 선택되었는지 확인
      const resource = displayResources.find((r) => r.id.startsWith(`temp-idc-${index}-`));
      return resource && selectedIds.includes(resource.id);
    });

    // 실제로는 선택된 인덱스 기반으로 필터링
    const resourcesToConfirm = pendingResources.filter((_, idx) => {
      const matchingDisplay = displayResources[idx];
      return matchingDisplay && selectedIds.includes(matchingDisplay.id);
    });

    if (resourcesToConfirm.length === 0) {
      alert('확정할 리소스를 선택해주세요.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch(`/api/idc/projects/${project.id}/confirm-targets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resources: resourcesToConfirm }),
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
      setExcludedTempIds(new Set());
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
  }, [project.id, pendingResources, displayResources, selectedIds, onProjectUpdate]);

  const hasPendingResources = pendingResources.length > 0 && isStep1;
  const hasSelectedResources = selectedIds.length > 0;

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
            idcActionLoading={submitting}
            testLoading={testLoading}
            hasPendingResources={hasPendingResources}
            pendingResources={displayResources}
            onShowResourceInput={() => setShowIdcResourceInput(true)}
            onConfirmFirewall={handleIdcConfirmFirewall}
            onRetry={handleIdcRetry}
            onTestConnection={handleTestConnection}
          />
        </div>

        {/* IDC Resource Input Panel - 1단계에서만 표시 */}
        {showIdcResourceInput && isStep1 && (
          <IdcResourceInputPanel
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
            {displayResources.length > 0 ? (
              <ResourceTable
                resources={displayResources}
                cloudProvider={project.cloudProvider}
                processStatus={project.processStatus}
                isEditMode={effectiveEditMode}
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
                credentials={credentials}
                onCredentialChange={handleCredentialChange}
              />
            ) : (
              <div className="px-6 py-12 text-center">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                  </svg>
                </div>
                <p className="text-gray-500">등록된 리소스가 없습니다</p>
                <p className="text-sm text-gray-400 mt-1">위의 "리소스 추가" 버튼을 클릭하여 데이터베이스를 등록하세요</p>
              </div>
            )}
          </div>
        )}

        {/* Resource Table - 1단계 이후에는 기존 방식 */}
        {!isStep1 && displayResources.length > 0 && (
          <ResourceTable
            resources={displayResources}
            cloudProvider={project.cloudProvider}
            processStatus={project.processStatus}
            isEditMode={effectiveEditMode}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            credentials={credentials}
            onCredentialChange={handleCredentialChange}
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
              disabled={submitting || !hasSelectedResources}
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
                disabled={submitting || !hasSelectedResources}
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
