'use client';

import { CloudTargetSource } from '@/lib/types';
import { AwsInstallationModeSelector } from '@/app/components/features/process-status/aws/AwsInstallationModeSelector';
import {
  DeleteInfrastructureButton,
  ProjectPageMeta,
  type ProjectIdentity,
} from '@/app/integration/target-sources/[targetSourceId]/_components/common';
import { CloudTargetSourceLayout } from '@/app/integration/target-sources/[targetSourceId]/_components/layout/CloudTargetSourceLayout';

interface AwsProjectPageProps {
  project: CloudTargetSource;
  onProjectUpdate: (project: CloudTargetSource) => void;
}

export const AwsProjectPage = ({
  project,
  onProjectUpdate,
}: AwsProjectPageProps) => {
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
    <CloudTargetSourceLayout
      project={project}
      identity={identity}
      providerLabel="AWS Infrastructure"
      action={<DeleteInfrastructureButton />}
      onProjectUpdate={onProjectUpdate}
    />
  );
};
