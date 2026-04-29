import type { GcpStepKey } from '@/lib/constants/gcp';
import type { InstallResourceRow } from '@/app/components/features/process-status/install-task-pipeline/join-installation-resources';

export type DetailTab = 'all' | 'done' | 'running';

export const filterRowsByDetailTab = (
  rows: InstallResourceRow[],
  stepKey: GcpStepKey,
  tab: DetailTab,
): InstallResourceRow[] =>
  rows.filter((row) => {
    const stepStatus = row.source[stepKey].status;
    if (stepStatus === 'SKIP') return false;
    if (tab === 'all') return true;
    if (tab === 'done') return stepStatus === 'COMPLETED';
    return stepStatus === 'IN_PROGRESS' || stepStatus === 'FAIL';
  });

export const countDetailTabs = (
  rows: InstallResourceRow[],
  stepKey: GcpStepKey,
): Record<DetailTab, number> => ({
  all: filterRowsByDetailTab(rows, stepKey, 'all').length,
  done: filterRowsByDetailTab(rows, stepKey, 'done').length,
  running: filterRowsByDetailTab(rows, stepKey, 'running').length,
});
