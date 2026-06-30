'use client';

import { useCallback, type ReactNode } from 'react';
import type { CloudTargetSource } from '@/lib/types';
import { getProject } from '@/app/lib/api';
import { ProcessStatusCard } from '@/app/components/features/ProcessStatusCard';
import { GuideCardContainer } from '@/app/components/features/process-status/GuideCard/GuideCardContainer';
import { resolveStepSlot } from '@/app/components/features/process-status/GuideCard/resolve-step-slot';
import {
  ProjectPageMeta,
  RejectionAlert,
  type ProjectIdentity,
} from '@/app/integration/target-sources/[targetSourceId]/_components/common';
import {
  ConfirmedIntegrationDataProvider,
  useConfirmedIntegration,
} from '@/app/integration/target-sources/[targetSourceId]/_components/data/ConfirmedIntegrationDataProvider';
import { ConnectionTestCard } from '@/app/integration/target-sources/[targetSourceId]/_components/layout/ConnectionTestCard';
import { ErrorRow, LoadingRow } from '@/app/integration/target-sources/[targetSourceId]/_components/shared/async-state-views';

interface WaitingConnectionTestStepProps {
  project: CloudTargetSource;
  identity: ProjectIdentity;
  providerLabel: string;
  action: ReactNode;
  onProjectUpdate: (project: CloudTargetSource) => void;
}

// Reads the shared confirmed-integration context — must render inside the provider.
const ConnectionTestSection = ({
  providerLabel,
  refreshProject,
}: {
  providerLabel: string;
  refreshProject: () => void;
}) => {
  const { targetSourceId, state, retry } = useConfirmedIntegration();
  if (state.status === 'loading') return <LoadingRow message="불러오는 중..." />;
  if (state.status === 'error') return <ErrorRow message={state.message} onRetry={retry} />;
  return (
    <ConnectionTestCard
      targetSourceId={targetSourceId}
      confirmed={state.data}
      providerLabel={providerLabel}
      refreshProject={refreshProject}
    />
  );
};

/**
 * Cloud WAITING_CONNECTION_TEST step — v16 consolidates this into ONE connection-test card
 * (`data-prov-view="azure gcp aws"`, HTML 6883). The former confirmed-resources / connection-test
 * panel / logical-DB-check slots collapse into ConnectionTestCard; the ConfirmedIntegrationDataProvider
 * wrapper is preserved as the shared data source.
 */
export const WaitingConnectionTestStep = ({
  project,
  identity,
  providerLabel,
  action,
  onProjectUpdate,
}: WaitingConnectionTestStepProps) => {
  const slotKey = resolveStepSlot(
    project.cloudProvider,
    project.processStatus,
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
      {slotKey && <GuideCardContainer slotKey={slotKey} />}
      <ConnectionTestSection providerLabel={providerLabel} refreshProject={refreshProject} />
      <RejectionAlert project={project} />
    </ConfirmedIntegrationDataProvider>
  );
};
