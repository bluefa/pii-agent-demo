'use client';

import type { ReactNode } from 'react';
import type { CloudTargetSource } from '@/lib/types';
import { ProcessStatusCard } from '@/app/components/features/ProcessStatusCard';
import { ApprovalApplyingBanner } from '@/app/components/features/process-status/ApprovalApplyingBanner';
import { GuideCardContainer } from '@/app/components/features/process-status/GuideCard/GuideCardContainer';
import { resolveStepSlot } from '@/app/components/features/process-status/GuideCard/resolve-step-slot';
import {
  ProjectPageMeta,
  RejectionAlert,
  type ProjectIdentity,
} from '@/app/integration/target-sources/[targetSourceId]/_components/common';
import { ApprovedIntegrationSection } from '@/app/integration/target-sources/[targetSourceId]/_components/approved';

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
    project.awsInstallationMode,
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
      <div data-testid="approval-applying">
        <ApprovalApplyingBanner targetSourceId={project.targetSourceId} />
      </div>
      {slotKey && <GuideCardContainer slotKey={slotKey} />}
      <ApprovedIntegrationSection targetSourceId={project.targetSourceId} />
      <RejectionAlert project={project} />
    </>
  );
};
