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

  if (state.status === 'error') return null;

  // Mount while 확정 연동 is still loading so the card shows its skeleton (and
  // starts the installation-status fetch in parallel) instead of rendering
  // nothing; meta fills in once the confirmed rows land.
  return (
    <AzureInstallationInline
      targetSourceId={targetSourceId}
      confirmed={state.status === 'ready' ? state.data : NO_CONFIRMED}
      confirmedLoading={state.status === 'loading'}
      onInstallComplete={refreshProject}
    />
  );
};
