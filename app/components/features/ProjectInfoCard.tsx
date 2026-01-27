'use client';

import { Project } from '@/lib/types';
import { formatDateOnly } from '@/lib/utils/date';

interface ProjectInfoCardProps {
  project: Project;
}

const CloudProviderIcon = ({ provider }: { provider: string }) => {
  if (provider === 'AWS') {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-orange-100 text-orange-700 text-sm font-medium">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6.76 10.17c0 .4.03.73.09 1 .06.26.14.49.26.68.04.06.06.12.06.17 0 .07-.04.14-.13.2l-.42.28c-.06.04-.12.06-.17.06-.07 0-.14-.03-.2-.1-.12-.13-.22-.27-.31-.42-.09-.16-.17-.33-.26-.52-.65.77-1.47 1.16-2.46 1.16-.7 0-1.26-.2-1.67-.6-.41-.4-.62-.94-.62-1.61 0-.71.25-1.29.76-1.73.51-.44 1.18-.66 2.03-.66.28 0 .57.02.87.07.3.04.61.11.93.18v-.6c0-.62-.13-1.06-.38-1.31-.26-.25-.69-.38-1.31-.38-.28 0-.57.03-.87.1-.3.07-.59.15-.87.25-.13.05-.22.08-.27.09-.05.01-.09.02-.12.02-.1 0-.15-.08-.15-.23v-.37c0-.12.02-.21.05-.27.03-.06.09-.12.18-.17.28-.15.62-.27 1.02-.37.4-.1.83-.15 1.28-.15 1 0 1.73.23 2.21.68.47.45.71 1.14.71 2.06v2.72zm-3.4 1.27c.27 0 .55-.05.84-.15.29-.1.55-.28.77-.52.14-.15.24-.32.3-.52.06-.2.1-.43.1-.71v-.34c-.24-.06-.49-.1-.74-.13-.25-.03-.5-.05-.74-.05-.53 0-.92.1-1.18.31-.26.21-.39.51-.39.89 0 .37.1.65.29.84.19.2.47.29.82.29v.09zm6.27.85c-.13 0-.22-.02-.28-.07-.06-.05-.12-.15-.17-.29l-1.9-6.28c-.05-.14-.08-.24-.08-.29 0-.12.06-.18.18-.18h.73c.14 0 .23.02.29.07.06.05.11.15.16.29l1.36 5.38 1.26-5.38c.04-.14.09-.24.15-.29.06-.05.16-.07.29-.07h.59c.14 0 .23.02.29.07.06.05.12.15.16.29l1.27 5.45 1.4-5.45c.05-.14.1-.24.16-.29.06-.05.16-.07.29-.07h.69c.12 0 .18.06.18.18 0 .05-.01.1-.02.16-.01.06-.03.13-.06.22l-1.95 6.28c-.05.14-.1.24-.17.29-.06.05-.16.07-.28.07h-.63c-.14 0-.23-.02-.29-.07-.06-.05-.12-.15-.16-.29l-1.25-5.2-1.24 5.2c-.04.14-.09.24-.15.29-.06.05-.16.07-.29.07h-.63zm10.02.21c-.4 0-.81-.05-1.21-.14-.4-.09-.71-.19-.92-.3-.12-.07-.2-.14-.24-.22-.04-.08-.06-.16-.06-.24v-.38c0-.15.06-.23.17-.23.04 0 .09.01.13.02.04.01.11.04.19.07.26.11.54.2.83.26.3.06.59.09.88.09.5 0 .88-.09 1.15-.26.27-.18.4-.42.4-.74 0-.22-.07-.4-.22-.55-.15-.15-.42-.28-.82-.41l-1.18-.37c-.59-.19-1.03-.47-1.3-.84-.27-.37-.41-.78-.41-1.23 0-.36.08-.67.23-.95.15-.28.36-.52.61-.71.25-.2.55-.35.89-.45.34-.1.7-.15 1.08-.15.18 0 .36.01.54.03.18.02.36.05.53.08.17.04.33.08.48.13.15.05.27.1.36.16.1.06.17.12.22.18.05.06.07.13.07.22v.35c0 .15-.06.23-.17.23-.06 0-.16-.03-.28-.09-.43-.2-.91-.3-1.44-.3-.45 0-.8.08-1.05.23-.25.15-.37.38-.37.69 0 .22.08.4.24.56.16.16.45.3.87.43l1.15.37c.58.19 1.01.45 1.27.81.26.35.39.75.39 1.18 0 .37-.08.7-.23 1-.15.3-.37.56-.64.77-.28.21-.61.38-1 .49-.4.11-.83.16-1.29.16z" />
          </svg>
          AWS
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700 text-sm font-medium">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 3L2 9l10 6 10-6-10-6zM2 15l10 6 10-6M2 12l10 6 10-6" />
        </svg>
        IDC
      </span>
    </div>
  );
};

export const ProjectInfoCard = ({ project }: ProjectInfoCardProps) => {
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
