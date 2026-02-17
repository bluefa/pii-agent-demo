'use client';

import { useRouter } from 'next/navigation';
import { ProjectSummary, ProcessStatus, CloudProvider } from '@/lib/types';
import { CloudProviderIcon } from '@/app/components/ui/CloudProviderIcon';

interface ProjectsTableProps {
  projects: ProjectSummary[];
  loading: boolean;
  actionLoading: string | null;
  onConfirmCompletion: (targetSourceId: number, e: React.MouseEvent) => void;
  onViewApproval?: (project: ProjectSummary, e: React.MouseEvent) => void;
}

const getStatusBadge = (status: ProcessStatus, hasDisconnected: boolean, hasNew: boolean) => {
  if (hasDisconnected) return { text: '끊김', color: 'bg-red-500' };
  if (hasNew) return { text: '신규', color: 'bg-blue-500' };

  switch (status) {
    case ProcessStatus.INSTALLATION_COMPLETE:
      return { text: '완료', color: 'bg-green-500' };
    case ProcessStatus.INSTALLING:
      return { text: '설치중', color: 'bg-orange-500' };
    default:
      return { text: '대기', color: 'bg-gray-400' };
  }
};

const getStatusText = (status: ProcessStatus) => {
  switch (status) {
    case ProcessStatus.WAITING_TARGET_CONFIRMATION:
      return '연동 대상 확정 대기';
    case ProcessStatus.WAITING_APPROVAL:
      return '승인 대기';
    case ProcessStatus.INSTALLING:
      return '설치 진행 중';
    case ProcessStatus.WAITING_CONNECTION_TEST:
      return '연결 테스트 필요';
    case ProcessStatus.CONNECTION_VERIFIED:
      return '연결 확인 완료';
    case ProcessStatus.INSTALLATION_COMPLETE:
      return '설치 완료';
    default:
      return '-';
  }
};

export const ProjectsTable = ({
  projects,
  loading,
  actionLoading,
  onConfirmCompletion,
  onViewApproval,
}: ProjectsTableProps) => {
  const router = useRouter();

  if (loading) {
    return (
      <div className="p-12 text-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
        <p className="text-gray-500 text-sm">로딩 중...</p>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="p-12 text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <p className="text-gray-500">등록된 과제가 없습니다</p>
        <p className="text-gray-400 text-sm mt-1">상단의 과제 등록 버튼으로 새 과제를 추가하세요</p>
      </div>
    );
  }

  return (
    <table className="w-full">
      <thead>
        <tr className="border-b border-gray-100">
          <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider w-16"></th>
          <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">과제 코드</th>
          <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">설명</th>
          <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">상태</th>
          <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider w-20"></th>
          <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">액션</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-50">
        {projects.map((project) => {
          const badge = getStatusBadge(project.processStatus, project.hasDisconnected, project.hasNew);
          return (
            <tr
              key={project.id}
              onClick={() => router.push(`/projects/${project.targetSourceId}`)}
              className="hover:bg-blue-50/50 cursor-pointer transition-colors group"
            >
              <td className="px-6 py-4">
                <CloudProviderIcon provider={project.cloudProvider as CloudProvider} size="sm" />
              </td>
              <td className="px-6 py-4">
                <span className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                  {project.projectCode}
                </span>
              </td>
              <td className="px-6 py-4 text-gray-500 max-w-xs truncate">
                {project.description || '-'}
              </td>
              <td className="px-6 py-4 text-gray-500 text-sm">{getStatusText(project.processStatus)}</td>
              <td className="px-6 py-4">
                <span className={`inline-block px-2.5 py-1 text-xs font-medium text-white rounded-full ${badge.color}`}>
                  {badge.text}
                </span>
              </td>
              <td className="px-6 py-4">
                {project.processStatus === ProcessStatus.WAITING_APPROVAL && onViewApproval && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onViewApproval(project, e); }}
                    className="px-3 py-1.5 bg-blue-500 text-white text-xs font-medium rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-1.5"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    승인 요청 확인
                  </button>
                )}
                {project.processStatus === ProcessStatus.INSTALLING && (
                  <span className="px-3 py-1.5 bg-orange-100 text-orange-600 text-xs font-medium rounded-lg">
                    설치 진행 중
                  </span>
                )}
                {project.processStatus === ProcessStatus.WAITING_CONNECTION_TEST && (
                  <span className="px-3 py-1.5 bg-gray-100 text-gray-500 text-xs font-medium rounded-lg">
                    연결 테스트 대기
                  </span>
                )}
                {project.processStatus === ProcessStatus.CONNECTION_VERIFIED && (
                  <button
                    onClick={(e) => onConfirmCompletion(project.targetSourceId, e)}
                    disabled={actionLoading === String(project.targetSourceId)}
                    className="px-3 py-1.5 bg-green-500 text-white text-xs font-medium rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                  >
                    {actionLoading === String(project.targetSourceId) ? (
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    설치 완료 확정
                  </button>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};
