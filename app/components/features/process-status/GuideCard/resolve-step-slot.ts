// `CloudProvider` is title-case (`'Azure'`); slot keys are lower-case.
// Normalise at this boundary so the rest of the registry stays
// case-consistent. Out-of-range steps return null instead of falling
// through to a silent registry miss.

import { GUIDE_SLOTS } from '@/lib/constants/guide-registry';

import type { GuideSlotKey } from '@/lib/constants/guide-registry';
import type { AwsInstallationMode, CloudProvider } from '@/lib/types';
import { ProcessStatus } from '@/lib/types';

const isSlotKey = (key: string): key is GuideSlotKey => key in GUIDE_SLOTS;

const isInRange = (step: ProcessStatus): boolean =>
  step >= ProcessStatus.WAITING_TARGET_CONFIRMATION &&
  step <= ProcessStatus.INSTALLATION_COMPLETE;

export const resolveStepSlot = (
  provider: CloudProvider,
  currentStep: ProcessStatus,
  installationMode?: AwsInstallationMode,
): GuideSlotKey | null => {
  if (!isInRange(currentStep)) return null;

  if (provider === 'AWS') {
    const variant = installationMode === 'MANUAL' ? 'manual' : 'auto';
    const key = `process.aws.${variant}.${currentStep}`;
    return isSlotKey(key) ? key : null;
  }

  if (provider === 'Azure') {
    const key = `process.azure.${currentStep}`;
    return isSlotKey(key) ? key : null;
  }

  if (provider === 'GCP') {
    const key = `process.gcp.${currentStep}`;
    return isSlotKey(key) ? key : null;
  }

  return null;
};
