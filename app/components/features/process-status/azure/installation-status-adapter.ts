/**
 * Azure installation-status adapter — transforms the zod-codegen snake wire type
 * to the Step-4 UI domain (`AzureV1InstallationStatus`, lib/types/azure).
 *
 * Pure CSR function: input is an already-validated zod wire type; output is a
 * camel view used by AzureInstallationInline.
 *
 * Genuine reshapes performed here (not rename-only):
 *   - Narrows 5-value LastCheckInfoDto status → 3-value AzureV1LastCheck status.
 *   - Collapses the per-resource step DTOs (service_side_private_endpoint_approval,
 *     azure_virtual_machine_subnet_creation, azure_virtual_machine_terraform_apply)
 *     into the existing Step-4 UI domain: step status → PrivateEndpointStatus /
 *     subnetExists / loadBalancer.installed booleans.
 *   - Provides defaults for optional fields.
 */

import type { z } from 'zod';
import type { schemas } from '@/lib/generated/install-v1';
import type {
  AzureV1InstallationStatus,
  AzureV1LastCheck,
  AzureV1Resource,
  PrivateEndpointStatus,
} from '@/lib/types/azure';

type WireResponse = z.infer<typeof schemas.AzureInstallationStatusResponse>;
type WireResource = NonNullable<WireResponse['resources']>[number];
type LastCheckStatusWire = NonNullable<NonNullable<WireResponse['last_check']>['status']>;

// swagger LastCheckInfoDto is 5-value; the UI AzureV1LastCheck is 3-value.
const LAST_CHECK_TO_UI: Record<LastCheckStatusWire, AzureV1LastCheck['status']> = {
  NEVER_CHECKED: 'IN_PROGRESS',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'SUCCESS',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
};

// swagger step status (COMPLETED/FAIL/IN_PROGRESS/SKIP/BDC_INSTALL_REQUIRED) →
// UI PrivateEndpointStatus. SKIP/BDC_INSTALL_REQUIRED/unknown mean the approval
// flow has not been entered — NOT_REQUESTED.
const STEP_TO_PE_STATUS: Record<string, PrivateEndpointStatus> = {
  COMPLETED: 'APPROVED',
  IN_PROGRESS: 'PENDING_APPROVAL',
  FAIL: 'REJECTED',
};

const stepDone = (step?: { status?: string | null } | null): boolean =>
  step?.status === 'COMPLETED';

const toUiResource = (r: WireResource): AzureV1Resource => {
  const pe = r.service_side_private_endpoint_approval;
  const subnet = r.azure_virtual_machine_subnet_creation;
  const vmApply = r.azure_virtual_machine_terraform_apply;
  return {
    resourceId: r.resource_id ?? '',
    resourceName: r.resource_name ?? r.resource_id ?? '',
    resourceType: r.resource_type ?? '',
    ...(pe && {
      privateEndpoint: {
        id: pe.id ?? '',
        name: pe.name ?? '',
        status: STEP_TO_PE_STATUS[pe.status ?? ''] ?? 'NOT_REQUESTED',
      },
    }),
    ...((subnet || vmApply) && {
      vmInstallation: {
        subnetExists: stepDone(subnet),
        // The step wire no longer carries load-balancer identity — only the
        // terraform-apply outcome. installed == apply step completed.
        loadBalancer: { installed: stepDone(vmApply) },
      },
    }),
  };
};

/** Build the Step-4 UI view from the validated Azure installation-status wire response. */
export const buildAzureInstallationStatus = (
  wire: WireResponse,
): AzureV1InstallationStatus => ({
  lastCheck: {
    status: LAST_CHECK_TO_UI[wire.last_check?.status ?? 'NEVER_CHECKED'],
    ...(wire.last_check?.checked_at && { checkedAt: wire.last_check.checked_at }),
    ...(wire.last_check?.fail_reason && { failReason: wire.last_check.fail_reason }),
  },
  resources: (wire.resources ?? []).map(toUiResource),
});
