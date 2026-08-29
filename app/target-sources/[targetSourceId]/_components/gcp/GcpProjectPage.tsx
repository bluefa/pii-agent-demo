'use client';

import { CloudTargetSource } from '@/lib/types';
import {
  widenLongValues,
  type ProjectIdentity,
} from '@/app/target-sources/[targetSourceId]/_components/common';
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
    // A GCP project id is short today, so this widens nothing — it is wired anyway
    // (오너 2026-08-29) because the contract puts no maximum on the id, and the one
    // provider left out of the rule is the one that clips.
    identifiers: widenLongValues([
      // v16 id label is the bare 'Project ID' (gcp.idLabel, HTML 9427) — no provider prefix.
      { label: 'Project ID', value: project.gcpProjectId ?? null, mono: true },
    ]),
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
