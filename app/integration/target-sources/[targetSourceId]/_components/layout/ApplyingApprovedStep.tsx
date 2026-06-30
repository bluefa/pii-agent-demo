'use client';

import type { ReactNode } from 'react';
import type { CloudTargetSource } from '@/lib/types';
import { ProcessStatusCard } from '@/app/components/features/ProcessStatusCard';
import { GuideCardContainer } from '@/app/components/features/process-status/GuideCard/GuideCardContainer';
import { resolveStepSlot } from '@/app/components/features/process-status/GuideCard/resolve-step-slot';
import {
  ProjectPageMeta,
  RejectionAlert,
  type ProjectIdentity,
} from '@/app/integration/target-sources/[targetSourceId]/_components/common';
import { ApplyingApprovedCard } from '@/app/integration/target-sources/[targetSourceId]/_components/layout/ApplyingApprovedCard';

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
  onProjectUpdate,
}: ApplyingApprovedStepProps) => {
  const slotKey = resolveStepSlot(
    project.cloudProvider,
    project.processStatus,
  );

  return (
    <>
      <ProjectPageMeta
        project={project}
        providerLabel={providerLabel}
        identity={identity}
        action={action}
      />
      <ProcessStatusCard project={project} onProjectUpdate={onProjectUpdate} />
      {slotKey && <GuideCardContainer slotKey={slotKey} />}
      <ApplyingApprovedCard targetSourceId={project.targetSourceId} />
      <RejectionAlert project={project} />
    </>
  );
};
