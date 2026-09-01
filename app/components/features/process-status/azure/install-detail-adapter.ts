import type { z } from 'zod';
import type { schemas } from '@/lib/generated/install-v1';
import {
  normalizeInstallStepValue,
  type InstallDetailResource,
  type InstallLastCheck,
  type InstallStepCell,
  type InstallStepValue,
} from '@/app/components/features/process-status/install-status-detail/model';
import { INSTALL_COPY } from '@/app/components/features/process-status/install-copy';

/**
 * Azure installation-status wire (`AzureInstallationStatusResponse`, zod-codegen
 * snake) → shared InstallStatusDetail model.
 *
 * - The PE-approval step keeps its own domain wording as pill-label overrides
 *   on top of the shared status buckets (승인 완료 / Azure Portal에서 승인 필요 /
 *   BDC측 재신청 필요 / BDC측 확인 필요).
 * - The two VM-only steps read null for non-VM resources → SKIP (해당 없음).
 */

type WireResponse = z.infer<typeof schemas.AzureInstallationStatusResponse>;
type WireResource = NonNullable<WireResponse['resources']>[number];
type WireStep = z.infer<typeof schemas.CloudInstallationStepStatusDto> | null | undefined;
type LastCheckStatus = NonNullable<NonNullable<WireResponse['last_check']>['status']>;

const LAST_CHECK_TO_UI: Record<LastCheckStatus, InstallLastCheck['status']> = {
  NEVER_CHECKED: 'IN_PROGRESS',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'SUCCESS',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
};

/** The Azure wording in one language — `buildAzureInstallDetail` takes it as a parameter. */
export type AzureInstallCopy = (typeof INSTALL_COPY)['ko']['azure'];

// PE-approval pill wording per status bucket (PRIVATE_ENDPOINT_STATUS_LABELS
// semantics on the shared step enum).
const peLabels = (t: AzureInstallCopy): Partial<Record<InstallStepValue, string>> => ({
  COMPLETED: t.peApproved,
  IN_PROGRESS: t.pePending,
  FAIL: t.peFailed,
  UNKNOWN: t.peUnknown,
});

const toCell = (step: WireStep): InstallStepCell => ({
  status: normalizeInstallStepValue(step?.status),
  guide: step?.guide ?? null,
});

/** VM-only steps: a missing DTO means the step does not apply → SKIP. */
const toVmCell = (step: WireStep): InstallStepCell =>
  step ? toCell(step) : { status: 'SKIP', guide: null };

const toPeCell = (resource: WireResource, t: AzureInstallCopy): InstallStepCell => {
  const pe = resource.service_side_private_endpoint_approval;
  const status = normalizeInstallStepValue(pe?.status);
  const label = peLabels(t)[status];
  return {
    status,
    ...(label && { label }),
    guide: pe?.guide ?? null,
  };
};

export interface AzureInstallDetail {
  lastCheck: InstallLastCheck;
  resources: InstallDetailResource[];
}

export const buildAzureInstallDetail = (
  wire: WireResponse,
  t: AzureInstallCopy = INSTALL_COPY.ko.azure,
): AzureInstallDetail => ({
  lastCheck: {
    status: LAST_CHECK_TO_UI[wire.last_check?.status ?? 'IN_PROGRESS'] ?? 'IN_PROGRESS',
    ...(wire.last_check?.checked_at && { checkedAt: wire.last_check.checked_at }),
    ...(wire.last_check?.fail_reason && { failReason: wire.last_check.fail_reason }),
    ...(wire.last_check?.installation_status_unavailable && { unavailable: true }),
  },
  resources: (wire.resources ?? []).map((r) => ({
    resourceId: r.resource_id ?? '',
    resourceName: r.resource_name ?? null,
    rollup: { status: normalizeInstallStepValue(r.installation_status), guide: null },
    cells: {
      pe: toPeCell(r, t),
      vmSubnet: toVmCell(r.azure_virtual_machine_subnet_creation),
      vmApply: toVmCell(r.azure_virtual_machine_terraform_apply),
      bdc: toCell(r.bdc_side_terraform_apply),
    },
  })),
});
