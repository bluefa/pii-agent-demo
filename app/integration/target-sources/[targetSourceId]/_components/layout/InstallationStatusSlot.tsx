'use client';

import type { CloudTargetSource } from '@/lib/types';
import { AwsInstallationStatus } from '@/app/integration/target-sources/[targetSourceId]/_components/aws/AwsInstallationStatus';
import { AzureInstallationStatus } from '@/app/integration/target-sources/[targetSourceId]/_components/azure/AzureInstallationStatus';
import { GcpInstallationStatus } from '@/app/integration/target-sources/[targetSourceId]/_components/gcp/GcpInstallationStatus';

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
      case 'AWS':
        return (
          <AwsInstallationStatus
            targetSourceId={project.targetSourceId}
            refreshProject={refreshProject}
          />
        );
      case 'Azure':
        return (
          <AzureInstallationStatus
            targetSourceId={project.targetSourceId}
            refreshProject={refreshProject}
          />
        );
      case 'GCP':
        return (
          <GcpInstallationStatus
            targetSourceId={project.targetSourceId}
            refreshProject={refreshProject}
          />
        );
    }
  })();

  return <div data-testid="installation-status">{inner}</div>;
};
