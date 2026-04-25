'use client';

import type { CloudTargetSource } from '@/lib/types';
import { AzureInstallationStatus } from '@/app/integration/target-sources/[targetSourceId]/_components/azure/AzureInstallationStatus';

interface InstallationStatusSlotProps {
  project: CloudTargetSource;
  refreshProject: () => void;
}

export const InstallationStatusSlot = ({
  project,
  refreshProject,
}: InstallationStatusSlotProps) => {
  const inner = (() => {
    switch (project.cloudProvider) {
      case 'Azure':
        return (
          <AzureInstallationStatus
            targetSourceId={project.targetSourceId}
            refreshProject={refreshProject}
          />
        );
      case 'AWS':
      case 'GCP':
        return null;
    }
  })();

  return <div data-testid="installation-status">{inner}</div>;
};
