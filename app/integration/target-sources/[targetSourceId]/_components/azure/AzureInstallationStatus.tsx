'use client';

import { AzureInstallationInline } from '@/app/components/features/process-status/azure/AzureInstallationInline';
import { useConfirmedIntegration } from '@/app/integration/target-sources/[targetSourceId]/_components/data/ConfirmedIntegrationDataProvider';

interface AzureInstallationStatusProps {
  targetSourceId: number;
  refreshProject: () => void;
}

export const AzureInstallationStatus = ({
  targetSourceId,
  refreshProject,
}: AzureInstallationStatusProps) => {
  const { state } = useConfirmedIntegration();

  if (state.status !== 'ready') return null;

  return (
    <AzureInstallationInline
      targetSourceId={targetSourceId}
      confirmed={state.data}
      onInstallComplete={refreshProject}
    />
  );
};
