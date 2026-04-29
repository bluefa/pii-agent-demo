'use client';

import {
  bgColors,
  cn,
  primaryColors,
  shadows,
  textColors,
} from '@/lib/theme';
import type { GcpStepKey } from '@/lib/constants/gcp';
import type { InstallResourceRow } from '@/app/components/features/process-status/install-task-pipeline/join-installation-resources';
import {
  countDetailTabs,
  type DetailTab,
} from '@/app/components/features/process-status/install-task-pipeline/install-task-detail/filter-rows';

const TAB_LABELS: Record<DetailTab, string> = {
  all: '전체',
  done: '완료',
  running: '진행중',
};

interface DetailStatusTabsProps {
  rows: InstallResourceRow[];
  stepKey: GcpStepKey;
  value: DetailTab;
  onChange: (tab: DetailTab) => void;
}

export const DetailStatusTabs = ({
  rows,
  stepKey,
  value,
  onChange,
}: DetailStatusTabsProps) => {
  const counts = countDetailTabs(rows, stepKey);

  return (
    <div
      role="tablist"
      aria-label="진행 상태 필터"
      className={cn('inline-flex gap-1 p-1 rounded-lg mb-4', bgColors.muted)}
    >
      {(['all', 'done', 'running'] as const).map((key) => {
        const active = value === key;
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(key)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md',
              'text-[12.5px] font-semibold',
              active
                ? cn(bgColors.surface, textColors.primary, shadows.pill)
                : cn('bg-transparent', textColors.tertiary),
            )}
          >
            <span>{TAB_LABELS[key]}</span>
            <span
              className={cn(
                'inline-flex items-center justify-center min-w-[18px] px-1.5',
                'rounded-full text-[11px] font-bold',
                active
                  ? cn(primaryColors.bgLight, primaryColors.text)
                  : cn(bgColors.divider, textColors.tertiary),
              )}
            >
              {counts[key]}
            </span>
          </button>
        );
      })}
    </div>
  );
};
