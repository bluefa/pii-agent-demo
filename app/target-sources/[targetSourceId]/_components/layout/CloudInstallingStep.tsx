'use client';

import { useCallback } from 'react';
import type { CloudTargetSource } from '@/lib/types';
import { getProject } from '@/app/lib/api';
import {
  RejectionAlert,
} from '@/app/target-sources/[targetSourceId]/_components/common';
import { ConfirmedIntegrationDataProvider } from '@/app/target-sources/[targetSourceId]/_components/data/ConfirmedIntegrationDataProvider';
import { InstallationStatusSlot } from '@/app/target-sources/[targetSourceId]/_components/layout/InstallationStatusSlot';

interface CloudInstallingStepProps {
  project: CloudTargetSource;
  onProjectUpdate: (project: CloudTargetSource) => void;
}

export const CloudInstallingStep = ({
  project,
  onProjectUpdate,
}: CloudInstallingStepProps) => {

  const refreshProject = useCallback(async () => {
    const updated = await getProject(project.targetSourceId);
    onProjectUpdate(updated);
  }, [onProjectUpdate, project.targetSourceId]);

  return (
    <ConfirmedIntegrationDataProvider targetSourceId={project.targetSourceId}>
      <InstallationStatusSlot project={project} refreshProject={refreshProject} />
      <RejectionAlert project={project} />
    </ConfirmedIntegrationDataProvider>
  );
};
