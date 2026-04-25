'use client';

/**
 * Guide CMS — legacy facade.
 *
 * Spec: docs/reports/guide-cms/wave-tasks/W4-a-guidecard-split.md §Step 6.
 *
 * Preserves the `{ currentStep, provider, installationMode }` prop
 * surface that the 3 provider pages (AWS / Azure / GCP) still use.
 * Internally delegates via `resolveStepSlot` → `GuideCardContainer`.
 * W4-b replaces the call sites and removes this file; until then, do
 * not inline data fetching or rendering here — new consumers should
 * import `GuideCardContainer` directly.
 */

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
