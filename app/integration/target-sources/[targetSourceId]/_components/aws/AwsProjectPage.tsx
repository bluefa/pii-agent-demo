'use client';

import { useCallback, useState } from 'react';
import { CloudTargetSource } from '@/lib/types';
import type { ConfirmedResource } from '@/lib/types/resources';
import { getProject } from '@/app/lib/api';
import { ProcessStatusCard } from '@/app/components/features/ProcessStatusCard';
import { GuideCard } from '@/app/components/features/process-status/GuideCard';
import { AwsInstallationModeSelector } from '@/app/components/features/process-status/aws/AwsInstallationModeSelector';
import {
  DeleteInfrastructureButton,
  ProjectPageMeta,
  RejectionAlert,
  type ProjectIdentity,
} from '@/app/integration/target-sources/[targetSourceId]/_components/common';
import { ResourceSection } from '@/app/integration/target-sources/[targetSourceId]/_components/shared/ResourceSection';

interface AwsProjectPageProps {
  project: CloudTargetSource;
  onProjectUpdate: (project: CloudTargetSource) => void;
}

const EMPTY_CONFIRMED: ConfirmedResource[] = [];

export const AwsProjectPage = ({
  project,
  onProjectUpdate,
}: AwsProjectPageProps) => {
  const [confirmed, setConfirmed] = useState<readonly ConfirmedResource[]>(EMPTY_CONFIRMED);

  const refreshProject = useCallback(async () => {
    const updated = await getProject(project.targetSourceId);
    onProjectUpdate(updated as CloudTargetSource);
  }, [onProjectUpdate, project.targetSourceId]);

  const identity: ProjectIdentity = {
    cloudProvider: 'AWS',
    monitoringMethod: 'AWS Agent',
    jiraLink: null,
    identifiers: [
      { label: 'AWS Account ID', value: project.awsAccountId ?? null, mono: true },
      ...(project.awsRegionType
        ? [{ label: 'Region Type', value: project.awsRegionType === 'china' ? 'China' : 'Global' }]
        : []),
    ],
  };

  if (!project.awsInstallationMode) {
    return (
      <main className="max-w-[1200px] mx-auto p-7 space-y-6">
        <ProjectPageMeta project={project} providerLabel="AWS Infrastructure" identity={identity} action={<DeleteInfrastructureButton />} />
        <AwsInstallationModeSelector
          targetSourceId={project.targetSourceId}
          onModeSelected={onProjectUpdate}
        />
      </main>
    );
  }

  return (
    <main className="max-w-[1200px] mx-auto p-7 space-y-6">
      <ProjectPageMeta project={project} providerLabel="AWS Infrastructure" identity={identity} action={<DeleteInfrastructureButton />} />

      <ProcessStatusCard
        project={project}
        confirmed={confirmed}
        onProjectUpdate={onProjectUpdate}
      />

      <GuideCard
        currentStep={project.processStatus}
        provider={project.cloudProvider}
        installationMode={project.awsInstallationMode}
      />

      <ResourceSection
        step={project.processStatus}
        targetSourceId={project.targetSourceId}
        refreshProject={refreshProject}
        onConfirmedLoaded={setConfirmed}
      />

      <RejectionAlert project={project} />
    </main>
  );
};
