'use client';

import type { ReactNode } from 'react';
import { ProcessStatus, type CloudTargetSource } from '@/lib/types';
import { cn } from '@/lib/theme';
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
  /** Optional page-header action slot (none by default — destructive actions live in the guide band). */
  action?: ReactNode;
  /** Guide band (가이드/진행 내역 + 모니터링·협업채널·인프라 삭제), slotted under the header. */
  guideSlot?: ReactNode;
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
    <main className={cn('bg-[#F4F4FB]', 'min-h-screen')}>
      {/* Flat page header (chrome) spans the column edge-to-edge ABOVE the padded
          body, so the lavender wash starts where content cards do. The layout owns
          it — steps render cards only, matching IdcTargetSourceLayout. */}
      <ProjectPageMeta project={props.project} identity={props.identity} action={props.action} />
      {/* Guide band — chrome strip between header and body (was the right rail). */}
      {props.guideSlot}
      {/* v16 `.main`: full-width, padding 32/40/80 (top/x/bottom), flush to the 296px
          sidebar so content begins at 336px — matches IdcTargetSourceLayout.
          The step guide lives in the full-height right rail (GuidePanel, ProjectDetail). */}
      <div className="px-10 pt-8 pb-20 space-y-6">{step}</div>
    </main>
  );
};
