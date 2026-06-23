'use client';

import { AwsInstallationInline } from '@/app/components/features/process-status/aws/AwsInstallationInline';
import type { AwsInstallationMode } from '@/lib/types';

interface AwsInstallationStatusProps {
  targetSourceId: number;
  mode: AwsInstallationMode;
  refreshProject: () => void;
}

export const AwsInstallationStatus = ({
  targetSourceId,
  mode,
  refreshProject,
}: AwsInstallationStatusProps) => (
  <AwsInstallationInline
    targetSourceId={targetSourceId}
    mode={mode}
    onInstallComplete={refreshProject}
  />
);
