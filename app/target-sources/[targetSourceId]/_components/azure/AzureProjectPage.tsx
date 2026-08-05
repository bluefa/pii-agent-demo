'use client';

import { CloudTargetSource } from '@/lib/types';
import { type ProjectIdentity } from '@/app/target-sources/[targetSourceId]/_components/common';
import { CloudTargetSourceLayout } from '@/app/target-sources/[targetSourceId]/_components/layout/CloudTargetSourceLayout';

interface AzureProjectPageProps {
  project: CloudTargetSource;
  onProjectUpdate: (project: CloudTargetSource) => void;
  /** Guide band (가이드/진행 내역) rendered under the page header (ProjectDetail). */
  guideSlot?: React.ReactNode;
}

export const AzureProjectPage = ({
  project,
  onProjectUpdate,
  guideSlot,
}: AzureProjectPageProps) => {
  const identity: ProjectIdentity = {
    cloudProvider: 'Azure',
    identifiers: [
      { label: 'Subscription ID', value: project.subscriptionId ?? null, mono: true },
      // tenant_id is a declared TargetSourceMetadata field the normalizer already
      // maps — the old "credential modal only" placement was a v16 display call,
      // not a contract limit, so the header shows it beside the subscription.
      { label: 'Tenant ID', value: project.tenantId ?? null, mono: true },
    ],
  };

  return (
    <CloudTargetSourceLayout
      project={project}
      identity={identity}
      providerLabel="Azure Infrastructure"
      onProjectUpdate={onProjectUpdate}
      guideSlot={guideSlot}
    />
  );
};
