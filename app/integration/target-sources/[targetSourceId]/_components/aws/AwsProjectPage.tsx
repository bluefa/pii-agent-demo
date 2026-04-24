'use client';

import { useCallback, useEffect, useState } from 'react';
import { CloudTargetSource, ProcessStatus, Resource } from '@/lib/types';
import {
  getProject,
  getConfirmedIntegration,
} from '@/app/lib/api';
import { getProjectCurrentStep } from '@/lib/process';
import { IntegrationTargetInfoCard } from '@/app/components/features/integration-target-info';
import { ProcessStatusCard } from '@/app/components/features/ProcessStatusCard';
import { GuideCard } from '@/app/components/features/process-status/GuideCard';
import { LoadingSpinner } from '@/app/components/ui/LoadingSpinner';
import { AwsInstallationModeSelector } from '@/app/components/features/process-status/aws/AwsInstallationModeSelector';
import {
  DeleteInfrastructureButton,
  ProjectPageMeta,
  RejectionAlert,
  type ProjectIdentity,
} from '@/app/integration/target-sources/[targetSourceId]/_components/common';
import { CandidateResourceSection } from '@/app/integration/target-sources/[targetSourceId]/_components/candidate';
import { ResourceTransitionPanel } from '@/app/components/features/process-status/ResourceTransitionPanel';
import { AppError, isMissingConfirmedIntegrationError } from '@/lib/errors';
import { cn, getButtonClass, statusColors, textColors } from '@/lib/theme';
import {
  EMPTY_CONFIRMED_INTEGRATION,
  confirmedIntegrationToResources,
} from '@/lib/resource-catalog';

interface AwsProjectPageProps {
  project: CloudTargetSource;
  onProjectUpdate: (project: CloudTargetSource) => void;
}

export const AwsProjectPage = ({
  project,
  onProjectUpdate,
}: AwsProjectPageProps) => {
  const [resources, setResources] = useState<Resource[]>([]);
  const [resourceLoading, setResourceLoading] = useState(false);
  const [resourceError, setResourceError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  const currentStep = getProjectCurrentStep(project);
  const needsConfirmedFetch = currentStep >= ProcessStatus.INSTALLING;

  useEffect(() => {
    if (!project.awsInstallationMode) return;
    if (!needsConfirmedFetch) {
      setResources([]);
      setResourceLoading(false);
      setResourceError(null);
      return;
    }
    let cancelled = false;
    setResourceLoading(true);
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
        const message = error instanceof AppError && error.isUserFacing
          ? error.message
          : error instanceof Error
            ? error.message
            : 'AWS 리소스 정보를 불러오지 못했습니다.';
        setResourceError(message);
      } finally {
        if (!cancelled) setResourceLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [needsConfirmedFetch, project.awsInstallationMode, project.targetSourceId, retryNonce]);

  const reloadResources = useCallback(() => setRetryNonce((n) => n + 1), []);

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
    if (resourceLoading) {
      return (
        <div className="bg-white rounded-xl shadow-sm p-12 flex items-center justify-center gap-3">
          <LoadingSpinner />
          <span className={cn('text-sm', textColors.tertiary)}>AWS 리소스 정보를 불러오는 중입니다.</span>
        </div>
      );
    }
    if (resourceError) {
      return (
        <div className={cn('rounded-xl border p-6 space-y-3', statusColors.error.bg, statusColors.error.border)}>
          <p className={cn('text-sm font-medium', statusColors.error.textDark)}>{resourceError}</p>
          <button onClick={reloadResources} className={getButtonClass('secondary')}>
            다시 시도
          </button>
        </div>
      );
    }
    return null;
  };

  return (
    <main className="max-w-[1200px] mx-auto p-7 space-y-6">
      <ProjectPageMeta project={project} providerLabel="AWS Infrastructure" identity={identity} action={<DeleteInfrastructureButton />} />

      <ProcessStatusCard
        project={project}
        resources={resources}
        onProjectUpdate={onProjectUpdate}
      />

      <GuideCard
        currentStep={currentStep}
        provider={project.cloudProvider}
        installationMode={project.awsInstallationMode}
      />

      {renderStepCard()}

      <RejectionAlert project={project} />
    </main>
  );
};
