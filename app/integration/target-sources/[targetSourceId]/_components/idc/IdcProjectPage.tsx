'use client';

import type { CloudTargetSource } from '@/lib/types';
import {
  DeleteInfrastructureButton,
  type ProjectIdentity,
} from '@/app/integration/target-sources/[targetSourceId]/_components/common';
import { IdcTargetSourceLayout } from '@/app/integration/target-sources/[targetSourceId]/_components/idc/IdcTargetSourceLayout';

interface IdcProjectPageProps {
  project: CloudTargetSource;
  onProjectUpdate: (project: CloudTargetSource) => void;
}

export const IdcProjectPage = ({ project, onProjectUpdate }: IdcProjectPageProps) => {
  // IDC identity is intentionally minimal (결정 #49): name + Agent chip only,
  // no Datacenter ID / cloud-account identifiers.
  const identity: ProjectIdentity = {
    cloudProvider: 'IDC',
    monitoringMethod: 'IDC Agent',
    jiraLink: null,
    identifiers: [],
  };

  return (
    <IdcTargetSourceLayout
      project={project}
      identity={identity}
      providerLabel="IDC Infrastructure"
      action={<DeleteInfrastructureButton />}
      onProjectUpdate={onProjectUpdate}
    />
  );
};
