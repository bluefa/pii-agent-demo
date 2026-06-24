/**
 * Azure installation-status transform (ADR-019 Spec G).
 *
 * Maps the swagger `AzureInstallationStatusResponse` (camel domain from the
 * proxy boundary) → the Step-4 UI domain (`AzureV1InstallationStatus`).
 * `vm_installation` is embedded per resource in the swagger response, so the
 * legacy separate VM merge (vmGetInstallationStatus) is gone.
 */

import type {
  AzureInstallationStatusResponse,
  AzureResourceStatus,
} from '@/lib/bff/types/azure';
import type { LastCheckStatus } from '@/lib/bff/types/aws';
import type {
  AzureV1InstallationStatus,
  AzureV1LastCheck,
  AzureV1Resource,
  PrivateEndpointStatus,
} from '@/lib/types/azure';

// swagger LastCheckInfoDto is 5-value; the UI AzureV1LastCheck is 3-value.
const LAST_CHECK_TO_UI: Record<LastCheckStatus, AzureV1LastCheck['status']> = {
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

const toUiResource = (r: AzureResourceStatus): AzureV1Resource => {
  const lb = r.vmInstallation?.loadBalancer;
  return {
    resourceId: r.resourceId,
    resourceName: r.resourceName ?? r.resourceId,
    resourceType: r.resourceType ?? '',
    ...(r.privateEndpoint && {
      privateEndpoint: {
        id: r.privateEndpoint.id ?? '',
        name: r.privateEndpoint.name ?? '',
        status: toPrivateEndpointStatus(r.privateEndpoint.status),
      },
    }),
    ...(r.vmInstallation && {
      vmInstallation: {
        subnetExists: r.vmInstallation.subnetExists,
        // load_balancer is an opaque object — read the conventional keys.
        loadBalancer: {
          installed: asBoolean(lb?.installed),
          ...(asString(lb?.name) !== undefined && { name: asString(lb?.name) }),
        },
      },
    }),
  };
};

export const buildV1Response = (
  status: AzureInstallationStatusResponse,
): AzureV1InstallationStatus => ({
  lastCheck: {
    status: LAST_CHECK_TO_UI[status.lastCheck.status],
    ...(status.lastCheck.checkedAt && { checkedAt: status.lastCheck.checkedAt }),
    ...(status.lastCheck.failReason && { failReason: status.lastCheck.failReason }),
  },
  resources: (status.resources ?? []).map(toUiResource),
});
