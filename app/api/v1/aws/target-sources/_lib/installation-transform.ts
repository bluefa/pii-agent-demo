import type { z } from 'zod';
import type { schemas } from '@/lib/generated/install-v1';
import type {
  AwsInstallationStatus,
  AwsInstallResourceStatus,
  AwsInstallStepState,
  AwsInstallStepValue,
  V1LastCheck,
} from '@/lib/types';

/**
 * Map the swagger `AwsInstallationStatusResponse` (snake wire, zod-codegen) →
 * the Step-4 UI domain (`AwsInstallationStatus`).
 *
 * The domain mirrors the swagger 1:1: resource-centric `resources[]` with the
 * three per-resource step DTOs (`service_terraform` / `bdc_service_terraform` /
 * `bdc_common_terraform`), plus `terraform_execution_role_verify` and
 * `last_check`. The loose codegen leaves step statuses as plain strings, so
 * values outside the swagger enum are normalized to 'UNKNOWN'.
 */

type WireResponse = z.infer<typeof schemas.AwsInstallationStatusResponse>;
type WireResource = NonNullable<WireResponse['resources']>[number];
type WireStep = WireResource['service_terraform'];
type LastCheckStatus = NonNullable<NonNullable<WireResponse['last_check']>['status']>;

const STEP_VALUES: readonly AwsInstallStepValue[] = [
  'COMPLETED',
  'FAIL',
  'IN_PROGRESS',
  'SKIP',
  'BDC_INSTALL_REQUIRED',
  'UNKNOWN',
];

const toStepValue = (status: string | null | undefined): AwsInstallStepValue =>
  (STEP_VALUES as readonly string[]).includes(status ?? '')
    ? (status as AwsInstallStepValue)
    : 'UNKNOWN';

const toStepState = (step: WireStep): AwsInstallStepState => ({
  status: toStepValue(step?.status),
  guide: step?.guide ?? null,
});

const LAST_CHECK_TO_UI: Record<LastCheckStatus, V1LastCheck['status']> = {
  NEVER_CHECKED: 'IN_PROGRESS',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'SUCCESS',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
};

const toResource = (resource: WireResource): AwsInstallResourceStatus => ({
  resourceId: resource.resource_id ?? '',
  resourceName: resource.resource_name ?? null,
  installationStatus: toStepValue(resource.installation_status),
  serviceTerraform: toStepState(resource.service_terraform),
  bdcServiceTerraform: toStepState(resource.bdc_service_terraform),
  bdcCommonTerraform: toStepState(resource.bdc_common_terraform),
});

export const transformAwsInstallationStatus = (
  response: WireResponse,
): AwsInstallationStatus => {
  const lastCheckRaw = response.last_check;
  const roleVerify = response.terraform_execution_role_verify;

  return {
    lastCheck: {
      status: LAST_CHECK_TO_UI[lastCheckRaw?.status ?? 'IN_PROGRESS'] ?? 'IN_PROGRESS',
      ...(lastCheckRaw?.checked_at && { checkedAt: lastCheckRaw.checked_at }),
      ...(lastCheckRaw?.fail_reason && { failReason: lastCheckRaw.fail_reason }),
    },
    roleVerify: {
      status: toStepValue(roleVerify?.status),
      roleArn: roleVerify?.role_arn ?? null,
    },
    resources: (response.resources ?? []).map(toResource),
  };
};

const isStepSettled = (step: AwsInstallStepState): boolean =>
  step.status === 'COMPLETED' || step.status === 'SKIP';

/**
 * Install is complete when every resource's three steps are COMPLETED/SKIP —
 * plus a verified execution role unless the target runs in manual-install mode.
 */
export const isAwsInstallationComplete = (
  status: AwsInstallationStatus,
  manualInstall: boolean,
): boolean =>
  status.resources.length > 0 &&
  status.resources.every(
    (r) =>
      isStepSettled(r.serviceTerraform) &&
      isStepSettled(r.bdcServiceTerraform) &&
      isStepSettled(r.bdcCommonTerraform),
  ) &&
  (manualInstall ||
    status.roleVerify.status === 'COMPLETED' ||
    status.roleVerify.status === 'SKIP');
