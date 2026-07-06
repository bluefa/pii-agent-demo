'use client';

import { AwsInstallationInline } from '@/app/components/features/process-status/aws/AwsInstallationInline';

interface AwsInstallationStatusProps {
  targetSourceId: number;
  /** metadata.grant_service_terraform_execution_permission — false ⇒ manual install. */
  terraformExecutionGranted?: boolean;
  refreshProject: () => void;
}

export const AwsInstallationStatus = ({
  targetSourceId,
  terraformExecutionGranted,
  refreshProject,
}: AwsInstallationStatusProps) => (
  <AwsInstallationInline
    targetSourceId={targetSourceId}
    terraformExecutionGranted={terraformExecutionGranted}
    onInstallComplete={refreshProject}
  />
);
