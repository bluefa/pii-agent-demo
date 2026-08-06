'use client';

import type { CloudTargetSource } from '@/lib/types';
import { CloudInstallingStep } from '@/app/target-sources/[targetSourceId]/_components/layout/CloudInstallingStep';

interface InstallingStepProps {
  project: CloudTargetSource;
  onProjectUpdate: (project: CloudTargetSource) => void;
}

export const InstallingStep = (props: InstallingStepProps) => {
  return <CloudInstallingStep {...props} />;
};
