'use client';

import type { ReactNode } from 'react';
import { ProcessStatus, type CloudTargetSource } from '@/lib/types';
import type { ProjectIdentity } from '@/app/integration/target-sources/[targetSourceId]/_components/common';
import { InstallingStep } from '@/app/integration/target-sources/[targetSourceId]/_components/layout/InstallingStep';
import { ConnectionTestStep } from '@/app/integration/target-sources/[targetSourceId]/_components/layout/ConnectionTestStep';
import { WaitingTargetConfirmationStep } from '@/app/integration/target-sources/[targetSourceId]/_components/layout/WaitingTargetConfirmationStep';
import { WaitingApprovalStep } from '@/app/integration/target-sources/[targetSourceId]/_components/layout/WaitingApprovalStep';
import { ApplyingApprovedStep } from '@/app/integration/target-sources/[targetSourceId]/_components/layout/ApplyingApprovedStep';

interface CloudTargetSourceLayoutProps {
  project: CloudTargetSource;
  identity: ProjectIdentity;
  providerLabel: string;
  action: ReactNode;
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
    case ProcessStatus.CONNECTION_VERIFIED:
    case ProcessStatus.INSTALLATION_COMPLETE:
      return <ConnectionTestStep {...props} />;
    default:
      return null;
  }
};

export const CloudTargetSourceLayout = (props: CloudTargetSourceLayoutProps) => {
  const step = renderStep(props);
  if (!step) return null;
  return <main className="max-w-[1200px] mx-auto p-7 space-y-6">{step}</main>;
};
