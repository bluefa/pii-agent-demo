'use client';

import type { Project } from '@/lib/types';
import type { IamUser, SourceIpEntry } from '@/lib/types/sdu';
import { formatDateOnly } from '@/lib/utils/date';
import { CloudProviderIcon } from '@/app/components/ui/CloudProviderIcon';
import { cn, statusColors } from '@/lib/theme';

interface SduProjectInfoCardProps {
  project: Project;
  iamUser: IamUser | null;
  sourceIps: SourceIpEntry[];
  onOpenIamUser: () => void;
  onOpenSourceIp: () => void;
  onOpenSetupGuide: () => void;
}

export const SduProjectInfoCard = ({
  project,
  iamUser,
  sourceIps,
  onOpenIamUser,
  onOpenSourceIp,
  onOpenSetupGuide,
}: SduProjectInfoCardProps) => {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6 space-y-5">
      {/* 기본 정보 */}
      <div>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">기본 정보</h3>
        <div className="space-y-3">
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

      <div className="border-t border-gray-200" />

      {/* IAM USER */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">IAM USER</h4>
          <button
            onClick={onOpenIamUser}
            className={cn('text-xs font-medium px-2 py-1 rounded transition-colors', statusColors.info.text, 'hover:bg-gray-100')}
          >
            관리
          </button>
        </div>
        {iamUser ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="text-sm font-medium text-gray-900">{iamUser.userName}</span>
            </div>
            {iamUser.akSkIssuedAt && (
              <p className="text-xs text-gray-500 ml-6">
                AK/SK 발급: {formatDateOnly(iamUser.akSkIssuedAt)}
                {iamUser.akSkExpiresAt && ` · 만료: ${formatDateOnly(iamUser.akSkExpiresAt)}`}
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs text-gray-400">아직 생성되지 않았습니다</p>
        )}
      </div>

      <div className="border-t border-gray-200" />

      {/* SourceIP */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">SourceIP</h4>
          <button
            onClick={onOpenSourceIp}
            className={cn('text-xs font-medium px-2 py-1 rounded transition-colors', statusColors.info.text, 'hover:bg-gray-100')}
          >
            관리
          </button>
        </div>
        {sourceIps.length > 0 ? (
          <div className="space-y-1.5">
            {sourceIps.slice(0, 3).map((entry) => (
              <div key={entry.cidr} className="flex items-center">
                <code className="text-xs font-mono text-gray-900">{entry.cidr}</code>
              </div>
            ))}
            {sourceIps.length > 3 && (
              <p className="text-xs text-gray-400">외 {sourceIps.length - 3}건</p>
            )}
            <p className="text-xs text-gray-500 mt-1">{sourceIps.length}건 등록</p>
          </div>
        ) : (
          <p className="text-xs text-gray-400">등록된 SourceIP가 없습니다</p>
        )}
      </div>

      <div className="border-t border-gray-200" />

      {/* 환경 구성 가이드 */}
      <button
        onClick={onOpenSetupGuide}
        className="w-full flex items-center gap-3 px-3 py-2.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-left transition-colors"
      >
        <svg className={cn('w-5 h-5 flex-shrink-0', statusColors.info.text)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
        <div>
          <span className="text-sm font-medium text-gray-900">환경 구성 가이드</span>
          <p className="text-xs text-gray-500">SDU 설치 절차 안내</p>
        </div>
      </button>
    </div>
  );
};
