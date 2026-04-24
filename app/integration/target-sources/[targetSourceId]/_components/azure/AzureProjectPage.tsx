'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CloudTargetSource, ProcessStatus, Resource } from '@/lib/types';
import {
  getConfirmedIntegration,
  getProject,
} from '@/app/lib/api';
import {
  getAzureSettings,
  resolveAzureProjectIdentifiers,
} from '@/app/lib/api/azure';
import type { AzureV1Settings } from '@/lib/types/azure';
import { IntegrationTargetInfoCard } from '@/app/components/features/integration-target-info';
import { ProcessStatusCard } from '@/app/components/features/ProcessStatusCard';
import { GuideCard } from '@/app/components/features/process-status/GuideCard';
import {
  DeleteInfrastructureButton,
  ProjectPageMeta,
  RejectionAlert,
  type ProjectIdentity,
} from '@/app/integration/target-sources/[targetSourceId]/_components/common';
import { CandidateResourceSection } from '@/app/integration/target-sources/[targetSourceId]/_components/candidate';
import { ResourceTransitionPanel } from '@/app/components/features/process-status/ResourceTransitionPanel';
import { isMissingConfirmedIntegrationError } from '@/lib/errors';
import {
  EMPTY_CONFIRMED_INTEGRATION,
  confirmedIntegrationToResources,
} from '@/lib/resource-catalog';

interface AzureProjectPageProps {
  project: CloudTargetSource;
  onProjectUpdate: (project: CloudTargetSource) => void;
}

const EMPTY_RESOURCES: Resource[] = [];

export const AzureProjectPage = ({
  project,
  onProjectUpdate,
}: AzureProjectPageProps) => {
  const [fallbackSettings, setFallbackSettings] = useState<AzureV1Settings | null>(null);
  const [fetchedResources, setFetchedResources] = useState<Resource[]>(EMPTY_RESOURCES);

  const currentStep = project.processStatus;
  const needsConfirmedFetch = currentStep >= ProcessStatus.INSTALLING;
  const resources = needsConfirmedFetch ? fetchedResources : EMPTY_RESOURCES;

  useEffect(() => {
    const needsIdentifierFallback = !project.tenantId || !project.subscriptionId;
    if (!needsIdentifierFallback) return;

    let cancelled = false;
    void getAzureSettings(project.targetSourceId)
      .then((response) => {
        if (!cancelled) setFallbackSettings(response);
      })
      .catch((error: unknown) => {
        console.error('[AzureProjectPage] getAzureSettings fallback failed', error);
        if (!cancelled) setFallbackSettings(null);
      });
    return () => {
      cancelled = true;
    };
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

  useEffect(() => {
    if (!needsConfirmedFetch) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await getConfirmedIntegration(project.targetSourceId).catch((error) => {
          if (isMissingConfirmedIntegrationError(error)) return EMPTY_CONFIRMED_INTEGRATION;
          throw error;
        });
        if (!cancelled) setFetchedResources(confirmedIntegrationToResources(response));
      } catch (error) {
        console.error('[AzureProjectPage] getConfirmedIntegration failed', error);
        // IntegrationTargetInfoCard does its own fetch and surfaces the user-facing error.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [needsConfirmedFetch, project.targetSourceId]);

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

  const renderStepCard = () => {
    if (
      currentStep === ProcessStatus.WAITING_TARGET_CONFIRMATION
      || currentStep === ProcessStatus.WAITING_APPROVAL
    ) {
      return (
        <CandidateResourceSection
          targetSourceId={project.targetSourceId}
          readonly={currentStep === ProcessStatus.WAITING_APPROVAL}
          refreshProject={refreshProject}
        />
      );
    }
    if (currentStep === ProcessStatus.APPLYING_APPROVED) {
      return (
        <ResourceTransitionPanel
          targetSourceId={project.targetSourceId}
          cloudProvider={project.cloudProvider}
          processStatus={currentStep}
        />
      );
    }
    if (needsConfirmedFetch) {
      return <IntegrationTargetInfoCard key={project.targetSourceId} targetSourceId={project.targetSourceId} />;
    }
    return null;
  };

  return (
    <main className="max-w-[1200px] mx-auto p-7 space-y-6">
      <ProjectPageMeta project={project} providerLabel="Azure Infrastructure" identity={identity} action={<DeleteInfrastructureButton />} />

      <ProcessStatusCard
        project={project}
        resources={resources}
        onProjectUpdate={onProjectUpdate}
      />

      <GuideCard
        currentStep={currentStep}
        provider={project.cloudProvider}
      />

      {renderStepCard()}

      <RejectionAlert project={project} />
    </main>
  );
};
