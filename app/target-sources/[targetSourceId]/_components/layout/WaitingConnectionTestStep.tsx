'use client';

import { useCallback } from 'react';
import type { CloudTargetSource } from '@/lib/types';
import { getProject } from '@/app/lib/api';
import {
  RejectionAlert,
} from '@/app/target-sources/[targetSourceId]/_components/common';
import {
  ConfirmedIntegrationDataProvider,
  useConfirmedIntegration,
} from '@/app/target-sources/[targetSourceId]/_components/data/ConfirmedIntegrationDataProvider';
import { ConnectionTestCard } from '@/app/target-sources/[targetSourceId]/_components/layout/ConnectionTestCard';
import { ErrorRow, ResourceTableSkeleton } from '@/app/target-sources/[targetSourceId]/_components/shared/async-state-views';
import {
  useTestConnectionPolling,
  type UseTestConnectionPollingReturn,
} from '@/app/hooks/useTestConnectionPolling';

interface WaitingConnectionTestStepProps {
  project: CloudTargetSource;
  providerLabel: string;
  onProjectUpdate: (project: CloudTargetSource) => void;
}

// Reads the shared confirmed-integration context — must render inside the provider.
const ConnectionTestSection = ({
  providerLabel,
  refreshProject,
  polling,
}: {
  providerLabel: string;
  refreshProject: () => void;
  polling: UseTestConnectionPollingReturn;
}) => {
  const { targetSourceId, state, retry } = useConfirmedIntegration();
  if (state.status === 'loading') return <ResourceTableSkeleton />;
  if (state.status === 'error') return <ErrorRow message={state.message} onRetry={retry} />;
  return (
    <ConnectionTestCard
      targetSourceId={targetSourceId}
      confirmed={state.data}
      providerLabel={providerLabel}
      refreshProject={refreshProject}
      polling={polling}
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
  providerLabel,
  onProjectUpdate,
}: WaitingConnectionTestStepProps) => {

  const refreshProject = useCallback(async () => {
    const updated = await getProject(project.targetSourceId);
    onProjectUpdate(updated);
  }, [onProjectUpdate, project.targetSourceId]);

  // The step still owns the polling for its card. The header's TcHeaderTag is
  // rendered by the layout now and self-fetches latest_version instead — the
  // live feed no longer reaches the header tag while a run is in flight
  // (known downgrade, recorded in docs/ux/benchmark/target-source-header.md).
  const polling = useTestConnectionPolling(project.targetSourceId);

  return (
    <ConfirmedIntegrationDataProvider targetSourceId={project.targetSourceId}>
      <ConnectionTestSection
        providerLabel={providerLabel}
        refreshProject={refreshProject}
        polling={polling}
      />
      <RejectionAlert project={project} />
    </ConfirmedIntegrationDataProvider>
  );
};
