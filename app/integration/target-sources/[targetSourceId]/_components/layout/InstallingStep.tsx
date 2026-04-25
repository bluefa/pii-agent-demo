'use client';

import type { ReactNode } from 'react';
import type { CloudTargetSource } from '@/lib/types';
import type { ProjectIdentity } from '@/app/integration/target-sources/[targetSourceId]/_components/common';
import { CloudInstallingStep } from '@/app/integration/target-sources/[targetSourceId]/_components/layout/CloudInstallingStep';

interface InstallingStepProps {
  project: CloudTargetSource;
  identity: ProjectIdentity;
  providerLabel: string;
  action: ReactNode;
  onProjectUpdate: (project: CloudTargetSource) => void;
}

export const InstallingStep = (props: InstallingStepProps) => {
  return <CloudInstallingStep {...props} />;
};
