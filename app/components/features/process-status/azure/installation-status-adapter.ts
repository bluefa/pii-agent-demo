/**
 * Azure installation-status adapter — transforms the zod-codegen snake wire type
 * to the Step-4 UI domain (`AzureV1InstallationStatus`, lib/types/azure).
 *
 * Pure CSR function: input is an already-validated zod wire type; output is a
 * camel view used by AzureInstallationInline.
 *
 * Genuine reshapes performed here (not rename-only):
 *   - Narrows 5-value LastCheckInfoDto status → 3-value AzureV1LastCheck status.
 *   - Narrows PrivateEndpointDetail.status (free string) → PrivateEndpointStatus enum.
 *   - Reads load_balancer opaquely (ADR-019 D2.3 — may have arbitrary Azure keys).
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

const PRIVATE_ENDPOINT_STATUSES: readonly PrivateEndpointStatus[] = [
  'NOT_REQUESTED',
  'PENDING_APPROVAL',
  'APPROVED',
  'REJECTED',
];

// swagger PrivateEndpointDetail.status is a free string; map known UI enum
// values, otherwise fall back to NOT_REQUESTED (do not narrow the wire type).
const toPrivateEndpointStatus = (status?: string): PrivateEndpointStatus =>
  PRIVATE_ENDPOINT_STATUSES.find((s) => s === status) ?? 'NOT_REQUESTED';

const asBoolean = (value: unknown): boolean => value === true;
const asString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

const toUiResource = (r: WireResource): AzureV1Resource => {
  const lb = r.vm_installation?.load_balancer;
  return {
    resourceId: r.resource_id ?? '',
    resourceName: r.resource_name ?? r.resource_id ?? '',
    resourceType: r.resource_type ?? '',
    ...(r.private_endpoint && {
      privateEndpoint: {
        id: r.private_endpoint.id ?? '',
        name: r.private_endpoint.name ?? '',
        status: toPrivateEndpointStatus(r.private_endpoint.status),
      },
    }),
    ...(r.vm_installation && {
      vmInstallation: {
        subnetExists: r.vm_installation.subnet_exists,
        // load_balancer is an opaque object — read the conventional keys.
        loadBalancer: {
          installed: asBoolean(lb?.installed),
          ...(asString(lb?.name) !== undefined && { name: asString(lb?.name) }),
        },
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
