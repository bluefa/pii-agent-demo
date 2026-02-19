'use client';

import { useState, useEffect } from 'react';
import { getApprovedIntegration, getConfirmedIntegration } from '@/app/lib/api';
import type { ResourceSnapshotItem } from '@/app/lib/api';
import { cn, statusColors, textColors, bgColors, tableStyles } from '@/lib/theme';

interface ApprovalApplyingBannerProps {
  targetSourceId?: number;
  hasConfirmedIntegration?: boolean;
}

export const ApprovalApplyingBanner = ({
  targetSourceId,
  hasConfirmedIntegration,
}: ApprovalApplyingBannerProps) => {
  const [confirmedResources, setConfirmedResources] = useState<ResourceSnapshotItem[] | null>(null);
  const [approvedResources, setApprovedResources] = useState<ResourceSnapshotItem[] | null>(null);

  // 파생 상태: 데이터 로딩 전까지 loading
  const loading = !!targetSourceId && approvedResources === null;

  useEffect(() => {
    if (!targetSourceId) return;

    const fetches: Promise<void>[] = [
      getApprovedIntegration(targetSourceId)
        .then((res) => setApprovedResources(res.approved_integration?.resource_infos ?? []))
        .catch(() => setApprovedResources([])),
    ];

    if (hasConfirmedIntegration) {
      fetches.push(
        getConfirmedIntegration(targetSourceId)
          .then((res) => setConfirmedResources(res.confirmed_integration?.resource_infos ?? []))
          .catch(() => setConfirmedResources([])),
      );
    }

    Promise.all(fetches);
  }, [targetSourceId, hasConfirmedIntegration]);

  return (
    <div className={cn(
      'w-full p-4 rounded-lg border mb-3',
      statusColors.info.bg,
      statusColors.info.border,
    )}>
      {/* 헤더 */}
      <div className="flex items-start gap-3">
        <div className={cn('w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0', statusColors.info.bg)}>
          <svg className={cn('w-5 h-5', statusColors.info.textDark)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div className="flex-1">
          <p className={cn('font-medium', statusColors.info.textDark)}>
            승인이 완료되어 연동을 반영하고 있습니다
          </p>
          <p className={cn('text-sm mt-1', statusColors.info.text)}>
            반영은 최대 하루 소요될 수 있습니다. 완료 시 알림을 보내드립니다.
          </p>
        </div>
      </div>

      {/* 리소스 전환 상세 */}
      {targetSourceId && (
        <div className="mt-4">
          {loading ? (
            <div className={cn('text-sm text-center py-3', textColors.tertiary)}>리소스 정보를 불러오는 중...</div>
          ) : (
            <div className="space-y-3">
              {/* 기존 리소스 (변경 요청 시에만) */}
              {hasConfirmedIntegration && confirmedResources && confirmedResources.length > 0 && (
                <ResourceSection
                  label="기존 연동 리소스"
                  resources={confirmedResources}
                  variant="old"
                />
              )}

              {/* 전환 화살표 (변경 요청 시에만) */}
              {hasConfirmedIntegration && confirmedResources && confirmedResources.length > 0 && (
                <div className="flex items-center justify-center py-1">
                  <svg className={cn('w-5 h-5', statusColors.info.textDark)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </div>
              )}

              {/* 신규 리소스 */}
              {approvedResources && approvedResources.length > 0 && (
                <ResourceSection
                  label={hasConfirmedIntegration ? '신규 연동 리소스' : '연동 대상 리소스'}
                  resources={approvedResources}
                  variant="new"
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// --- 내부 컴포넌트 ---

interface ResourceSectionProps {
  label: string;
  resources: ResourceSnapshotItem[];
  variant: 'old' | 'new';
}

const ResourceSection = ({ label, resources, variant }: ResourceSectionProps) => (
  <div className={cn(
    'border rounded-lg overflow-hidden',
    variant === 'old' ? 'border-gray-200' : statusColors.info.border,
  )}>
    <div className={cn(
      'px-3 py-2 text-xs font-medium flex items-center gap-2',
      variant === 'old' ? `${bgColors.muted} ${textColors.tertiary}` : `${statusColors.info.bg} ${statusColors.info.textDark}`,
    )}>
      {variant === 'old' ? (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
        </svg>
      ) : (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      )}
      {label} ({resources.length}개)
    </div>
    <table className="w-full text-sm">
      <thead className={bgColors.muted}>
        <tr>
          <th className={cn('px-3 py-1.5 text-left text-xs font-medium', textColors.tertiary)}>리소스 ID</th>
          <th className={cn('px-3 py-1.5 text-left text-xs font-medium', textColors.tertiary)}>유형</th>
          <th className={cn('px-3 py-1.5 text-left text-xs font-medium', textColors.tertiary)}>Credential</th>
        </tr>
      </thead>
      <tbody className={tableStyles.body}>
        {resources.map((r) => (
          <tr key={r.resource_id} className={variant === 'old' ? 'opacity-60' : ''}>
            <td className={cn('px-3 py-1.5 font-mono text-xs', textColors.secondary)}>{r.resource_id}</td>
            <td className={cn('px-3 py-1.5 text-xs', textColors.tertiary)}>{r.resource_type}</td>
            <td className={cn('px-3 py-1.5 text-xs', textColors.tertiary)}>{r.credential_id || '-'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
