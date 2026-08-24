'use client';

import { AwsInstallationInline } from '@/app/components/features/process-status/aws/AwsInstallationInline';

interface AwsInstallationStatusProps {
  targetSourceId: number;
  /** metadata.grant_service_terraform_execution_permission — false ⇒ manual install. */
  terraformExecutionGranted?: boolean;
  /** metadata.aws_account_id. */
  awsAccountId?: string;
  refreshProject: () => void;
}

export const AwsInstallationStatus = ({
  targetSourceId,
  terraformExecutionGranted,
  awsAccountId,
  refreshProject,
}: AwsInstallationStatusProps) => (
  <AwsInstallationInline
    targetSourceId={targetSourceId}
    terraformExecutionGranted={terraformExecutionGranted}
    awsAccountId={awsAccountId}
    onInstallComplete={refreshProject}
  />
);
