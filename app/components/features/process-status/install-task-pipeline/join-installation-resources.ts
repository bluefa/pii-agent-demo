import type {
  GcpInstallationStatusValue,
  GcpResourceStatus,
} from '@/app/api/_lib/v1-types';
import type { ConfirmedResource } from '@/lib/types/resources';
import type { AzureV1Resource } from '@/lib/types/azure';
import type { UnifiedInstallResource } from '@/app/components/features/process-status/azure/AzureInstallationInline';
import type { DatabaseType } from '@/lib/types';

export interface InstallResourceRow {
  resourceId: string;
  databaseType: DatabaseType | null;
  region: string | null;
  databaseName: string | null;
  installationStatus: GcpInstallationStatusValue;
  /**
   * GCP per-step source used by the install-task detail modal. Azure has no
   * equivalent step breakdown and renders no detail modal, so Azure rows carry
   * `null` here.
   */
  source: GcpResourceStatus | null;
}

export const joinGcpResources = (
  installation: readonly GcpResourceStatus[],
  confirmed: readonly ConfirmedResource[],
): InstallResourceRow[] => {
  const confirmedById = new Map<string, ConfirmedResource>(
    confirmed.map((r) => [r.resourceId, r]),
  );

  return installation.map((r) => {
    const matched = confirmedById.get(r.resourceId);
    return {
      resourceId: r.resourceId,
      databaseType: matched?.databaseType ?? null,
      region: null,
      databaseName: r.resourceName ?? null,
      installationStatus: r.installationStatus,
      source: r,
    };
  });
};

type AzureInstallResource = AzureV1Resource | UnifiedInstallResource;

const isUnified = (r: AzureInstallResource): r is UnifiedInstallResource =>
  'step' in r;

// Azure has no GCP-style per-step breakdown — collapse its per-resource
// lifecycle `step` to the shared installation status. COMPLETED → COMPLETED;
// PE_REJECTED → FAIL; everything else is still in flight → IN_PROGRESS.
const azureStatusFromStep = (
  r: AzureInstallResource,
): GcpInstallationStatusValue => {
  if (!isUnified(r)) return 'IN_PROGRESS';
  if (r.step === 'COMPLETED') return 'COMPLETED';
  if (r.step === 'PE_REJECTED') return 'FAIL';
  return 'IN_PROGRESS';
};

const azureResourceId = (r: AzureInstallResource): string =>
  isUnified(r) ? r.id : r.resourceId;

const azureResourceName = (r: AzureInstallResource): string =>
  isUnified(r) ? r.name : r.resourceName;

export const joinAzureResources = (
  installation: readonly AzureInstallResource[],
  confirmed: readonly ConfirmedResource[],
): InstallResourceRow[] => {
  const confirmedById = new Map<string, ConfirmedResource>(
    confirmed.map((r) => [r.resourceId, r]),
  );

  return installation.map((r) => {
    const resourceId = azureResourceId(r);
    const matched = confirmedById.get(resourceId);
    return {
      resourceId,
      databaseType: matched?.databaseType ?? null,
      region: matched?.region ?? null,
      databaseName: azureResourceName(r) ?? null,
      installationStatus: azureStatusFromStep(r),
      source: null,
    };
  });
};
