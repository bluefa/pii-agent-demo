/**
 * GCP installation-status adapter — transforms the zod-codegen snake wire type
 * to the Step-4 UI domain (`GcpInstallationStatusResponse`, v1-types).
 *
 * Pure CSR function: inputs are already-validated zod wire types; output is a
 * camel view used by GcpInstallationInline and joinGcpResources.
 *
 * Genuine reshapes performed here (not rename-only):
 *   - Computes `summary` (totalCount / completedCount / allCompleted) from resources.
 *   - Narrows 5-value step enum → 4-value UI enum (UNKNOWN→IN_PROGRESS).
 *   - Narrows 5-value installation enum → 3-value (SKIP→COMPLETED, UNKNOWN→IN_PROGRESS).
 *   - Collapses SUCCESS→COMPLETED in lastCheck.
 *
 * NOTE(L3): `resourceType`/`resourceSubType` defaults are stopgaps; existing UI
 * helpers do not read them. A 5-value-enum + drop-summary UI rebind is deferred
 * (Spec G §6.6).
 */

import type { z } from 'zod';
import type { schemas } from '@/lib/generated/install-v1';
import type {
  GcpInstallationStatusResponse,
  GcpInstallationStatusValue,
  GcpResourceStatus,
  GcpStepStatus,
  GcpStepStatusValue,
  LastCheckInfo,
} from '@/app/api/_lib/v1-types';

type WireResponse = z.infer<typeof schemas.GcpInstallationStatusResponse>;
type WireResource = z.infer<typeof schemas.GcpResourceInstallationStatusDto>;
type WireStep = z.infer<typeof schemas.CloudInstallationStepStatusDto>;

type StepStatusWire = NonNullable<WireStep['status']>;
type InstallStatusWire = NonNullable<WireResource['installation_status']>;
type LastCheckStatusWire = NonNullable<NonNullable<WireResponse['last_check']>['status']>;

const STEP_TO_UI: Record<StepStatusWire, GcpStepStatusValue> = {
  COMPLETED: 'COMPLETED',
  FAIL: 'FAIL',
  IN_PROGRESS: 'IN_PROGRESS',
  SKIP: 'SKIP',
  UNKNOWN: 'IN_PROGRESS',
};

const INSTALL_TO_UI: Record<InstallStatusWire, GcpInstallationStatusValue> = {
  COMPLETED: 'COMPLETED',
  FAIL: 'FAIL',
  IN_PROGRESS: 'IN_PROGRESS',
  SKIP: 'COMPLETED',
  UNKNOWN: 'IN_PROGRESS',
};

// swagger LastCheckInfoDto is 5-value (incl. SUCCESS); the UI LastCheckInfo is
// 4-value (no SUCCESS) — collapse SUCCESS→COMPLETED.
const LAST_CHECK_TO_UI: Record<LastCheckStatusWire, LastCheckInfo['status']> = {
  NEVER_CHECKED: 'NEVER_CHECKED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  SUCCESS: 'COMPLETED',
  FAILED: 'FAILED',
};

const toUiStep = (step: WireStep): GcpStepStatus => ({
  status: STEP_TO_UI[step.status ?? 'UNKNOWN'],
  guide: step.guide ?? null,
});

const toUiResource = (r: WireResource): GcpResourceStatus => ({
  resourceId: r.resource_id ?? '',
  resourceName: r.resource_name,
  resourceType: 'CLOUD_SQL',
  resourceSubType: null,
  installationStatus: INSTALL_TO_UI[r.installation_status ?? 'UNKNOWN'],
  serviceSideSubnetCreation: toUiStep(r.service_side_subnet_creation ?? {}),
  serviceSideTerraformApply: toUiStep(r.service_side_terraform_apply ?? {}),
  bdcSideTerraformApply: toUiStep(r.bdc_side_terraform_apply ?? {}),
});

/** Build the Step-4 UI view from the validated GCP installation-status wire response. */
export const buildGcpInstallationStatus = (
  wire: WireResponse,
): GcpInstallationStatusResponse => {
  const resources = (wire.resources ?? []).map(toUiResource);
  const totalCount = resources.length;
  const completedCount = resources.filter((r) => r.installationStatus === 'COMPLETED').length;
  const lastCheckStatus = wire.last_check?.status;

  return {
    lastCheck: {
      status: LAST_CHECK_TO_UI[lastCheckStatus ?? 'NEVER_CHECKED'],
      ...(wire.last_check?.checked_at && { checkedAt: wire.last_check.checked_at }),
      ...(wire.last_check?.fail_reason && { failReason: wire.last_check.fail_reason }),
    },
    summary: {
      totalCount,
      completedCount,
      allCompleted: totalCount > 0 && completedCount === totalCount,
    },
    resources,
  };
};
