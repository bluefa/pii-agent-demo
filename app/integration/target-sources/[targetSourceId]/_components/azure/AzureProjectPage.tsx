'use client';

import { useCallback } from 'react';
import { CloudTargetSource } from '@/lib/types';
import { getProject } from '@/app/lib/api';
import { ProcessStatusCard } from '@/app/components/features/ProcessStatusCard';
import { GuideCardContainer } from '@/app/components/features/process-status/GuideCard/GuideCardContainer';
import { resolveStepSlot } from '@/app/components/features/process-status/GuideCard/resolve-step-slot';
import {
  DeleteInfrastructureButton,
  ProjectPageMeta,
  RejectionAlert,
  type ProjectIdentity,
} from '@/app/integration/target-sources/[targetSourceId]/_components/common';
import { ResourceSection } from '@/app/integration/target-sources/[targetSourceId]/_components/shared/ResourceSection';
import { CloudTargetSourceLayout } from '@/app/integration/target-sources/[targetSourceId]/_components/layout/CloudTargetSourceLayout';
import { isLayoutRoutedStatus } from '@/app/integration/target-sources/[targetSourceId]/_components/layout/route-step';

interface AzureProjectPageProps {
  project: CloudTargetSource;
  onProjectUpdate: (project: CloudTargetSource) => void;
}

export const AzureProjectPage = ({
  project,
  onProjectUpdate,
}: AzureProjectPageProps) => {
  const refreshProject = useCallback(async () => {
    const updated = await getProject(project.targetSourceId);
    onProjectUpdate(updated as CloudTargetSource);
  }, [onProjectUpdate, project.targetSourceId]);

  const identity: ProjectIdentity = {
    cloudProvider: 'Azure',
    monitoringMethod: 'Azure Agent',
    jiraLink: null,
    identifiers: [
      { label: 'Subscription ID', value: project.subscriptionId ?? null, mono: true },
      { label: 'Tenant ID', value: project.tenantId ?? null, mono: true },
    ],
  };

  if (isLayoutRoutedStatus(project.processStatus)) {
    return (
      <CloudTargetSourceLayout
        project={project}
        identity={identity}
        providerLabel="Azure Infrastructure"
        action={<DeleteInfrastructureButton />}
        onProjectUpdate={onProjectUpdate}
      />
    );
  }

  const slotKey = resolveStepSlot('Azure', project.processStatus);

  return (
    <main className="max-w-[1200px] mx-auto p-7 space-y-6">
      <ProjectPageMeta project={project} providerLabel="Azure Infrastructure" identity={identity} action={<DeleteInfrastructureButton />} />

      <ProcessStatusCard
        project={project}
        onProjectUpdate={onProjectUpdate}
      />

      {slotKey && <GuideCardContainer slotKey={slotKey} />}

      <ResourceSection
        step={project.processStatus}
        targetSourceId={project.targetSourceId}
        cloudProvider={project.cloudProvider}
        refreshProject={refreshProject}
      />

      <RejectionAlert project={project} />
    </main>
  );
};
