'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CloudTargetSource } from '@/lib/types';
import { getProject } from '@/app/lib/api';
import {
  getAzureSettings,
  resolveAzureProjectIdentifiers,
} from '@/app/lib/api/azure';
import type { AzureV1Settings } from '@/lib/types/azure';
import { ProcessStatusCard } from '@/app/components/features/ProcessStatusCard';
import { GuideCard } from '@/app/components/features/process-status/GuideCard';
import {
  DeleteInfrastructureButton,
  ProjectPageMeta,
  RejectionAlert,
  type ProjectIdentity,
} from '@/app/integration/target-sources/[targetSourceId]/_components/common';
import { ResourceSection } from '@/app/integration/target-sources/[targetSourceId]/_components/shared/ResourceSection';

interface AzureProjectPageProps {
  project: CloudTargetSource;
  onProjectUpdate: (project: CloudTargetSource) => void;
}

export const AzureProjectPage = ({
  project,
  onProjectUpdate,
}: AzureProjectPageProps) => {
  const [fallbackSettings, setFallbackSettings] = useState<AzureV1Settings | null>(null);

  useEffect(() => {
    const needsIdentifierFallback = !project.tenantId || !project.subscriptionId;
    if (!needsIdentifierFallback) return;

    const controller = new AbortController();
    void getAzureSettings(project.targetSourceId, { signal: controller.signal })
      .then((response) => {
        if (!controller.signal.aborted) setFallbackSettings(response);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.error('[AzureProjectPage] getAzureSettings fallback failed', error);
        setFallbackSettings(null);
      });
    return () => controller.abort();
  }, [project.subscriptionId, project.targetSourceId, project.tenantId]);

  const azureIdentifiers = useMemo(
    () => resolveAzureProjectIdentifiers(
      {
        tenantId: project.tenantId,
        subscriptionId: project.subscriptionId,
      },
      fallbackSettings,
    ),
    [fallbackSettings, project.subscriptionId, project.tenantId],
  );

  const refreshProject = useCallback(async () => {
    const updated = await getProject(project.targetSourceId);
    onProjectUpdate(updated as CloudTargetSource);
  }, [onProjectUpdate, project.targetSourceId]);

  const identity: ProjectIdentity = {
    cloudProvider: 'Azure',
    monitoringMethod: 'Azure Agent',
    jiraLink: null,
    identifiers: [
      { label: 'Subscription ID', value: azureIdentifiers.subscriptionId ?? null, mono: true },
      { label: 'Tenant ID', value: azureIdentifiers.tenantId ?? null, mono: true },
    ],
  };

  return (
    <main className="max-w-[1200px] mx-auto p-7 space-y-6">
      <ProjectPageMeta project={project} providerLabel="Azure Infrastructure" identity={identity} action={<DeleteInfrastructureButton />} />

      <ProcessStatusCard
        project={project}
        onProjectUpdate={onProjectUpdate}
      />

      <GuideCard
        currentStep={project.processStatus}
        provider={project.cloudProvider}
      />

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
