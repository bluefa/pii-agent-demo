'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/app/components/ui/Button';
import { getPermissions, type UserSearchResult } from '@/app/lib/api';
import { useToast } from '@/app/components/ui/toast';
import { cn, statusColors, textColors, bgColors, borderColors } from '@/lib/theme';

interface ServiceHeaderV7Props {
  serviceCode: string;
  serviceName: string;
  totalInfraCount: number;
  lastUpdatedAt?: string | null;
  onAddInfra: () => void;
}

const formatRelativeTime = (iso?: string | null): string => {
  if (!iso) return '—';
  const parsed = new Date(iso).getTime();
  if (Number.isNaN(parsed)) return '—';
  const diffMs = Date.now() - parsed;
  if (diffMs < 0) return '방금';
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return '방금';
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  return `${days}일 전`;
};

const renderManagers = (managers: UserSearchResult[]): string => {
  if (managers.length === 0) return '담당자 없음';
  const names = managers.slice(0, 3).map((u) => u.name);
  const suffix = managers.length > 3 ? ` 외 ${managers.length - 3}명` : '';
  return names.join(' · ') + suffix;
};

export const ServiceHeaderV7 = ({
  serviceCode,
  serviceName,
  totalInfraCount,
  lastUpdatedAt,
  onAddInfra,
}: ServiceHeaderV7Props) => {
  const toast = useToast();
  const [managers, setManagers] = useState<UserSearchResult[]>([]);
  // Derived-state-from-prop: drop stale managers during render when serviceCode
  // changes, so the meta row never displays the previous service's data while
  // the new fetch is in flight. Equivalent to a setState in effect but without
  // the cascade-render warning.
  const [trackedServiceCode, setTrackedServiceCode] = useState(serviceCode);
  if (trackedServiceCode !== serviceCode) {
    setTrackedServiceCode(serviceCode);
    setManagers([]);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const users = await getPermissions(serviceCode);
        if (!cancelled) setManagers(users);
      } catch (err) {
        if (!cancelled) toast.error(err instanceof Error ? err.message : '담당자 조회 실패');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [serviceCode, toast]);

  return (
    <div
      className={cn(
        'flex items-start justify-between gap-6 mb-6 pb-5',
        borderColors.default,
        'border-b',
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-3">
          <span
            className={cn(
              'inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold',
              bgColors.muted,
              textColors.secondary,
            )}
          >
            {serviceCode}
          </span>
          <span
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold',
              statusColors.success.bg,
              statusColors.success.textDark,
            )}
          >
            <span className={cn('w-1.5 h-1.5 rounded-full', statusColors.success.dot)} />
            운영 중
          </span>
        </div>
        <h1 className={cn('text-2xl font-bold tracking-tight', textColors.primary)}>
          {serviceName || serviceCode}
        </h1>
        <div className={cn('mt-2 flex items-center gap-2 text-sm', textColors.tertiary)}>
          <span>
            <span className={cn('mr-1', textColors.quaternary)}>담당자</span>
            <span className={textColors.secondary}>{renderManagers(managers)}</span>
          </span>
          <span className={textColors.quaternary}>·</span>
          <span>
            <span className={cn('mr-1', textColors.quaternary)}>총 인프라</span>
            <span className={textColors.secondary}>{totalInfraCount}</span>
          </span>
          <span className={textColors.quaternary}>·</span>
          <span>
            <span className={cn('mr-1', textColors.quaternary)}>최근 업데이트</span>
            <span className={textColors.secondary}>{formatRelativeTime(lastUpdatedAt)}</span>
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Button onClick={onAddInfra} className="flex items-center gap-1.5">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          인프라 등록
        </Button>
      </div>
    </div>
  );
};
