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
      // 「GCP Project ID」 (오너 2026-08-29), replacing the bare 'Project ID' the v16 mockup
      // used. It is the grid's only cell, so it renders label-beside-value and the longer
      // label costs no height.
      //
      // 📝 For the record: the ops console names this same field 「프로젝트」 in Korean
      // (`OpsHeader`), so the two screens now differ on this one label. That is the
      // owner's spelling, not an oversight — 「프로젝트 ID」 is the one-word change if it
      // is ever revisited.
      { label: 'GCP Project ID', value: project.gcpProjectId ?? null, mono: true },
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
