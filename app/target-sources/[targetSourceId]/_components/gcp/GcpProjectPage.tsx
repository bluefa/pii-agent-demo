'use client';

import { CloudTargetSource } from '@/lib/types';
import { type ProjectIdentity } from '@/app/target-sources/[targetSourceId]/_components/common';
import { CloudTargetSourceLayout } from '@/app/target-sources/[targetSourceId]/_components/layout/CloudTargetSourceLayout';

interface GcpProjectPageProps {
  project: CloudTargetSource;
  onProjectUpdate: (project: CloudTargetSource) => void;
  /** Guide band (가이드/진행 내역) rendered under the page header (ProjectDetail). */
  guideSlot?: React.ReactNode;
}

export const GcpProjectPage = ({
  project,
  onProjectUpdate,
  guideSlot,
}: GcpProjectPageProps) => {
  const identity: ProjectIdentity = {
    cloudProvider: 'GCP',
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
      guideSlot={guideSlot}
    />
  );
};
