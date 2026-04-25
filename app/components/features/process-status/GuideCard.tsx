'use client';

// Legacy facade — provider pages still pass (currentStep, provider,
// installationMode). New consumers import GuideCardContainer directly.
// Removed by W4-b once the 3 provider pages migrate.

import { GuideCardContainer } from '@/app/components/features/process-status/GuideCard/GuideCardContainer';
import { resolveStepSlot } from '@/app/components/features/process-status/GuideCard/resolve-step-slot';

import type { AwsInstallationMode, CloudProvider, ProcessStatus } from '@/lib/types';

interface GuideCardProps {
  currentStep: ProcessStatus;
  provider: CloudProvider;
  installationMode?: AwsInstallationMode;
}

export const GuideCard = ({ currentStep, provider, installationMode }: GuideCardProps) => {
  const slotKey = resolveStepSlot(provider, currentStep, installationMode);
  if (!slotKey) return null;
  return <GuideCardContainer slotKey={slotKey} />;
};

export default GuideCard;
