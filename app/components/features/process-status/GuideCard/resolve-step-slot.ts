// `CloudProvider` is title-case (`'Azure'`); slot keys are lower-case.
// Normalise at this boundary so the rest of the registry stays
// case-consistent. Out-of-range steps return null instead of falling
// through to a silent registry miss.

import { GUIDE_SLOTS } from '@/lib/constants/guide-registry';

import type { GuideSlotKey } from '@/lib/constants/guide-registry';
import type { CloudProvider } from '@/lib/types';
import { ProcessStatus } from '@/lib/types';

const isSlotKey = (key: string): key is GuideSlotKey => key in GUIDE_SLOTS;

const isInRange = (step: ProcessStatus): boolean =>
  step >= ProcessStatus.WAITING_TARGET_CONFIRMATION &&
  step <= ProcessStatus.INSTALLATION_COMPLETE;

export const resolveStepSlot = (
  provider: CloudProvider,
  currentStep: ProcessStatus,
  opts?: { manualInstall?: boolean },
): GuideSlotKey | null => {
  if (!isInRange(currentStep)) return null;

  if (provider === 'AWS') {
    // AUTO/MANUAL guides only diverge at step 4 (same guideName elsewhere),
    // so the manual variant is applied only there.
    const variant =
      opts?.manualInstall && currentStep === ProcessStatus.INSTALLING ? 'manual' : 'auto';
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

  if (provider === 'IDC') {
    const key = `process.idc.${currentStep}`;
    return isSlotKey(key) ? key : null;
  }

  return null;
};

/**
 * Project-level convenience over `resolveStepSlot` — lets layout shells stay
 * provider-agnostic (R1: no `cloudProvider` token in CloudTargetSourceLayout).
 */
export const resolveProjectStepSlot = (project: {
  cloudProvider: CloudProvider;
  processStatus: ProcessStatus;
  isTerraformExecutionGranted?: boolean;
}): GuideSlotKey | null =>
  resolveStepSlot(project.cloudProvider, project.processStatus, {
    // Same semantics as AwsInstallationInline: only an explicit grant is auto.
    // An account nobody granted the permission to installs manually.
    manualInstall: project.isTerraformExecutionGranted !== true,
  });
