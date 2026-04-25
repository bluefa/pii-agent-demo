'use client';

import type { ReactNode } from 'react';
import { ProcessStatus, type CloudTargetSource } from '@/lib/types';
import type { ProjectIdentity } from '@/app/integration/target-sources/[targetSourceId]/_components/common';
import { InstallingStep } from '@/app/integration/target-sources/[targetSourceId]/_components/layout/InstallingStep';
import { ConnectionTestStep } from '@/app/integration/target-sources/[targetSourceId]/_components/layout/ConnectionTestStep';

interface CloudTargetSourceLayoutProps {
  project: CloudTargetSource;
  identity: ProjectIdentity;
  providerLabel: string;
  action: ReactNode;
  onProjectUpdate: (project: CloudTargetSource) => void;
}

export const CloudTargetSourceLayout = (props: CloudTargetSourceLayoutProps) => {
  switch (props.project.processStatus) {
    case ProcessStatus.INSTALLING:
      return (
        <main className="max-w-[1200px] mx-auto p-7 space-y-6">
          <InstallingStep {...props} />
        </main>
      );
    case ProcessStatus.WAITING_CONNECTION_TEST:
    case ProcessStatus.CONNECTION_VERIFIED:
    case ProcessStatus.INSTALLATION_COMPLETE:
      return (
        <main className="max-w-[1200px] mx-auto p-7 space-y-6">
          <ConnectionTestStep {...props} />
        </main>
      );
    default:
      return null;
  }
};
