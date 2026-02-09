'use client';

import { useState, useEffect } from 'react';
import { Project, AwsInstallationStatus } from '@/lib/types';
import { formatDateOnly } from '@/lib/utils/date';
import { getAwsInstallationStatus } from '@/app/lib/api/aws';
import { CloudProviderIcon } from '@/app/components/ui/CloudProviderIcon';
import { PROVIDER_FIELD_LABELS } from '@/lib/constants/labels';
import { badgeStyles, cardStyles, statusColors, cn } from '@/lib/theme';

interface ProjectInfoCardProps {
  project: Project;
  awsStatus?: AwsInstallationStatus | null;
}

// 설치 모드 뱃지 (AWS 전용)
const InstallationModeBadge = ({ isAutoInstall }: { isAutoInstall: boolean }) => {
  return (
    <div className="flex items-center gap-1.5">
      <span className={cn(badgeStyles.base, badgeStyles.sizes.md,
        isAutoInstall
          ? `${statusColors.info.bg} ${statusColors.info.textDark}`
          : `${statusColors.pending.bg} ${statusColors.pending.textDark}`
      )}>
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
      <span className={statusColors.pending.text} title="설치 모드는 프로젝트 생성 시 결정되며 변경할 수 없습니다">
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
        </svg>
      </span>
    </div>
  );
};

export const ProjectInfoCard = ({ project, awsStatus: externalAwsStatus }: ProjectInfoCardProps) => {
  const [internalAwsStatus, setInternalAwsStatus] = useState<AwsInstallationStatus | null>(null);

  // 외부에서 제공되지 않은 경우에만 자체 fetch
  useEffect(() => {
    if (project.cloudProvider === 'AWS' && externalAwsStatus === undefined) {
      getAwsInstallationStatus(project.id)
        .then(setInternalAwsStatus)
        .catch(() => {});
    }
  }, [project.id, project.cloudProvider, externalAwsStatus]);

  const awsStatus = externalAwsStatus ?? internalAwsStatus;

  return (
    <div className={`${cardStyles.base} p-6`}>
      <h3 className={`${cardStyles.title} mb-4`}>기본 정보</h3>
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

        {/* AWS 전용: Account ID */}
        {project.cloudProvider === 'AWS' && project.awsAccountId && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">{PROVIDER_FIELD_LABELS.AWS.accountId}</span>
            <span className="font-mono text-sm text-gray-900">{project.awsAccountId}</span>
          </div>
        )}

        {/* AWS 전용: 리전 타입 */}
        {project.cloudProvider === 'AWS' && project.awsRegionType && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">{PROVIDER_FIELD_LABELS.AWS.regionType}</span>
            <span className="text-sm text-gray-900">{project.awsRegionType === 'global' ? 'Global' : 'China'}</span>
          </div>
        )}

        {/* Azure 전용: Tenant ID */}
        {project.cloudProvider === 'Azure' && project.tenantId && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">{PROVIDER_FIELD_LABELS.Azure.tenantId}</span>
            <span className="font-mono text-sm text-gray-900">{project.tenantId}</span>
          </div>
        )}

        {/* Azure 전용: Subscription ID */}
        {project.cloudProvider === 'Azure' && project.subscriptionId && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">{PROVIDER_FIELD_LABELS.Azure.subscriptionId}</span>
            <span className="font-mono text-sm text-gray-900">{project.subscriptionId}</span>
          </div>
        )}

        {/* GCP 전용: Project ID */}
        {project.cloudProvider === 'GCP' && project.gcpProjectId && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">{PROVIDER_FIELD_LABELS.GCP.projectId}</span>
            <span className="font-mono text-sm text-gray-900">{project.gcpProjectId}</span>
          </div>
        )}

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
