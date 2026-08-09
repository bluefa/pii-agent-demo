'use client';

import { useCallback, type ReactNode } from 'react';
import type { CloudTargetSource } from '@/lib/types';
import { getProject } from '@/app/lib/api';
import {
  ProjectPageMeta,
  RejectionAlert,
  type ProjectIdentity,
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
  identity: ProjectIdentity;
  providerLabel: string;
  action?: ReactNode;
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
  identity,
  providerLabel,
  action,
  onProjectUpdate,
}: WaitingConnectionTestStepProps) => {

  const refreshProject = useCallback(async () => {
    const updated = await getProject(project.targetSourceId);
    onProjectUpdate(updated);
  }, [onProjectUpdate, project.targetSourceId]);

  // 폴링은 스텝이 소유한다: 카드와 헤더 태그(ProjectPageMeta)가 같은 관찰을 prop 으로
  // 나눠 받는다 — 모듈 스토어로 잇는 것은 DR1/DR7 위반이라 선택지가 아니다.
  const polling = useTestConnectionPolling(project.targetSourceId);

  return (
    <ConfirmedIntegrationDataProvider targetSourceId={project.targetSourceId}>
      <ProjectPageMeta
        project={project}
        providerLabel={providerLabel}
        identity={identity}
        action={action}
        tcJob={polling.latestJob}
      />
      <ConnectionTestSection
        providerLabel={providerLabel}
        refreshProject={refreshProject}
        polling={polling}
      />
      <RejectionAlert project={project} />
    </ConfirmedIntegrationDataProvider>
  );
};
