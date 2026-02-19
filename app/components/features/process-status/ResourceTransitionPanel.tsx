'use client';

import { useState, useEffect } from 'react';
import { getConfirmedIntegration } from '@/app/lib/api';
import type { ResourceSnapshotItem } from '@/app/lib/api';
import type { Resource, CloudProvider, ProcessStatus, DatabaseType } from '@/lib/types';
import { ResourceTable } from '@/app/components/features/ResourceTable';
import { cn, statusColors, textColors, cardStyles } from '@/lib/theme';

interface ResourceTransitionPanelProps {
  targetSourceId: number;
  resources: Resource[];
  cloudProvider: CloudProvider;
  processStatus: ProcessStatus;
}

/** 스냅샷 데이터를 ResourceTable이 사용하는 Resource[]로 변환 */
function snapshotToResources(items: ResourceSnapshotItem[]): Resource[] {
  return items.map((item) => ({
    id: item.resource_id,
    resourceId: item.resource_id,
    type: item.resource_type,
    databaseType: ((item.endpoint_config?.db_type ?? item.resource_type) as DatabaseType),
    connectionStatus: 'CONNECTED' as const,
    isSelected: true,
    integrationCategory: 'TARGET' as const,
    selectedCredentialId: item.credential_id ?? undefined,
  }));
}

export const ResourceTransitionPanel = ({
  targetSourceId,
  resources,
  cloudProvider,
  processStatus,
}: ResourceTransitionPanelProps) => {
  const [oldResources, setOldResources] = useState<Resource[] | null>(null);
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    getConfirmedIntegration(targetSourceId)
      .then((res) => {
        const items = res.confirmed_integration?.resource_infos ?? [];
        setOldResources(items.length > 0 ? snapshotToResources(items) : null);
      })
      .catch(() => setOldResources(null))
      .finally(() => setFetched(true));
  }, [targetSourceId]);

  const hasOld = fetched && oldResources !== null && oldResources.length > 0;
  const newCount = resources.filter((r) => r.isSelected).length;

  return (
    <div className={cn(cardStyles.base, 'overflow-hidden')}>
      <div className="px-6 pt-6">
        <h2 className={cn('text-lg font-semibold', textColors.primary)}>Cloud 리소스</h2>
      </div>

      {/* 기존 연동 리소스 (변경 요청 시에만) */}
      {hasOld && (
        <>
          <div className={cn('mx-6 mt-4 px-4 py-2 rounded-t-lg flex items-center gap-2', 'bg-gray-100')}>
            <svg className={cn('w-4 h-4', textColors.tertiary)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
            <span className={cn('text-sm font-medium', textColors.tertiary)}>
              기존 연동 리소스 ({oldResources!.length}개)
            </span>
          </div>
          <div className="opacity-50">
            <ResourceTable
              resources={oldResources!}
              cloudProvider={cloudProvider}
              processStatus={processStatus}
              isEditMode={false}
            />
          </div>

          {/* 전환 화살표 */}
          <div className="flex items-center justify-center py-3">
            <div className={cn('flex items-center gap-2 px-4 py-1.5 rounded-full', statusColors.info.bg)}>
              <svg className={cn('w-4 h-4', statusColors.info.textDark)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
              <span className={cn('text-xs font-medium', statusColors.info.textDark)}>반영 중</span>
            </div>
          </div>
        </>
      )}

      {/* 신규 연동 리소스 */}
      <div className={cn('mx-6 px-4 py-2 flex items-center gap-2', hasOld ? 'rounded-t-lg' : 'mt-4 rounded-t-lg', statusColors.info.bg)}>
        <svg className={cn('w-4 h-4', statusColors.info.textDark)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        <span className={cn('text-sm font-medium', statusColors.info.textDark)}>
          {hasOld ? '신규 연동 리소스' : '연동 대상 리소스'} ({newCount}개)
        </span>
      </div>
      <ResourceTable
        resources={resources}
        cloudProvider={cloudProvider}
        processStatus={processStatus}
        isEditMode={false}
      />
    </div>
  );
};
