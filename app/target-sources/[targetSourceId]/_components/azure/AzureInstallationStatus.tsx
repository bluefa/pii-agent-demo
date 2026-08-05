'use client';

import { AzureInstallationInline } from '@/app/components/features/process-status/azure/AzureInstallationInline';
import { useConfirmedIntegration } from '@/app/target-sources/[targetSourceId]/_components/data/ConfirmedIntegrationDataProvider';
import type { ConfirmedResource } from '@/lib/types/resources';

interface AzureInstallationStatusProps {
  targetSourceId: number;
  refreshProject: () => void;
}

const NO_CONFIRMED: readonly ConfirmedResource[] = [];

export const AzureInstallationStatus = ({
  targetSourceId,
  refreshProject,
}: AzureInstallationStatusProps) => {
  const { state } = useConfirmedIntegration();

  // Allowlist, not `!== 'error'` — a future AsyncState member must opt IN to
  // rendering, not silently inherit the settled branch with an empty meta.
  // Mount while 확정 연동 is still loading so the card shows its skeleton (and
  // starts the installation-status fetch in parallel) instead of rendering
  // nothing; meta fills in once the confirmed rows land.
  if (state.status === 'loading') {
    return (
      <AzureInstallationInline
        targetSourceId={targetSourceId}
        confirmed={NO_CONFIRMED}
        confirmedLoading
        onInstallComplete={refreshProject}
      />
    );
  }

  if (state.status === 'ready') {
    return (
      <AzureInstallationInline
        targetSourceId={targetSourceId}
        confirmed={state.data}
        onInstallComplete={refreshProject}
      />
    );
  }

  return null;
};
