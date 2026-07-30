import type { z } from 'zod';
import type { schemas } from '@/lib/generated/install-v1';
import {
  normalizeInstallStepValue,
  type InstallDetailResource,
  type InstallLastCheck,
  type InstallStepCell,
} from '@/app/components/features/process-status/install-status-detail/model';

/**
 * GCP installation-status wire (`GcpInstallationStatusResponse`, zod-codegen
 * snake) → shared InstallStatusDetail model. Resource-centric 1:1: the three
 * per-resource step DTOs become cells keyed subnet/service/bdc; off-enum wire
 * statuses normalize to UNKNOWN (SKIP is preserved, unlike the legacy adapter).
 */

type WireResponse = z.infer<typeof schemas.GcpInstallationStatusResponse>;
type WireStep = z.infer<typeof schemas.CloudInstallationStepStatusDto> | null | undefined;
type LastCheckStatus = NonNullable<NonNullable<WireResponse['last_check']>['status']>;

const LAST_CHECK_TO_UI: Record<LastCheckStatus, InstallLastCheck['status']> = {
  NEVER_CHECKED: 'IN_PROGRESS',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'SUCCESS',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
};

const toCell = (step: WireStep): InstallStepCell => ({
  status: normalizeInstallStepValue(step?.status),
  guide: step?.guide ?? null,
});

export interface GcpInstallDetail {
  lastCheck: InstallLastCheck;
  resources: InstallDetailResource[];
}

export const buildGcpInstallDetail = (wire: WireResponse): GcpInstallDetail => ({
  lastCheck: {
    status: LAST_CHECK_TO_UI[wire.last_check?.status ?? 'IN_PROGRESS'] ?? 'IN_PROGRESS',
    ...(wire.last_check?.checked_at && { checkedAt: wire.last_check.checked_at }),
    ...(wire.last_check?.fail_reason && { failReason: wire.last_check.fail_reason }),
  },
  resources: (wire.resources ?? []).map((r) => ({
    resourceId: r.resource_id ?? '',
    resourceName: r.resource_name ?? null,
    rollup: { status: normalizeInstallStepValue(r.installation_status), guide: null },
    cells: {
      subnet: toCell(r.service_side_subnet_creation),
      service: toCell(r.service_side_terraform_apply),
      bdc: toCell(r.bdc_side_terraform_apply),
    },
  })),
});
