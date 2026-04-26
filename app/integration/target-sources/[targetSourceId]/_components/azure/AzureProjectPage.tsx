'use client';

import { CloudTargetSource } from '@/lib/types';
import {
  DeleteInfrastructureButton,
  type ProjectIdentity,
} from '@/app/integration/target-sources/[targetSourceId]/_components/common';
import { CloudTargetSourceLayout } from '@/app/integration/target-sources/[targetSourceId]/_components/layout/CloudTargetSourceLayout';

interface AzureProjectPageProps {
  project: CloudTargetSource;
  onProjectUpdate: (project: CloudTargetSource) => void;
}

export const AzureProjectPage = ({
  project,
  onProjectUpdate,
}: AzureProjectPageProps) => {
  const identity: ProjectIdentity = {
    cloudProvider: 'Azure',
    monitoringMethod: 'Azure Agent',
    jiraLink: null,
    identifiers: [
      { label: 'Subscription ID', value: project.subscriptionId ?? null, mono: true },
      { label: 'Tenant ID', value: project.tenantId ?? null, mono: true },
    ],
  };

  return (
    <CloudTargetSourceLayout
      project={project}
      identity={identity}
      providerLabel="Azure Infrastructure"
      action={<DeleteInfrastructureButton />}
      onProjectUpdate={onProjectUpdate}
    />
  );
};
