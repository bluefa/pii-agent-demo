'use client';

import { GcpInstallationInline } from '@/app/components/features/process-status/gcp/GcpInstallationInline';

interface GcpInstallationStatusProps {
  targetSourceId: number;
  refreshProject: () => void;
}

export const GcpInstallationStatus = ({
  targetSourceId,
  refreshProject,
}: GcpInstallationStatusProps) => (
  <GcpInstallationInline
    targetSourceId={targetSourceId}
    onInstallComplete={refreshProject}
  />
);
