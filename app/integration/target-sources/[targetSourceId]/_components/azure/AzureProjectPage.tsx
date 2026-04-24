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
import { LoadingSpinner } from '@/app/components/ui/LoadingSpinner';
import {
  DeleteInfrastructureButton,
  ProjectPageMeta,
  RejectionAlert,
  type ProjectIdentity,
} from '@/app/integration/target-sources/[targetSourceId]/_components/common';
import { CandidateResourceSection } from '@/app/integration/target-sources/[targetSourceId]/_components/candidate';
import { ResourceTransitionPanel } from '@/app/components/features/process-status/ResourceTransitionPanel';
import { AppError, isMissingConfirmedIntegrationError } from '@/lib/errors';
import {
  EMPTY_CONFIRMED_INTEGRATION,
  confirmedIntegrationToResources,
} from '@/lib/resource-catalog';
import { getProjectCurrentStep } from '@/lib/process';
import { cn, getButtonClass, statusColors, textColors } from '@/lib/theme';

interface AzureProjectPageProps {
  project: CloudTargetSource;
  onProjectUpdate: (project: CloudTargetSource) => void;
}

const getResourceErrorMessage = (error: unknown): string => {
  if (error instanceof AppError && error.isUserFacing) return error.message;
  if (error instanceof Error) return error.message;
  return 'Azure 리소스 정보를 불러오지 못했습니다.';
};

export const AzureProjectPage = ({
  project,
  onProjectUpdate,
}: AzureProjectPageProps) => {
  const [fallbackSettings, setFallbackSettings] = useState<AzureV1Settings | null>(null);

  const [resources, setResources] = useState<Resource[]>([]);
  const [resourceLoaded, setResourceLoaded] = useState(true);
  const [resourceError, setResourceError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  const currentStep = getProjectCurrentStep(project);
  const needsConfirmedFetch = currentStep >= ProcessStatus.INSTALLING;

  useEffect(() => {
    let cancelled = false;
    const needsIdentifierFallback = !project.tenantId || !project.subscriptionId;

    setFallbackSettings(null);

    if (needsIdentifierFallback) {
      void getAzureSettings(project.targetSourceId)
        .then((response) => {
          if (cancelled) return;
          setFallbackSettings(response);
        })
        .catch(() => {
          if (cancelled) return;
          setFallbackSettings(null);
        });
    }

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
    if (!needsConfirmedFetch) {
      setResources([]);
      setResourceLoaded(true);
      setResourceError(null);
      return;
    }
    let cancelled = false;
    setResourceLoaded(false);
    setResourceError(null);
    (async () => {
      try {
        const response = await getConfirmedIntegration(project.targetSourceId).catch((error) => {
          if (isMissingConfirmedIntegrationError(error)) return EMPTY_CONFIRMED_INTEGRATION;
          throw error;
        });
        if (cancelled) return;
        setResources(confirmedIntegrationToResources(response));
      } catch (error) {
        if (cancelled) return;
        setResourceError(getResourceErrorMessage(error));
      } finally {
        if (!cancelled) {
          setResourceLoaded(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [needsConfirmedFetch, project.targetSourceId, retryNonce]);

  const reloadResources = useCallback(() => setRetryNonce((n) => n + 1), []);

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
    if (currentStep >= ProcessStatus.INSTALLING) {
      return <IntegrationTargetInfoCard key={project.targetSourceId} targetSourceId={project.targetSourceId} />;
    }
    return null;
  };

  return (
    <main className="max-w-[1200px] mx-auto p-7 space-y-6">
      <ProjectPageMeta project={project} providerLabel="Azure Infrastructure" identity={identity} action={<DeleteInfrastructureButton />} />

      {!resourceLoaded ? (
        <div className="bg-white rounded-xl shadow-sm p-12 flex items-center justify-center gap-3">
          <LoadingSpinner />
          <span className={cn('text-sm', textColors.tertiary)}>Azure 리소스 정보를 불러오는 중입니다.</span>
        </div>
      ) : resourceError && resources.length === 0 && needsConfirmedFetch ? (
        <div className={cn('rounded-xl border p-6 space-y-3', statusColors.error.bg, statusColors.error.border)}>
          <p className={cn('text-sm font-medium', statusColors.error.textDark)}>
            {resourceError}
          </p>
          <button
            onClick={reloadResources}
            className={getButtonClass('secondary')}
          >
            다시 시도
          </button>
        </div>
      ) : (
        <>
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
        </>
      )}
    </main>
  );
};
