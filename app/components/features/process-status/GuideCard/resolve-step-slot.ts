/**
 * Guide CMS — legacy facade helper.
 *
 * Spec: docs/reports/guide-cms/wave-tasks/W4-a-guidecard-split.md §Step 6.
 *
 * Maps the legacy `(provider, currentStep, installationMode)` shape
 * that 3 provider pages still pass into `GuideCard.tsx` onto a concrete
 * `GuideSlotKey` from `GUIDE_SLOTS`. Used only by the facade — new
 * call sites (W4-b onward) pass a `slotKey` to `GuideCardContainer`
 * directly.
 *
 * `CloudProvider` is title-case (`'Azure'`). The registry stores the
 * internal provider tag as upper-case, but slot keys themselves are
 * lower-case, so we normalise at this boundary without re-introducing
 * the upper-case comparison. Out-of-range step values fall through to
 * `null` rather than a silent registry lookup.
 */

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
