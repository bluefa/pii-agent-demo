'use client';

import { useCallback, type ReactNode } from 'react';
import type { CloudTargetSource } from '@/lib/types';
import { getProject } from '@/app/lib/api';
import { ProcessStatusCard } from '@/app/components/features/ProcessStatusCard';
import {
  ProjectPageMeta,
  RejectionAlert,
  type ProjectIdentity,
} from '@/app/target-sources/[targetSourceId]/_components/common';
import { CandidateResourceSection } from '@/app/target-sources/[targetSourceId]/_components/candidate';

interface WaitingTargetConfirmationStepProps {
  project: CloudTargetSource;
  identity: ProjectIdentity;
  providerLabel: string;
  action: ReactNode;
  onProjectUpdate: (project: CloudTargetSource) => void;
}

export const WaitingTargetConfirmationStep = ({
  project,
  identity,
  providerLabel,
  action,
  onProjectUpdate,
}: WaitingTargetConfirmationStepProps) => {

  const refreshProject = useCallback(async () => {
    const updated = await getProject(project.targetSourceId);
    onProjectUpdate(updated);
  }, [onProjectUpdate, project.targetSourceId]);

  return (
    <>
      <ProjectPageMeta
        project={project}
        providerLabel={providerLabel}
        identity={identity}
        action={action}
      />
      <ProcessStatusCard project={project} />
      <CandidateResourceSection
        targetSourceId={project.targetSourceId}
        readonly={false}
        refreshProject={refreshProject}
      />
      <RejectionAlert project={project} />
    </>
  );
};
