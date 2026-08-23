'use client';

import { useCallback } from 'react';
import type { CloudTargetSource } from '@/lib/types';
import { getProject } from '@/app/lib/api';
import {
  RejectionAlert,
} from '@/app/target-sources/[targetSourceId]/_components/common';
import { CandidateResourceSection } from '@/app/target-sources/[targetSourceId]/_components/candidate';

interface WaitingTargetConfirmationStepProps {
  project: CloudTargetSource;
  onProjectUpdate: (project: CloudTargetSource) => void;
}

export const WaitingTargetConfirmationStep = ({
  project,
  onProjectUpdate,
}: WaitingTargetConfirmationStepProps) => {

  const refreshProject = useCallback(async () => {
    const updated = await getProject(project.targetSourceId);
    onProjectUpdate(updated);
  }, [onProjectUpdate, project.targetSourceId]);

  return (
    <>
      <CandidateResourceSection
        targetSourceId={project.targetSourceId}
        provider={project.cloudProvider}
        scanPrincipal={project.scanPrincipal}
        readonly={false}
        refreshProject={refreshProject}
      />
      <RejectionAlert project={project} />
    </>
  );
};
