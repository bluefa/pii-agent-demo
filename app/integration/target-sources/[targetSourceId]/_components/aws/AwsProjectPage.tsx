'use client';

import { CloudTargetSource } from '@/lib/types';
import {
  DeleteInfrastructureButton,
  ProjectPageMeta,
  type ProjectIdentity,
} from '@/app/integration/target-sources/[targetSourceId]/_components/common';
import { CloudTargetSourceLayout } from '@/app/integration/target-sources/[targetSourceId]/_components/layout/CloudTargetSourceLayout';

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
    monitoringMethod: 'AWS Agent',
    jiraLink: null,
    identifiers: [
      { label: 'Account ID', value: project.awsAccountId ?? null, mono: true },
    ],
  };

  return (
    <CloudTargetSourceLayout
      project={project}
      identity={identity}
      providerLabel="AWS Infrastructure"
      action={<DeleteInfrastructureButton />}
      onProjectUpdate={onProjectUpdate}
    />
  );
};
