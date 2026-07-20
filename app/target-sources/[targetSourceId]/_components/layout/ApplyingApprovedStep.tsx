'use client';

import type { ReactNode } from 'react';
import type { CloudTargetSource } from '@/lib/types';
import {
  ProjectPageMeta,
  RejectionAlert,
  type ProjectIdentity,
} from '@/app/target-sources/[targetSourceId]/_components/common';
import { ApplyingApprovedCard } from '@/app/target-sources/[targetSourceId]/_components/layout/ApplyingApprovedCard';

interface ApplyingApprovedStepProps {
  project: CloudTargetSource;
  identity: ProjectIdentity;
  providerLabel: string;
  action: ReactNode;
  onProjectUpdate: (project: CloudTargetSource) => void;
}

export const ApplyingApprovedStep = ({
  project,
  identity,
  providerLabel,
  action,
}: ApplyingApprovedStepProps) => {

  return (
    <>
      <ProjectPageMeta
        project={project}
        providerLabel={providerLabel}
        identity={identity}
        action={action}
      />
      <ApplyingApprovedCard targetSourceId={project.targetSourceId} />
      <RejectionAlert project={project} />
    </>
  );
};
