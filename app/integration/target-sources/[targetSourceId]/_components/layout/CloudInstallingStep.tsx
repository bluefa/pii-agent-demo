'use client';

import { useCallback, type ReactNode } from 'react';
import { ProcessStatus, type CloudProvider, type CloudTargetSource } from '@/lib/types';
import { cn, providerColors, textColors } from '@/lib/theme';
import { getProject } from '@/app/lib/api';
import { ProcessStatusCard } from '@/app/components/features/ProcessStatusCard';
import { GuideCardContainer } from '@/app/components/features/process-status/GuideCard/GuideCardContainer';
import { resolveStepSlot } from '@/app/components/features/process-status/GuideCard/resolve-step-slot';
import {
  ProjectPageMeta,
  RejectionAlert,
  type ProjectIdentity,
} from '@/app/integration/target-sources/[targetSourceId]/_components/common';
import { ConfirmedIntegrationDataProvider } from '@/app/integration/target-sources/[targetSourceId]/_components/data/ConfirmedIntegrationDataProvider';
import { InstallationStatusSlot } from '@/app/integration/target-sources/[targetSourceId]/_components/layout/InstallationStatusSlot';

interface CloudInstallingStepProps {
  project: CloudTargetSource;
  identity: ProjectIdentity;
  providerLabel: string;
  action: ReactNode;
  onProjectUpdate: (project: CloudTargetSource) => void;
}

const PROVIDER_BADGE_CLASS = cn(
  'inline-flex items-center gap-2',
  'text-[16px] font-bold tracking-[-0.02em]',
  textColors.primary,
);

const ProviderBadge = ({
  provider,
  label,
}: {
  provider: CloudProvider;
  label: string;
}) => (
  <span className={PROVIDER_BADGE_CLASS}>
    <span
      className={cn('h-2 w-2 rounded-full', providerColors[provider].bar)}
      aria-hidden="true"
    />
    <span>
      <strong>Provider:</strong> {label}
    </span>
  </span>
);

export const CloudInstallingStep = ({
  project,
  identity,
  providerLabel,
  action,
  onProjectUpdate,
}: CloudInstallingStepProps) => {
  const slotKey = resolveStepSlot(
    project.cloudProvider,
    ProcessStatus.INSTALLING,
    project.awsInstallationMode,
  );

  const refreshProject = useCallback(async () => {
    const updated = await getProject(project.targetSourceId);
    onProjectUpdate(updated);
  }, [onProjectUpdate, project.targetSourceId]);

  return (
    <ConfirmedIntegrationDataProvider targetSourceId={project.targetSourceId}>
      <ProjectPageMeta
        project={project}
        providerLabel={providerLabel}
        identity={identity}
        action={
          <div className="flex items-center gap-3">
            <ProviderBadge provider={project.cloudProvider} label={providerLabel} />
            {action}
          </div>
        }
      />
      <ProcessStatusCard project={project} onProjectUpdate={onProjectUpdate} />
      {slotKey && <GuideCardContainer slotKey={slotKey} />}
      <InstallationStatusSlot project={project} refreshProject={refreshProject} />
      <RejectionAlert project={project} />
    </ConfirmedIntegrationDataProvider>
  );
};
