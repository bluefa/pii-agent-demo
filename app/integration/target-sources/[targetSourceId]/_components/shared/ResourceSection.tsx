'use client';

import { ProcessStatus, type CloudProvider } from '@/lib/types';
import { CandidateResourceSection } from '@/app/integration/target-sources/[targetSourceId]/_components/candidate';
import { ApprovedIntegrationSection } from '@/app/integration/target-sources/[targetSourceId]/_components/approved';
import { ConfirmedIntegrationSection } from '@/app/integration/target-sources/[targetSourceId]/_components/confirmed';

interface ResourceSectionProps {
  step: ProcessStatus;
  targetSourceId: number;
  cloudProvider: CloudProvider;
  refreshProject: () => Promise<void>;
}

export const ResourceSection = ({
  step,
  targetSourceId,
  cloudProvider,
  refreshProject,
}: ResourceSectionProps) => {
  switch (step) {
    case ProcessStatus.WAITING_TARGET_CONFIRMATION:
    case ProcessStatus.WAITING_APPROVAL:
      return (
        <CandidateResourceSection
          targetSourceId={targetSourceId}
          readonly={step === ProcessStatus.WAITING_APPROVAL}
          refreshProject={refreshProject}
        />
      );
    case ProcessStatus.APPLYING_APPROVED:
      return <ApprovedIntegrationSection targetSourceId={targetSourceId} />;
    case ProcessStatus.INSTALLING:
    case ProcessStatus.WAITING_CONNECTION_TEST:
    case ProcessStatus.CONNECTION_VERIFIED:
    case ProcessStatus.INSTALLATION_COMPLETE:
      return (
        <ConfirmedIntegrationSection
          targetSourceId={targetSourceId}
          step={step}
          cloudProvider={cloudProvider}
          refreshProject={refreshProject}
        />
      );
    default:
      return null;
  }
};
