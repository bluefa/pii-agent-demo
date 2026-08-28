// `CloudProvider` is title-case (`'Azure'`); slot keys are lower-case.
// Normalise at this boundary so the rest of the registry stays
// case-consistent. Out-of-range steps return null instead of falling
// through to a silent registry miss.

import { GUIDE_SLOTS } from '@/lib/constants/guide-registry';

import type { GuideSlotKey } from '@/lib/constants/guide-registry';
import { sduStepOf } from '@/app/target-sources/[targetSourceId]/_components/sdu/sdu-steps';

import type { CloudProvider } from '@/lib/types';
import { ProcessStatus } from '@/lib/types';

const isSlotKey = (key: string): key is GuideSlotKey => key in GUIDE_SLOTS;

const isInRange = (step: ProcessStatus): boolean =>
  step >= ProcessStatus.WAITING_TARGET_CONFIRMATION &&
  step <= ProcessStatus.INSTALLATION_COMPLETE;

export const resolveStepSlot = (
  provider: CloudProvider,
  currentStep: ProcessStatus,
  opts?: { manualInstall?: boolean; sdu?: boolean },
): GuideSlotKey | null => {
  if (!isInRange(currentStep)) return null;

  // SDU is checked BEFORE the provider, and takes no `provider` of its own: an SDU
  // target still sits on a CSP (its `cloudProvider` is AWS or whatever it is), so
  // falling through to the provider branch would hand it the AWS guide for a step it
  // is not on. The slot is keyed by the SDU step (1·2·3·4), not by the status — several
  // statuses fold onto one SDU step, and `sduStepOf` owns that fold.
  if (opts?.sdu) {
    const key = `process.sdu.${sduStepOf(currentStep)}`;
    return isSlotKey(key) ? key : null;
  }

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
  isSduType?: boolean;
}): GuideSlotKey | null =>
  resolveStepSlot(project.cloudProvider, project.processStatus, {
    // Same semantics as AwsInstallationInline: only an explicit grant is auto.
    // An account nobody granted the permission to installs manually.
    manualInstall: project.isTerraformExecutionGranted !== true,
    // `=== true`, not truthiness: the field is optional, and an absent flag is a
    // cloud target, not an SDU one.
    sdu: project.isSduType === true,
  });
