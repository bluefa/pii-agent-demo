'use client';

import { CloudTargetSource } from '@/lib/types';
import { type ProjectIdentity } from '@/app/target-sources/[targetSourceId]/_components/common';
import { CloudTargetSourceLayout } from '@/app/target-sources/[targetSourceId]/_components/layout/CloudTargetSourceLayout';

interface GcpProjectPageProps {
  project: CloudTargetSource;
  onProjectUpdate: (project: CloudTargetSource) => void;
}

export const GcpProjectPage = ({
  project,
  onProjectUpdate,
}: GcpProjectPageProps) => {
  const identity: ProjectIdentity = {
    cloudProvider: 'GCP',
    jiraLink: null,
    identifiers: [
      // v16 id label is the bare 'Project ID' (gcp.idLabel, HTML 9427) — no provider prefix.
      { label: 'Project ID', value: project.gcpProjectId ?? null, mono: true },
    ],
  };

  return (
    <CloudTargetSourceLayout
      project={project}
      identity={identity}
      providerLabel="GCP Infrastructure"
      onProjectUpdate={onProjectUpdate}
    />
  );
};
