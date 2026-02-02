'use client';

import { useState, useEffect } from 'react';
import { Project, AwsInstallationStatus } from '@/lib/types';
import { formatDateOnly } from '@/lib/utils/date';
import { getAwsInstallationStatus } from '@/app/lib/api/aws';

interface ProjectInfoCardProps {
  project: Project;
}

const AwsIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M6.76 10.17c0 .4.03.73.09 1 .06.26.14.49.26.68.04.06.06.12.06.17 0 .07-.04.14-.13.2l-.42.28c-.06.04-.12.06-.17.06-.07 0-.14-.03-.2-.1-.12-.13-.22-.27-.31-.42-.09-.16-.17-.33-.26-.52-.65.77-1.47 1.16-2.46 1.16-.7 0-1.26-.2-1.67-.6-.41-.4-.62-.94-.62-1.61 0-.71.25-1.29.76-1.73.51-.44 1.18-.66 2.03-.66.28 0 .57.02.87.07.3.04.61.11.93.18v-.6c0-.62-.13-1.06-.38-1.31-.26-.25-.69-.38-1.31-.38-.28 0-.57.03-.87.1-.3.07-.59.15-.87.25-.13.05-.22.08-.27.09-.05.01-.09.02-.12.02-.1 0-.15-.08-.15-.23v-.37c0-.12.02-.21.05-.27.03-.06.09-.12.18-.17.28-.15.62-.27 1.02-.37.4-.1.83-.15 1.28-.15 1 0 1.73.23 2.21.68.47.45.71 1.14.71 2.06v2.72zm-3.4 1.27c.27 0 .55-.05.84-.15.29-.1.55-.28.77-.52.14-.15.24-.32.3-.52.06-.2.1-.43.1-.71v-.34c-.24-.06-.49-.1-.74-.13-.25-.03-.5-.05-.74-.05-.53 0-.92.1-1.18.31-.26.21-.39.51-.39.89 0 .37.1.65.29.84.19.2.47.29.82.29v.09zm6.27.85c-.13 0-.22-.02-.28-.07-.06-.05-.12-.15-.17-.29l-1.9-6.28c-.05-.14-.08-.24-.08-.29 0-.12.06-.18.18-.18h.73c.14 0 .23.02.29.07.06.05.11.15.16.29l1.36 5.38 1.26-5.38c.04-.14.09-.24.15-.29.06-.05.16-.07.29-.07h.59c.14 0 .23.02.29.07.06.05.12.15.16.29l1.27 5.45 1.4-5.45c.05-.14.1-.24.16-.29.06-.05.16-.07.29-.07h.69c.12 0 .18.06.18.18 0 .05-.01.1-.02.16-.01.06-.03.13-.06.22l-1.95 6.28c-.05.14-.1.24-.17.29-.06.05-.16.07-.28.07h-.63c-.14 0-.23-.02-.29-.07-.06-.05-.12-.15-.16-.29l-1.25-5.2-1.24 5.2c-.04.14-.09.24-.15.29-.06.05-.16.07-.29.07h-.63zm10.02.21c-.4 0-.81-.05-1.21-.14-.4-.09-.71-.19-.92-.3-.12-.07-.2-.14-.24-.22-.04-.08-.06-.16-.06-.24v-.38c0-.15.06-.23.17-.23.04 0 .09.01.13.02.04.01.11.04.19.07.26.11.54.2.83.26.3.06.59.09.88.09.5 0 .88-.09 1.15-.26.27-.18.4-.42.4-.74 0-.22-.07-.4-.22-.55-.15-.15-.42-.28-.82-.41l-1.18-.37c-.59-.19-1.03-.47-1.3-.84-.27-.37-.41-.78-.41-1.23 0-.36.08-.67.23-.95.15-.28.36-.52.61-.71.25-.2.55-.35.89-.45.34-.1.7-.15 1.08-.15.18 0 .36.01.54.03.18.02.36.05.53.08.17.04.33.08.48.13.15.05.27.1.36.16.1.06.17.12.22.18.05.06.07.13.07.22v.35c0 .15-.06.23-.17.23-.06 0-.16-.03-.28-.09-.43-.2-.91-.3-1.44-.3-.45 0-.8.08-1.05.23-.25.15-.37.38-.37.69 0 .22.08.4.24.56.16.16.45.3.87.43l1.15.37c.58.19 1.01.45 1.27.81.26.35.39.75.39 1.18 0 .37-.08.7-.23 1-.15.3-.37.56-.64.77-.28.21-.61.38-1 .49-.4.11-.83.16-1.29.16z" />
  </svg>
);

const AzureIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 18 18" fill="currentColor">
    <path d="M6.5 1L0 14.76h4.58L6.5 1zM7.09 3.36l2.19 6.3-4.2 5.1h8.92l-6.91-11.4z" />
  </svg>
);

const GcpIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12.19 2.38a9.34 9.34 0 0 0-9.07 6.89h.01a5.88 5.88 0 0 0-2.6 4.86 5.88 5.88 0 0 0 5.88 5.88h11.49a4.77 4.77 0 0 0 4.77-4.77 4.77 4.77 0 0 0-4.26-4.73 9.31 9.31 0 0 0-6.22-8.13zm-.01 1.74a7.58 7.58 0 0 1 5.04 5.89l.2 1.05 1.07.07a3.03 3.03 0 0 1 2.78 3.01 3.03 3.03 0 0 1-3.03 3.03H6.41a4.14 4.14 0 0 1-4.14-4.14 4.14 4.14 0 0 1 2.18-3.64l.84-.45.08-.96A7.58 7.58 0 0 1 12.18 4.12z" />
  </svg>
);

const ServerIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="2" y="3" width="20" height="6" rx="1" />
    <rect x="2" y="15" width="20" height="6" rx="1" />
    <circle cx="6" cy="6" r="1" fill="currentColor" />
    <circle cx="6" cy="18" r="1" fill="currentColor" />
  </svg>
);

const CloudProviderIcon = ({ provider }: { provider: string }) => {
  const configs: Record<string, { bg: string; text: string; label: string; icon: React.ReactNode }> = {
    AWS: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'AWS', icon: <AwsIcon className="w-4 h-4" /> },
    Azure: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Azure', icon: <AzureIcon className="w-4 h-4" /> },
    GCP: { bg: 'bg-red-100', text: 'text-red-700', label: 'GCP', icon: <GcpIcon className="w-4 h-4" /> },
    IDC: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'IDC', icon: <ServerIcon className="w-4 h-4" /> },
    SDU: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'SDU', icon: <ServerIcon className="w-4 h-4" /> },
  };

  const config = configs[provider] || configs.IDC;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${config.bg} ${config.text} text-sm font-medium`}>
      {config.icon}
      {config.label}
    </span>
  );
};

// 설치 모드 뱃지 (AWS 전용)
const InstallationModeBadge = ({ isAutoInstall }: { isAutoInstall: boolean }) => {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm font-medium ${
        isAutoInstall
          ? 'bg-blue-100 text-blue-700'
          : 'bg-gray-100 text-gray-700'
      }`}>
        {isAutoInstall ? (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            자동 설치
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            수동 설치
          </>
        )}
      </span>
      <span className="text-gray-400" title="설치 모드는 프로젝트 생성 시 결정되며 변경할 수 없습니다">
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
        </svg>
      </span>
    </div>
  );
};

export const ProjectInfoCard = ({ project }: ProjectInfoCardProps) => {
  const [awsStatus, setAwsStatus] = useState<AwsInstallationStatus | null>(null);

  // AWS 프로젝트인 경우 설치 모드 조회
  useEffect(() => {
    if (project.cloudProvider === 'AWS') {
      getAwsInstallationStatus(project.id)
        .then(setAwsStatus)
        .catch(() => {}); // 에러 시 무시 (뱃지 미표시)
    }
  }, [project.id, project.cloudProvider]);

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">기본 정보</h3>
      <div className="space-y-4">
        {/* 과제 코드 */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">과제 코드</span>
          <span className="font-semibold text-gray-900">{project.projectCode}</span>
        </div>

        {/* 서비스 코드 */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">서비스 코드</span>
          <span className="font-medium text-gray-900">{project.serviceCode}</span>
        </div>

        {/* Cloud Provider */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">Cloud Provider</span>
          <CloudProviderIcon provider={project.cloudProvider} />
        </div>

        {/* 설치 모드 (AWS만) */}
        {project.cloudProvider === 'AWS' && awsStatus && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">설치 모드</span>
            <InstallationModeBadge isAutoInstall={awsStatus.hasTfPermission} />
          </div>
        )}

        {/* 생성일 */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">생성일</span>
          <span className="text-gray-700">{formatDateOnly(project.createdAt)}</span>
        </div>

        {/* 리소스 수 */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">리소스 수</span>
          <span className="text-gray-700">{project.resources.length}개</span>
        </div>

        {/* 설명 */}
        {project.description && (
          <div className="pt-3 border-t border-gray-100">
            <span className="text-sm text-gray-500 block mb-1">설명</span>
            <p className="text-gray-700 text-sm leading-relaxed">{project.description}</p>
          </div>
        )}
      </div>
    </div>
  );
};
