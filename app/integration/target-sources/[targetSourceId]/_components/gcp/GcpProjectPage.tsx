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

interface GcpProjectPageProps {
  project: CloudTargetSource;
  onProjectUpdate: (project: CloudTargetSource) => void;
}

export const GcpProjectPage = ({
  project,
  onProjectUpdate,
}: GcpProjectPageProps) => {
  const refreshProject = useCallback(async () => {
    const updated = await getProject(project.targetSourceId);
    onProjectUpdate(updated as CloudTargetSource);
  }, [onProjectUpdate, project.targetSourceId]);

  const slotKey = resolveStepSlot('GCP', project.processStatus);

  const identity: ProjectIdentity = {
    cloudProvider: 'GCP',
    monitoringMethod: 'GCP Agent',
    jiraLink: null,
    identifiers: [
      { label: 'GCP Project ID', value: project.gcpProjectId ?? null, mono: true },
    ],
  };

  return (
    <main className="max-w-[1200px] mx-auto p-7 space-y-6">
      <ProjectPageMeta project={project} providerLabel="GCP Infrastructure" identity={identity} action={<DeleteInfrastructureButton />} />

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
