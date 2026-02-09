'use client';

import type { Project } from '@/lib/types';
import { formatDateOnly } from '@/lib/utils/date';
import { CloudProviderIcon } from '@/app/components/ui/CloudProviderIcon';
import { cardStyles, cn, textColors } from '@/lib/theme';

interface ProjectInfoCardProps {
  project: Project;
}

export const ProjectInfoCard = ({ project }: ProjectInfoCardProps) => (
  <div className={cn(cardStyles.base, 'p-6')}>
    <h3 className={cn(cardStyles.title, 'mb-4')}>기본 정보</h3>
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className={cn('text-sm', textColors.tertiary)}>과제 코드</span>
        <span className={cn('font-semibold', textColors.primary)}>{project.projectCode}</span>
      </div>

      <div className="flex items-center justify-between">
        <span className={cn('text-sm', textColors.tertiary)}>서비스 코드</span>
        <span className={cn('font-medium', textColors.primary)}>{project.serviceCode}</span>
      </div>

      <div className="flex items-center justify-between">
        <span className={cn('text-sm', textColors.tertiary)}>Cloud Provider</span>
        <CloudProviderIcon provider={project.cloudProvider} />
      </div>

      <div className="flex items-center justify-between">
        <span className={cn('text-sm', textColors.tertiary)}>생성일</span>
        <span className={textColors.secondary}>{formatDateOnly(project.createdAt)}</span>
      </div>

      {project.description && (
        <div className="pt-3 border-t border-gray-100">
          <span className={cn('text-sm block mb-1', textColors.tertiary)}>설명</span>
          <p className={cn('text-sm leading-relaxed', textColors.secondary)}>{project.description}</p>
        </div>
      )}
    </div>
  </div>
);
