'use client';

import type { CloudTargetSource } from '@/lib/types';
import { type ProjectIdentity } from '@/app/target-sources/[targetSourceId]/_components/common';
import { SduTargetSourceLayout } from '@/app/target-sources/[targetSourceId]/_components/sdu/SduTargetSourceLayout';

interface SduProjectPageProps {
  project: CloudTargetSource;
  onProjectUpdate: (project: CloudTargetSource) => void;
}

/**
 * The owner-facing page for a Self Data Upload target source.
 *
 * Identity is deliberately empty, the same call IDC made (결정 #49) and for a stronger
 * reason: an SDU target still HAS an underlying CSP, but nothing about that account is
 * ours to install into — the owner uploads the data themselves — so an account id on this
 * header would name a thing no step on this page acts on. `cloudProvider` is passed
 * through unchanged rather than being forced to some SDU value, because SDU is not a
 * `CloudProvider` (lib/types/sdu.ts); `ProjectPageMeta` already reads `isSduType` and
 * draws the SDU mark and name off that, so the field never reaches the screen.
 */
export const SduProjectPage = ({ project, onProjectUpdate }: SduProjectPageProps) => {
  const identity: ProjectIdentity = {
    cloudProvider: project.cloudProvider,
    identifiers: [],
  };

  return (
    <SduTargetSourceLayout
      project={project}
      identity={identity}
      onProjectUpdate={onProjectUpdate}
    />
  );
};
