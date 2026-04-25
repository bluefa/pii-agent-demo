'use client';

import { AwsInstallationInline } from '@/app/components/features/process-status/aws/AwsInstallationInline';

interface AwsInstallationStatusProps {
  targetSourceId: number;
  refreshProject: () => void;
}

export const AwsInstallationStatus = ({
  targetSourceId,
  refreshProject,
}: AwsInstallationStatusProps) => (
  <AwsInstallationInline
    targetSourceId={targetSourceId}
    onInstallComplete={refreshProject}
  />
);
