import {
  isActionableStepStatus,
  isCompletedStepStatus,
  isSkippedStepStatus,
  type GcpStepKey,
} from '@/lib/constants/gcp';
import type { InstallResourceRow } from '@/app/components/features/process-status/install-task-pipeline/join-installation-resources';

export type DetailTab = 'all' | 'done' | 'running';

export const filterRowsByDetailTab = (
  rows: InstallResourceRow[],
  stepKey: GcpStepKey,
  tab: DetailTab,
): InstallResourceRow[] =>
  rows.filter((row) => {
    const status = row.source[stepKey].status;
    if (isSkippedStepStatus(status)) return false;
    if (tab === 'all') return true;
    if (tab === 'done') return isCompletedStepStatus(status);
    return isActionableStepStatus(status);
  });

export const countDetailTabs = (
  rows: InstallResourceRow[],
  stepKey: GcpStepKey,
): Record<DetailTab, number> => ({
  all: filterRowsByDetailTab(rows, stepKey, 'all').length,
  done: filterRowsByDetailTab(rows, stepKey, 'done').length,
  running: filterRowsByDetailTab(rows, stepKey, 'running').length,
});
