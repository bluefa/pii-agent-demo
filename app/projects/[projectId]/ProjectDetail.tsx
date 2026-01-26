'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Project, ProcessStatus, DBCredential, needsCredential } from '../../../lib/types';
import {
  getProject,
  confirmTargets,
  getCurrentUser,
  CurrentUser,
  getCredentials,
  updateResourceCredential,
  runConnectionTest,
  ResourceCredentialInput,
} from '../../lib/api';
import { ProjectInfoCard } from '../../components/features/ProjectInfoCard';
import { ProcessStatusCard } from '../../components/features/ProcessStatusCard';
import { ResourceTable } from '../../components/features/ResourceTable';

interface ProjectDetailProps {
  projectId: string;
}

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

  // 이 페이지는 서비스 담당자용 페이지이므로 isAdmin은 항상 false
  // 관리자 기능(승인/반려, 설치 완료 확정)은 AdminDashboard에서 처리
  const isAdmin = false;

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

          {/* Right: Process Status */}
          <ProcessStatusCard
            project={project}
            isAdmin={isAdmin}
            onProjectUpdate={setProject}
            onTestConnection={handleTestConnection}
            testLoading={testLoading}
            credentials={credentials}
            onCredentialChange={handleCredentialChange}
          />
        </div>

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
                {submitting && (
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" strokeDasharray="31.4 31.4" />
                  </svg>
                )}
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
