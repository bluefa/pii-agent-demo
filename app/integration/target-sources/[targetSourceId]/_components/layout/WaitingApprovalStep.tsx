'use client';

import { useCallback, type ReactNode } from 'react';
import type { CloudTargetSource } from '@/lib/types';
import { getProject } from '@/app/lib/api';
import { ProcessStatusCard } from '@/app/components/features/ProcessStatusCard';
import { ApprovalWaitingCard } from '@/app/components/features/process-status/ApprovalWaitingCard';
import { GuideCardContainer } from '@/app/components/features/process-status/GuideCard/GuideCardContainer';
import { resolveStepSlot } from '@/app/components/features/process-status/GuideCard/resolve-step-slot';
import {
  ProjectPageMeta,
  RejectionAlert,
  type ProjectIdentity,
} from '@/app/integration/target-sources/[targetSourceId]/_components/common';
import { CandidateResourceSection } from '@/app/integration/target-sources/[targetSourceId]/_components/candidate';

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
    project.processStatus,
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
      {!project.isRejected && (
        <div data-testid="approval-waiting">
          <ApprovalWaitingCard
            targetSourceId={project.targetSourceId}
            onCancelSuccess={refreshProject}
          />
        </div>
      )}
      {slotKey && <GuideCardContainer slotKey={slotKey} />}
      <CandidateResourceSection
        targetSourceId={project.targetSourceId}
        readonly
        refreshProject={refreshProject}
      />
      <RejectionAlert project={project} />
    </>
  );
};
