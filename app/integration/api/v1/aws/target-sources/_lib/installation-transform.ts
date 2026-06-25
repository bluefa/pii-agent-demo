import type { z } from 'zod';
import type { schemas } from '@/lib/generated/install-v1';
import type {
  AwsInstallationStatus,
  InstallationDisplayStatus,
  V1LastCheck,
  V1ScriptStatus,
  V1ServiceScript,
} from '@/lib/types';

/**
 * Map the swagger `AwsInstallationStatusResponse` (snake wire, zod-codegen) →
 * the Step-4 UI domain (`AwsInstallationStatus`).
 *
 * The swagger is resource-centric (`resources[].installation_status` + three
 * per-resource step DTOs + `terraform_execution_role_verify`); the UI domain is
 * script-centric (`serviceScripts[]` + `bdcStatus` + `hasExecutionPermission`).
 * Each swagger resource becomes one service script so the pipeline aggregation
 * (`aggregateServiceScripts`) reports per-resource progress, and the table joins
 * by `resource_id`. The BDC card aggregates the two BDC step DTOs across resources.
 *
 * NOTE(L3): the swagger 5-value `installation_status`/step enum (incl. UNKNOWN)
 * is narrowed to the UI's `V1ScriptStatus` / `InstallationDisplayStatus` here.
 * The richer per-step swagger detail (service vs bdc-service vs bdc-common) is
 * collapsed; a full resources[]+step-cell rebind is the deferred UI follow-up
 * (Spec G §6.6, out of cloud-status data-layer scope).
 */

type CloudStepStatus = NonNullable<
  z.infer<typeof schemas.AwsResourceInstallationStatusDto>['installation_status']
>;
type LastCheckStatus = NonNullable<
  z.infer<typeof schemas.AwsInstallationStatusResponse>['last_check']
>['status'];

type AwsResourceDto = NonNullable<
  z.infer<typeof schemas.AwsInstallationStatusResponse>['resources']
>[number];

const STEP_TO_SCRIPT_STATUS: Record<CloudStepStatus, V1ScriptStatus> = {
  COMPLETED: 'COMPLETED',
  FAIL: 'FAILED',
  IN_PROGRESS: 'INSTALLING',
  SKIP: 'COMPLETED',
  UNKNOWN: 'PENDING',
};

const LAST_CHECK_TO_UI: Record<NonNullable<LastCheckStatus>, V1LastCheck['status']> = {
  NEVER_CHECKED: 'IN_PROGRESS',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'SUCCESS',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
};

// Worst-wins aggregate across step statuses for the BDC card.
const aggregateStepStatus = (statuses: (CloudStepStatus | undefined)[]): V1ScriptStatus => {
  const mapped = statuses
    .filter((s): s is CloudStepStatus => s !== undefined)
    .map((s) => STEP_TO_SCRIPT_STATUS[s]);
  if (mapped.some((s) => s === 'FAILED')) return 'FAILED';
  if (mapped.some((s) => s === 'INSTALLING')) return 'INSTALLING';
  if (mapped.some((s) => s === 'PENDING')) return 'PENDING';
  return mapped.length > 0 && mapped.every((s) => s === 'COMPLETED') ? 'COMPLETED' : 'PENDING';
};

const toDisplayStatus = (status: CloudStepStatus | undefined): InstallationDisplayStatus =>
  status === 'COMPLETED' ? 'COMPLETED' : 'NOT_INSTALLED';

const toServiceScript = (resource: AwsResourceDto): V1ServiceScript => ({
  scriptId: resource.resource_id,
  scriptName: resource.resource_name ?? resource.resource_id ?? '',
  terraformScriptName: resource.resource_name ?? resource.resource_id ?? '',
  status: STEP_TO_SCRIPT_STATUS[resource.service_terraform?.status ?? 'UNKNOWN'],
  resourceCount: 1,
  resources: [
    {
      resourceId: resource.resource_id ?? '',
      resource_id: resource.resource_id,
      type: '',
      name: resource.resource_name ?? resource.resource_id ?? '',
      installationDisplayStatus: toDisplayStatus(resource.installation_status),
    },
  ],
});

export const transformAwsInstallationStatus = (
  response: z.infer<typeof schemas.AwsInstallationStatusResponse>,
): AwsInstallationStatus => {
  const resources = response.resources ?? [];
  const serviceScripts = resources.map(toServiceScript);
  const bdcStatus = aggregateStepStatus(
    resources.flatMap((r) => [r.bdc_service_terraform?.status, r.bdc_common_terraform?.status]),
  );

  const roleVerify = response.terraform_execution_role_verify;
  const lastCheckRaw = response.last_check;
  const lastCheck: V1LastCheck = {
    status: LAST_CHECK_TO_UI[lastCheckRaw?.status ?? 'IN_PROGRESS'] ?? 'IN_PROGRESS',
    ...(lastCheckRaw?.checked_at && { checkedAt: lastCheckRaw.checked_at }),
    ...(lastCheckRaw?.fail_reason && { failReason: lastCheckRaw.fail_reason }),
  };

  return {
    hasExecutionPermission: roleVerify?.status === 'COMPLETED',
    ...(roleVerify?.role_arn && { executionRoleArn: roleVerify.role_arn }),
    serviceScripts,
    bdcStatus: { status: bdcStatus },
    lastCheck,
    actionSummary: {
      serviceActionRequired: serviceScripts.some((s) => s.status !== 'COMPLETED'),
      bdcInstallationRequired: bdcStatus !== 'COMPLETED',
    },
  };
};
