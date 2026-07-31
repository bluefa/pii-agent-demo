'use client';

import { useCallback, type ReactNode } from 'react';
import type { CloudTargetSource } from '@/lib/types';
import { getProject } from '@/app/lib/api';
import {
  ProjectPageMeta,
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
        // Rejection is decided inside the card (approval-requests/latest), which swaps this slot
        // for its own rejected-variant button — the project payload carries no rejection state.
        cancelSlot={
          <WaitingApprovalCancelButton
            targetSourceId={project.targetSourceId}
            onSuccess={refreshProject}
          />
        }
      />
    </>
  );
};
