import type {
  AwsInstallationStatusResponse,
  AwsResourceInstallationStatus,
  CloudStepStatus,
  LastCheckStatus,
} from '@/lib/bff/types/aws';
import type {
  AwsInstallationStatus,
  InstallationDisplayStatus,
  V1LastCheck,
  V1ScriptStatus,
  V1ServiceScript,
} from '@/lib/types';

/**
 * Map the swagger `AwsInstallationStatusResponse` (camel domain from the proxy
 * boundary) → the Step-4 UI domain (`AwsInstallationStatus`).
 *
 * The swagger is resource-centric (`resources[].installationStatus` + three
 * per-resource step DTOs + `terraformExecutionRoleVerify`); the UI domain is
 * script-centric (`serviceScripts[]` + `bdcStatus` + `hasExecutionPermission`).
 * Each swagger resource becomes one service script so the pipeline aggregation
 * (`aggregateServiceScripts`) reports per-resource progress, and the table joins
 * by `resourceId`. The BDC card aggregates the two BDC step DTOs across resources.
 *
 * NOTE(L3): the swagger 5-value `installationStatus`/step enum (incl. UNKNOWN)
 * is narrowed to the UI's `V1ScriptStatus` / `InstallationDisplayStatus` here.
 * The richer per-step swagger detail (service vs bdc-service vs bdc-common) is
 * collapsed; a full resources[]+step-cell rebind is the deferred UI follow-up
 * (Spec G §6.6, out of cloud-status data-layer scope).
 */

const STEP_TO_SCRIPT_STATUS: Record<CloudStepStatus, V1ScriptStatus> = {
  COMPLETED: 'COMPLETED',
  FAIL: 'FAILED',
  IN_PROGRESS: 'INSTALLING',
  SKIP: 'COMPLETED',
  UNKNOWN: 'PENDING',
};

const LAST_CHECK_TO_UI: Record<LastCheckStatus, V1LastCheck['status']> = {
  NEVER_CHECKED: 'IN_PROGRESS',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'SUCCESS',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
};

// Worst-wins aggregate across step statuses for the BDC card.
const aggregateStepStatus = (statuses: CloudStepStatus[]): V1ScriptStatus => {
  const mapped = statuses.map((s) => STEP_TO_SCRIPT_STATUS[s]);
  if (mapped.some((s) => s === 'FAILED')) return 'FAILED';
  if (mapped.some((s) => s === 'INSTALLING')) return 'INSTALLING';
  if (mapped.some((s) => s === 'PENDING')) return 'PENDING';
  return mapped.length > 0 && mapped.every((s) => s === 'COMPLETED') ? 'COMPLETED' : 'PENDING';
};

const toDisplayStatus = (status: CloudStepStatus): InstallationDisplayStatus =>
  status === 'COMPLETED' ? 'COMPLETED' : 'NOT_INSTALLED';

const toServiceScript = (resource: AwsResourceInstallationStatus): V1ServiceScript => ({
  scriptId: resource.resourceId,
  scriptName: resource.resourceName ?? resource.resourceId,
  terraformScriptName: resource.resourceName ?? resource.resourceId,
  status: STEP_TO_SCRIPT_STATUS[resource.serviceTerraform.status],
  resourceCount: 1,
  resources: [
    {
      resourceId: resource.resourceId,
      resource_id: resource.resourceId,
      type: '',
      name: resource.resourceName ?? resource.resourceId,
      installationDisplayStatus: toDisplayStatus(resource.installationStatus),
    },
  ],
});

export const transformAwsInstallationStatus = (
  response: AwsInstallationStatusResponse,
): AwsInstallationStatus => {
  const resources = response.resources ?? [];
  const serviceScripts = resources.map(toServiceScript);
  const bdcStatus = aggregateStepStatus(
    resources.flatMap((r) => [r.bdcServiceTerraform.status, r.bdcCommonTerraform.status]),
  );

  const roleVerify = response.terraformExecutionRoleVerify;
  const lastCheck: V1LastCheck = {
    status: LAST_CHECK_TO_UI[response.lastCheck.status],
    ...(response.lastCheck.checkedAt && { checkedAt: response.lastCheck.checkedAt }),
    ...(response.lastCheck.failReason && { failReason: response.lastCheck.failReason }),
  };

  return {
    hasExecutionPermission: roleVerify?.status === 'COMPLETED',
    ...(roleVerify?.roleArn && { executionRoleArn: roleVerify.roleArn }),
    serviceScripts,
    bdcStatus: { status: bdcStatus },
    lastCheck,
    actionSummary: {
      serviceActionRequired: serviceScripts.some((s) => s.status !== 'COMPLETED'),
      bdcInstallationRequired: bdcStatus !== 'COMPLETED',
    },
  };
};
