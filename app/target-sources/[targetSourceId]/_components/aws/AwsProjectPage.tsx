'use client';

import { CloudTargetSource } from '@/lib/types';
import { type ProjectIdentity } from '@/app/target-sources/[targetSourceId]/_components/common';
import { CloudTargetSourceLayout } from '@/app/target-sources/[targetSourceId]/_components/layout/CloudTargetSourceLayout';

interface AwsProjectPageProps {
  project: CloudTargetSource;
  onProjectUpdate: (project: CloudTargetSource) => void;
}

export const AwsProjectPage = ({
  project,
  onProjectUpdate,
}: AwsProjectPageProps) => {
  const identity: ProjectIdentity = {
    cloudProvider: 'AWS',
    identifiers: [
      { label: 'Account ID', value: project.awsAccountId ?? null, mono: true },
    ],
    // metadata.grant_service_terraform_execution_permission → 설치 모드. The
    // header renders it as the InstallModeModal vocabulary (자동/수동 설치) —
    // "TF 실행 권한" was internal jargon, not a user-facing name.
    installMode:
      project.isTerraformExecutionGranted === undefined
        ? undefined
        : project.isTerraformExecutionGranted
          ? 'auto'
          : 'manual',
  };

  return (
    <CloudTargetSourceLayout
      project={project}
      identity={identity}
      providerLabel="AWS Infrastructure"
      onProjectUpdate={onProjectUpdate}
    />
  );
};
