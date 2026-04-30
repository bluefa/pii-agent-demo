'use client';

import { cn, tabStyles } from '@/lib/theme';
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
      className={cn(tabStyles.segmented.container, tabStyles.segmented.containerBg, 'mb-4')}
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
            className={cn(tabStyles.segmented.item, active && tabStyles.segmented.itemActive)}
          >
            <span>{TAB_LABELS[key]}</span>
            <span
              className={cn(
                tabStyles.segmented.countBadge,
                active && tabStyles.segmented.countBadgeActive,
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
