'use client';

import { CloudTargetSource } from '@/lib/types';
import {
  ProjectPageMeta,
  type ProjectIdentity,
} from '@/app/target-sources/[targetSourceId]/_components/common';
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
    jiraLink: null,
    identifiers: [
      { label: 'Account ID', value: project.awsAccountId ?? null, mono: true },
      // metadata.grant_service_terraform_execution_permission — always shown. The
      // permission is granted or it is not; an account we were told nothing about
      // is one nobody granted, which is 수동 설치. Blanking the row on an absent key
      // hid the mode on exactly the accounts that have it.
      {
        label: 'TF 실행 권한',
        value: project.isTerraformExecutionGranted ? '허용 · 자동 설치' : '미허용 · 수동 설치',
      },
    ],
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
