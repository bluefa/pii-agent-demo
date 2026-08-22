'use client';

import type { ReactNode } from 'react';
import { ProcessStatus, type CloudTargetSource } from '@/lib/types';
import {
  ProjectPageMeta,
  type ProjectIdentity,
} from '@/app/target-sources/[targetSourceId]/_components/common';
import { InstallingStep } from '@/app/target-sources/[targetSourceId]/_components/layout/InstallingStep';
import { WaitingConnectionTestStep } from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingConnectionTestStep';
import { ConnectionVerifiedStep } from '@/app/target-sources/[targetSourceId]/_components/layout/ConnectionVerifiedStep';
import { InstallationCompleteStep } from '@/app/target-sources/[targetSourceId]/_components/layout/InstallationCompleteStep';
import { WaitingTargetConfirmationStep } from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingTargetConfirmationStep';
import { WaitingApprovalStep } from '@/app/target-sources/[targetSourceId]/_components/layout/WaitingApprovalStep';
import { ApplyingApprovedStep } from '@/app/target-sources/[targetSourceId]/_components/layout/ApplyingApprovedStep';

interface CloudTargetSourceLayoutProps {
  project: CloudTargetSource;
  identity: ProjectIdentity;
  providerLabel: string;
  /** Optional page-header action slot (none by default — destructive actions live in the guide rail). */
  action?: ReactNode;
  onProjectUpdate: (project: CloudTargetSource) => void;
}

const renderStep = (props: CloudTargetSourceLayoutProps): ReactNode => {
  switch (props.project.processStatus) {
    case ProcessStatus.WAITING_TARGET_CONFIRMATION:
      return <WaitingTargetConfirmationStep {...props} />;
    case ProcessStatus.WAITING_APPROVAL:
      return <WaitingApprovalStep {...props} />;
    case ProcessStatus.APPLYING_APPROVED:
      return <ApplyingApprovedStep {...props} />;
    case ProcessStatus.INSTALLING:
      return <InstallingStep {...props} />;
    case ProcessStatus.WAITING_CONNECTION_TEST:
      return <WaitingConnectionTestStep {...props} />;
    case ProcessStatus.CONNECTION_VERIFIED:
      return <ConnectionVerifiedStep {...props} />;
    case ProcessStatus.INSTALLATION_COMPLETE:
      return <InstallationCompleteStep {...props} />;
    default:
      return null;
  }
};

export const CloudTargetSourceLayout = (props: CloudTargetSourceLayoutProps) => {
  const step = renderStep(props);
  if (!step) return null;
  return (
    // `min-h-full`, not `min-h-screen` (#665): this fills ProjectDetail's fixed
    // `100vh - 64px` column — a full 100vh here left 64px of dead scroll under
    // every page.
    <main className="min-h-full">
      {/* Flat page header (chrome) spans the column edge-to-edge ABOVE the padded
          body, so the lavender wash starts where content cards do. The layout owns
          it — steps render cards only, matching IdcTargetSourceLayout. */}
      <ProjectPageMeta project={props.project} identity={props.identity} action={props.action} />
      {/* v16 `.main`: full-width, padding 32/20/80 (top/x/bottom) — matches
          IdcTargetSourceLayout. The gutter was v16's 40px until 오너 13차 지시 took both
          target-source layouts to 20px. `projectHeaderStyles.inner` carries the same 20
          plus the step card's own 28px keyline, so the header's type stands on the
          cards' type — change one without the other and the header's left edge drifts.
          The step guide lives in the full-height right rail (GuidePanel, ProjectDetail). */}
      <div className="px-5 pt-8 pb-20 space-y-6">{step}</div>
    </main>
  );
};
