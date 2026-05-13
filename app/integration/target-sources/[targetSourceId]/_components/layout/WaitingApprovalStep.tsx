'use client';

import { useCallback, type ReactNode } from 'react';
import type { CloudTargetSource } from '@/lib/types';
import { ProcessStatus } from '@/lib/types';
import { getProject } from '@/app/lib/api';
import { ProcessStatusCard } from '@/app/components/features/ProcessStatusCard';
import { GuideCardContainer } from '@/app/components/features/process-status/GuideCard/GuideCardContainer';
import { resolveStepSlot } from '@/app/components/features/process-status/GuideCard/resolve-step-slot';
import {
  ProjectPageMeta,
  RejectionAlert,
  type ProjectIdentity,
} from '@/app/integration/target-sources/[targetSourceId]/_components/common';
import { WaitingApprovalCard } from '@/app/integration/target-sources/[targetSourceId]/_components/layout/WaitingApprovalCard';
import { WaitingApprovalCancelButton } from '@/app/integration/target-sources/[targetSourceId]/_components/layout/WaitingApprovalCancelButton';

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
  const slotKey = resolveStepSlot(
    project.cloudProvider,
    ProcessStatus.WAITING_APPROVAL,
    project.awsInstallationMode,
  );

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
      <ProcessStatusCard project={project} onProjectUpdate={onProjectUpdate} />
      {slotKey && <GuideCardContainer slotKey={slotKey} />}
      <WaitingApprovalCard
        targetSourceId={project.targetSourceId}
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
