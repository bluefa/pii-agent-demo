import type {
  GcpInstallationStatusResponse as GcpWireResponse,
  GcpResourceInstallationStatus as GcpWireResource,
} from '@/lib/bff/types/gcp';
import type { CloudStepStatus } from '@/lib/bff/types/aws';
import type {
  GcpInstallationStatusResponse,
  GcpInstallationStatusValue,
  GcpResourceStatus,
  GcpStepStatus,
  GcpStepStatusValue,
  LastCheckInfo,
} from '@/app/api/_lib/v1-types';
import type { LastCheckStatus } from '@/lib/bff/types/aws';

/**
 * Map the swagger `GcpInstallationStatusResponse` (camel domain from the proxy
 * boundary) → the Step-4 UI domain (`GcpInstallationStatusResponse`,
 * v1-types).
 *
 * Swagger drops `summary`, `resource_type` and `resource_sub_type` and uses the
 * 5-value step/installation enum (incl. UNKNOWN). The UI domain still carries a
 * `summary` (computed here from `resources`) and types `resourceType` /
 * `installationStatus` with the narrower legacy unions, so the 5-value statuses
 * are narrowed below (SKIP→COMPLETED, UNKNOWN→IN_PROGRESS) and `resourceType`
 * defaults to CLOUD_SQL.
 *
 * NOTE(L3): `resourceType`/`resourceSubType` and the UNKNOWN/SKIP collapse are
 * type-satisfaction stopgaps for the existing UI helpers (which read neither
 * resourceType nor the dropped fields). A 5-value-enum + drop-summary UI rebind
 * is the deferred follow-up (Spec G §6.6).
 */

const STEP_TO_UI: Record<CloudStepStatus, GcpStepStatusValue> = {
  COMPLETED: 'COMPLETED',
  FAIL: 'FAIL',
  IN_PROGRESS: 'IN_PROGRESS',
  SKIP: 'SKIP',
  UNKNOWN: 'IN_PROGRESS',
};

const INSTALL_TO_UI: Record<CloudStepStatus, GcpInstallationStatusValue> = {
  COMPLETED: 'COMPLETED',
  FAIL: 'FAIL',
  IN_PROGRESS: 'IN_PROGRESS',
  SKIP: 'COMPLETED',
  UNKNOWN: 'IN_PROGRESS',
};

// swagger LastCheckInfoDto is 5-value (incl. SUCCESS); the UI LastCheckInfo is
// 4-value (no SUCCESS) — collapse SUCCESS→COMPLETED.
const LAST_CHECK_TO_UI: Record<LastCheckStatus, LastCheckInfo['status']> = {
  NEVER_CHECKED: 'NEVER_CHECKED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  SUCCESS: 'COMPLETED',
  FAILED: 'FAILED',
};

const toUiStep = (step: { status: CloudStepStatus; guide?: string }): GcpStepStatus => ({
  status: STEP_TO_UI[step.status],
  guide: step.guide ?? null,
});

const toUiResource = (r: GcpWireResource): GcpResourceStatus => ({
  resourceId: r.resourceId,
  resourceName: r.resourceName,
  resourceType: 'CLOUD_SQL',
  resourceSubType: null,
  installationStatus: INSTALL_TO_UI[r.installationStatus],
  serviceSideSubnetCreation: toUiStep(r.serviceSideSubnetCreation),
  serviceSideTerraformApply: toUiStep(r.serviceSideTerraformApply),
  bdcSideTerraformApply: toUiStep(r.bdcSideTerraformApply),
});

export const transformInstallationStatus = (
  response: GcpWireResponse,
): GcpInstallationStatusResponse => {
  const resources = (response.resources ?? []).map(toUiResource);
  const totalCount = resources.length;
  const completedCount = resources.filter((r) => r.installationStatus === 'COMPLETED').length;

  return {
    lastCheck: {
      status: LAST_CHECK_TO_UI[response.lastCheck.status],
      ...(response.lastCheck.checkedAt && { checkedAt: response.lastCheck.checkedAt }),
      ...(response.lastCheck.failReason && { failReason: response.lastCheck.failReason }),
    },
    summary: {
      totalCount,
      completedCount,
      allCompleted: totalCount > 0 && completedCount === totalCount,
    },
    resources,
  };
};
