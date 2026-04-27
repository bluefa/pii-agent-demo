'use client';

import { useCallback, type ReactNode } from 'react';
import type { CloudTargetSource } from '@/lib/types';
import { getProject } from '@/app/lib/api';
import { ProcessStatusCard } from '@/app/components/features/ProcessStatusCard';
import { resolveStepSlot } from '@/app/components/features/process-status/GuideCard/resolve-step-slot';
import {
  ProjectPageMeta,
  RejectionAlert,
  type ProjectIdentity,
} from '@/app/integration/target-sources/[targetSourceId]/_components/common';
import { ConfirmedIntegrationDataProvider } from '@/app/integration/target-sources/[targetSourceId]/_components/data/ConfirmedIntegrationDataProvider';
import { ConfirmedResourcesSlot } from '@/app/integration/target-sources/[targetSourceId]/_components/layout/ConfirmedResourcesSlot';
import { ConnectionTestSlot } from '@/app/integration/target-sources/[targetSourceId]/_components/layout/ConnectionTestSlot';

interface ConnectionTestStepProps {
  project: CloudTargetSource;
  identity: ProjectIdentity;
  providerLabel: string;
  action: ReactNode;
  onProjectUpdate: (project: CloudTargetSource) => void;
}

export const ConnectionTestStep = ({
  project,
  identity,
  providerLabel,
  action,
  onProjectUpdate,
}: ConnectionTestStepProps) => {
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
    <ConfirmedIntegrationDataProvider targetSourceId={project.targetSourceId}>
      <ProjectPageMeta
        project={project}
        providerLabel={providerLabel}
        identity={identity}
        action={action}
      />
      <ProcessStatusCard project={project} onProjectUpdate={onProjectUpdate} />
      <ConfirmedResourcesSlot />
      <ConnectionTestSlot
        targetSourceId={project.targetSourceId}
        refreshProject={refreshProject}
      />
      <RejectionAlert project={project} />
    </ConfirmedIntegrationDataProvider>
  );
};
