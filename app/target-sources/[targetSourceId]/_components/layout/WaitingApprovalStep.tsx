'use client';

import { useCallback, type ReactNode } from 'react';
import type { CloudTargetSource } from '@/lib/types';
import { getProject } from '@/app/lib/api';
import {
  ProjectPageMeta,
  RejectionAlert,
  type ProjectIdentity,
} from '@/app/target-sources/[targetSourceId]/_components/common';
import { WaitingApprovalCard } from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalCard';
import { WaitingApprovalCancelButton } from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalCancelButton';

interface WaitingApprovalStepProps {
  project: CloudTargetSource;
  identity: ProjectIdentity;
  providerLabel: string;
  action?: ReactNode;
  onProjectUpdate: (project: CloudTargetSource) => void;
}

export const WaitingApprovalStep = ({
  project,
  identity,
  providerLabel,
  action,
  onProjectUpdate,
}: WaitingApprovalStepProps) => {

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
      <WaitingApprovalCard
        targetSourceId={project.targetSourceId}
        onReselected={refreshProject}
        cancelSlot={
          project.isRejected ? null : (
            <WaitingApprovalCancelButton
              targetSourceId={project.targetSourceId}
              onSuccess={refreshProject}
            />
          )
        }
      />
      <RejectionAlert project={project} />
    </>
  );
};
