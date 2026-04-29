'use client';

import type { ReactNode } from 'react';
import type { CloudTargetSource } from '@/lib/types';
import { ProcessStatusCard } from '@/app/components/features/ProcessStatusCard';
import {
  ProjectPageMeta,
  RejectionAlert,
  type ProjectIdentity,
} from '@/app/integration/target-sources/[targetSourceId]/_components/common';
import { WaitingApprovalCard } from '@/app/integration/target-sources/[targetSourceId]/_components/layout/WaitingApprovalCard';

interface WaitingApprovalStepProps {
  project: CloudTargetSource;
  identity: ProjectIdentity;
  providerLabel: string;
  action: ReactNode;
  onProjectUpdate: (project: CloudTargetSource) => void;
}

export const WaitingApprovalStep = ({
  project,
  identity,
  providerLabel,
  action,
  onProjectUpdate,
}: WaitingApprovalStepProps) => {
  return (
    <>
      <ProjectPageMeta
        project={project}
        providerLabel={providerLabel}
        identity={identity}
        action={action}
      />
      <ProcessStatusCard project={project} onProjectUpdate={onProjectUpdate} />
      <WaitingApprovalCard targetSourceId={project.targetSourceId} />
      <RejectionAlert project={project} />
    </>
  );
};
