'use client';

import { CloudTargetSource } from '@/lib/types';
import { type ProjectIdentity } from '@/app/target-sources/[targetSourceId]/_components/common';
import { CloudTargetSourceLayout } from '@/app/target-sources/[targetSourceId]/_components/layout/CloudTargetSourceLayout';

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
    jiraLink: null,
    identifiers: [
      // v16 identity bar carries only Subscription ID (HTML 5778-5786 / setProvider meta
      // HTML 9426). Tenant ID lives solely in the credential-registration modal (f1, HTML 8895).
      { label: 'Subscription ID', value: project.subscriptionId ?? null, mono: true },
    ],
  };

  return (
    <CloudTargetSourceLayout
      project={project}
      identity={identity}
      providerLabel="Azure Infrastructure"
      onProjectUpdate={onProjectUpdate}
    />
  );
};
