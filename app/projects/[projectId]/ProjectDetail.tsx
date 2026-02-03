'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Project, ProcessStatus, DBCredential, needsCredential } from '@/lib/types';
import { IdcInstallationStatus as IdcInstallationStatusType, IdcResourceInput } from '@/lib/types/idc';
import {
  getProject,
  confirmTargets,
  getCurrentUser,
  CurrentUser,
  getCredentials,
  updateResourceCredential,
  runConnectionTest,
  ResourceCredentialInput,
} from '@/app/lib/api';
import { ProjectInfoCard } from '@/app/components/features/ProjectInfoCard';
import { ProcessStatusCard } from '@/app/components/features/ProcessStatusCard';
import { IdcResourceInputPanel, IdcInstallationStatus } from '@/app/components/features/idc';
import { ResourceTable } from '@/app/components/features/ResourceTable';
import { LoadingSpinner } from '@/app/components/ui/LoadingSpinner';

interface ProjectDetailProps {
  projectId: string;
}

// IDC Step Progress Bar - 승인 단계 없음 (4단계)
const idcSteps = [
  { step: ProcessStatus.WAITING_TARGET_CONFIRMATION, label: '리소스 등록' },
  { step: ProcessStatus.INSTALLING, label: '환경 구성' },
  { step: ProcessStatus.WAITING_CONNECTION_TEST, label: '연결 테스트' },
  { step: ProcessStatus.INSTALLATION_COMPLETE, label: '완료' },
];

