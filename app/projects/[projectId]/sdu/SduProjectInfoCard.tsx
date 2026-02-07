'use client';

import { Project } from '@/lib/types';
import { formatDateOnly } from '@/lib/utils/date';
import { CloudProviderIcon } from '@/app/components/ui/CloudProviderIcon';

interface SduProjectInfoCardProps {
  project: Project;
}

export const SduProjectInfoCard = ({ project }: SduProjectInfoCardProps) => {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">기본 정보</h3>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">과제 코드</span>
          <span className="font-semibold text-gray-900">{project.projectCode}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">서비스 코드</span>
          <span className="font-medium text-gray-900">{project.serviceCode}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">Cloud Provider</span>
          <CloudProviderIcon provider={project.cloudProvider} />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">생성일</span>
          <span className="text-gray-700">{formatDateOnly(project.createdAt)}</span>
        </div>

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
