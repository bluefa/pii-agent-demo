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
      // v16 identity bar carries only the Account ID (HTML 9428); it has no second
      // identifier (e.g. Region Type), so none is added here. The label is the bare
      // 'Account ID' (aws.idLabel, HTML 9428) — no provider prefix.
      { label: 'Account ID', value: project.awsAccountId ?? null, mono: true },
    ],
  };

  if (!project.awsInstallationMode) {
    // Mode-selector pre-screen: same full-width 40/32/80 padding as
    // CloudTargetSourceLayout / IDC (body supplies the #F4F4FB bg).
    return (
      <main className="px-10 pt-8 pb-20 space-y-6">
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