const IdcStepProgressBar = ({ currentStep }: { currentStep: ProcessStatus }) => {
  // IDC는 승인 단계(2)를 건너뜀
  const getIdcStepIndex = (step: ProcessStatus): number => {
    if (step === ProcessStatus.WAITING_TARGET_CONFIRMATION) return 0;
    if (step === ProcessStatus.INSTALLING) return 1;
    if (step === ProcessStatus.WAITING_CONNECTION_TEST || step === ProcessStatus.CONNECTION_VERIFIED) return 2;
    if (step === ProcessStatus.INSTALLATION_COMPLETE) return 3;
    return 0;
  };

  const currentIndex = getIdcStepIndex(currentStep);

  return (
    <div className="flex items-center justify-between mb-6">
      {idcSteps.map((item, index) => {
        const isCompleted = currentIndex > index;
        const isCurrent = currentIndex === index;
        const isLast = index === idcSteps.length - 1;

        return (
          <div key={item.step} className="flex items-center flex-1">
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-200 ${
                  isCompleted
                    ? 'bg-green-500 text-white'
                    : isCurrent
                    ? 'bg-blue-500 text-white ring-2 ring-blue-200'
                    : 'bg-gray-100 text-gray-400'
                }`}
              >
                {isCompleted ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  index + 1
                )}
              </div>
              <span
                className={`mt-1.5 text-xs text-center max-w-[70px] leading-tight ${
                  isCompleted
                    ? 'text-green-600 font-medium'
                    : isCurrent
                    ? 'text-blue-600 font-medium'
                    : 'text-gray-400'
                }`}
              >
                {item.label}
              </span>
            </div>
            {!isLast && (
              <div className="flex-1 mx-1 mt-[-20px]">
                <div
                  className={`h-0.5 rounded-full ${
                    isCompleted ? 'bg-green-500' : 'bg-gray-200'
                  }`}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const IdcStepGuide = ({ currentStep }: { currentStep: ProcessStatus }) => {
  const getGuideText = (): string => {
    switch (currentStep) {
      case ProcessStatus.WAITING_TARGET_CONFIRMATION:
        return '연결할 데이터베이스 정보를 입력하세요';
      case ProcessStatus.INSTALLING:
        return 'BDC 환경을 구성하고 방화벽을 확인하세요';
      case ProcessStatus.WAITING_CONNECTION_TEST:
      case ProcessStatus.CONNECTION_VERIFIED:
        return '설치가 완료되었습니다. DB 연결을 테스트하세요';
      case ProcessStatus.INSTALLATION_COMPLETE:
        return 'PII Agent 연동이 완료되었습니다.';
      default:
        return '';
    }
  };

  const guideText = getGuideText();

  return (
    <div className="flex items-start gap-3 mb-4">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
        currentStep === ProcessStatus.INSTALLATION_COMPLETE
          ? 'bg-green-100'
          : currentStep === ProcessStatus.INSTALLING
          ? 'bg-orange-100'
          : 'bg-blue-100'
      }`}>
        {currentStep === ProcessStatus.INSTALLATION_COMPLETE ? (
          <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : currentStep === ProcessStatus.INSTALLING ? (
          <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        ) : (
          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
          </svg>
        )}
      </div>
      <div>
        <p className={`font-medium ${
          currentStep === ProcessStatus.INSTALLATION_COMPLETE
            ? 'text-green-700'
            : 'text-gray-900'
        }`}>
          {guideText}
        </p>
        {currentStep === ProcessStatus.INSTALLING && (
          <p className="text-sm text-gray-500 mt-1">
            방화벽 확인 완료 후 연결 테스트를 진행할 수 있습니다.
          </p>
        )}
      </div>
    </div>
  );
};

export const ProjectDetail = ({ projectId }: ProjectDetailProps) => {
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [credentials, setCredentials] = useState<DBCredential[]>([]);
  const [testLoading, setTestLoading] = useState(false);

  // IDC-specific states
  const [showIdcResourceInput, setShowIdcResourceInput] = useState(false);
  const [idcInstallationStatus, setIdcInstallationStatus] = useState<IdcInstallationStatusType | null>(null);
  const [idcActionLoading, setIdcActionLoading] = useState(false);

  const isIdc = project?.cloudProvider === 'IDC';

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [projectData, userData] = await Promise.all([
          getProject(projectId),
          getCurrentUser(),
        ]);
        setProject(projectData);
        setCurrentUser(userData);
        // 초기 선택 상태: isSelected가 true인 리소스들
        setSelectedIds(projectData.resources.filter((r) => r.isSelected).map((r) => r.id));
        setError(null);

        // 4단계, 5단계, 6단계면 Credential 목록 가져오기
        if (projectData.processStatus === ProcessStatus.WAITING_CONNECTION_TEST ||
            projectData.processStatus === ProcessStatus.CONNECTION_VERIFIED ||
            projectData.processStatus === ProcessStatus.INSTALLATION_COMPLETE) {
          const creds = await getCredentials(projectId);
          setCredentials(creds || []);
        }

        // IDC: 설치 단계면 설치 상태 가져오기
        if (projectData.cloudProvider === 'IDC' && projectData.processStatus === ProcessStatus.INSTALLING) {
          try {
            const statusRes = await fetch(`/api/idc/projects/${projectId}/installation-status`);
            if (statusRes.ok) {
              const statusData = await statusRes.json();
              setIdcInstallationStatus(statusData);
            }
          } catch {
            // 설치 상태 조회 실패 시 무시
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '과제를 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [projectId]);

  // Credential 변경 핸들러
  const handleCredentialChange = async (resourceId: string, credentialId: string | null) => {
    if (!project) return;
    try {
      const updatedProject = await updateResourceCredential(projectId, resourceId, credentialId);
      setProject(updatedProject);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Credential 변경에 실패했습니다.');
    }
  };

  // Test Connection 핸들러
  const handleTestConnection = async () => {
    if (!project) return;

    const selectedResources = project.resources.filter((r) => r.isSelected);

    // Credential 필요한 리소스에 credential이 선택되었는지 확인
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

      const response = await runConnectionTest(projectId, resourceCredentials);
      setProject(response.project);
    } catch (err) {
      alert(err instanceof Error ? err.message : '연결 테스트에 실패했습니다.');
    } finally {
      setTestLoading(false);
    }
  };

  // 1단계이면 기본적으로 편집 모드
  const isStep1 = project?.processStatus === ProcessStatus.WAITING_TARGET_CONFIRMATION;
  const effectiveEditMode = isStep1 || isEditMode;

  const handleConfirmTargets = async () => {
    if (!project || selectedIds.length === 0) return;

    try {
      setSubmitting(true);
      const updatedProject = await confirmTargets(projectId, selectedIds);
      setProject(updatedProject);
      setIsEditMode(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : '승인 요청에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartEdit = () => {
    if (!project) return;
    // 현재 선택된 리소스로 초기화
    setSelectedIds(project.resources.filter((r) => r.isSelected).map((r) => r.id));
    setIsEditMode(true);
  };

  const handleCancelEdit = () => {
    if (!project) return;
    // 원래 선택 상태로 복원
    setSelectedIds(project.resources.filter((r) => r.isSelected).map((r) => r.id));
    setIsEditMode(false);
  };

  // IDC: 리소스 저장 핸들러
  const handleIdcResourceSave = useCallback(async (data: IdcResourceInput) => {
    if (!project) return;

    try {
      setIdcActionLoading(true);
      const res = await fetch(`/api/idc/projects/${projectId}/resources`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resources: [data] }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || '리소스 저장에 실패했습니다.');
      }

      // 프로젝트 데이터 새로고침
      const updatedProject = await getProject(projectId);
      setProject(updatedProject);
      setShowIdcResourceInput(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : '리소스 저장에 실패했습니다.');
    } finally {
      setIdcActionLoading(false);
    }
  }, [project, projectId]);

  // IDC: 방화벽 확인 완료 핸들러
  const handleIdcConfirmFirewall = useCallback(async () => {
    if (!project) return;

    try {
      setIdcActionLoading(true);
      const res = await fetch(`/api/idc/projects/${projectId}/confirm-firewall`, {
        method: 'POST',
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || '방화벽 확인에 실패했습니다.');
      }

      // 설치 상태 새로고침
      const statusRes = await fetch(`/api/idc/projects/${projectId}/installation-status`);
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setIdcInstallationStatus(statusData);
      }

      // 프로젝트 데이터 새로고침
      const updatedProject = await getProject(projectId);
      setProject(updatedProject);
    } catch (err) {
      alert(err instanceof Error ? err.message : '방화벽 확인에 실패했습니다.');
    } finally {
      setIdcActionLoading(false);
    }
  }, [project, projectId]);

  // IDC: 설치 재시도 핸들러
  const handleIdcRetry = useCallback(async () => {
    if (!project) return;

    try {
      setIdcActionLoading(true);
      const res = await fetch(`/api/idc/projects/${projectId}/check-installation`, {
        method: 'POST',
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || '재시도에 실패했습니다.');
      }

      // 설치 상태 새로고침
      const statusRes = await fetch(`/api/idc/projects/${projectId}/installation-status`);
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setIdcInstallationStatus(statusData);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : '재시도에 실패했습니다.');
    } finally {
      setIdcActionLoading(false);
    }
  }, [project, projectId]);

  // IDC: 연동 대상 확정 (승인 없이 바로 설치 시작)
  const handleIdcConfirmTargets = useCallback(async () => {
    if (!project || selectedIds.length === 0) return;

    try {
      setSubmitting(true);
      const res = await fetch(`/api/idc/projects/${projectId}/confirm-targets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resourceIds: selectedIds }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || '연동 대상 확정에 실패했습니다.');
      }

      // 프로젝트 데이터 새로고침
      const updatedProject = await getProject(projectId);
      setProject(updatedProject);
      setIsEditMode(false);

      // 설치 상태 가져오기
      if (updatedProject.processStatus === ProcessStatus.INSTALLING) {
        const statusRes = await fetch(`/api/idc/projects/${projectId}/installation-status`);
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
  }, [project, projectId, selectedIds]);

  // 현재 사용자가 관리자인지 확인
  const isAdmin = currentUser?.role === 'ADMIN';

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <p className="text-gray-900 font-medium mb-2">오류가 발생했습니다</p>
          <p className="text-gray-500 text-sm mb-4">{error || '과제를 찾을 수 없습니다.'}</p>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900">PII Agent</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">관리자</span>
          <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
        </div>
      </header>

      {/* Breadcrumb */}
      <div className="bg-white border-b border-gray-100 px-6 py-3">
        <nav className="flex items-center gap-2 text-sm">
          <button
            onClick={() => router.push('/admin')}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            관리자
          </button>
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <button
            onClick={() => router.push('/admin')}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            {project.serviceCode}
          </button>
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="font-medium text-gray-900">{project.projectCode}</span>
        </nav>
      </div>

      {/* Main Content */}
      <main className="p-6 space-y-6">
        {/* Info & Process Status Cards - Side by Side */}
        <div className="grid grid-cols-[350px_1fr] gap-6">
          {/* Left: Project Info */}
          <ProjectInfoCard project={project} />

          {/* Right: Process Status - IDC vs Others */}
          {isIdc ? (
            <div className="bg-white rounded-xl shadow-sm p-6 flex flex-col">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
                프로세스 진행 상태
              </h3>

              {/* IDC Step Progress - 승인 단계 없이 4단계 */}
              <IdcStepProgressBar currentStep={project.processStatus} />

              <div className="border-t border-gray-100 my-4" />

              <div className="flex-1 flex flex-col">
                {/* IDC Step Guide */}
                <IdcStepGuide currentStep={project.processStatus} />

                {/* IDC Action Buttons */}
                <div className="mt-auto pt-4">
                  {project.processStatus === ProcessStatus.WAITING_TARGET_CONFIRMATION && (
                    <div className="space-y-3">
                      {project.resources.length === 0 && !showIdcResourceInput && (
                        <button
                          onClick={() => setShowIdcResourceInput(true)}
                          disabled={idcActionLoading}
                          className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                        >
                          리소스 등록
                        </button>
                      )}
                      {project.resources.length > 0 && (
                        <p className="text-sm text-gray-500">
                          아래 리소스 목록에서 연동 대상을 선택하세요
                        </p>
                      )}
                    </div>
                  )}

                  {project.processStatus === ProcessStatus.INSTALLING && idcInstallationStatus && (
                    <IdcInstallationStatus
                      status={idcInstallationStatus}
                      onConfirmFirewall={handleIdcConfirmFirewall}
                      onRetry={handleIdcRetry}
                      onTestConnection={handleTestConnection}
                    />
                  )}

                  {(project.processStatus === ProcessStatus.WAITING_CONNECTION_TEST ||
                    project.processStatus === ProcessStatus.CONNECTION_VERIFIED ||
                    project.processStatus === ProcessStatus.INSTALLATION_COMPLETE) && (
                    <div className="space-y-3">
                      <button
                        onClick={handleTestConnection}
                        disabled={testLoading}
                        className="w-full px-4 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                      >
                        {testLoading && <LoadingSpinner />}
                        Test Connection
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <ProcessStatusCard
              project={project}
              isAdmin={isAdmin}
              onProjectUpdate={setProject}
              onTestConnection={handleTestConnection}
              testLoading={testLoading}
              credentials={credentials}
              onCredentialChange={handleCredentialChange}
            />
          )}
        </div>

        {/* IDC Resource Input Panel - 1단계에서만 표시 */}
        {isIdc && showIdcResourceInput && project.processStatus === ProcessStatus.WAITING_TARGET_CONFIRMATION && (
          <IdcResourceInputPanel
            onSave={handleIdcResourceSave}
            onCancel={() => setShowIdcResourceInput(false)}
          />
        )}

        {/* Resource Table - 4단계에서는 Credential 컬럼 표시 */}
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
        {project.isRejected && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h4 className="text-red-800 font-medium">승인 요청이 반려되었습니다</h4>
                {project.rejectionReason && (
                  <p className="text-red-600 text-sm mt-1">사유: {project.rejectionReason}</p>
                )}
                {project.rejectedAt && (
                  <p className="text-red-500 text-xs mt-1">
                    반려일시: {new Date(project.rejectedAt).toLocaleString('ko-KR')}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons - IDC vs Others */}
        <div className="flex justify-end gap-3">
          {isIdc ? (
            // IDC: 승인 단계 없음 - 바로 설치 진행
            <>
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
            </>
          ) : (
            // 다른 Provider: 승인 요청 필요
            <>
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
            </>
          )}
        </div>
      </main>
    </div>
  );
};
