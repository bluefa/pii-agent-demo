import type {
  GcpInstallationStatusValue,
  GcpResourceStatus,
} from '@/app/api/_lib/v1-types';
import type { ConfirmedResource } from '@/lib/types/resources';
import type { AzureV1Resource } from '@/lib/types/azure';
import type { UnifiedInstallResource } from '@/app/components/features/process-status/azure/AzureInstallationInline';
import type { DatabaseType } from '@/lib/types';
import { getResourceDisplayName } from '@/lib/resource';

// GCP 리소스의 기본 리전 (v15: asia-northeast3). 확정 정보에 리전이 있으면 그것을 우선한다.
const GCP_DEFAULT_REGION = 'asia-northeast3';

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
    // v15: 전체 경로(projects/…/instances/…) 대신 짧은 이름을 표시한다.
    // 확정 정보의 Resource Name을 우선하고, 없으면 resourceId의 마지막 세그먼트를 쓴다.
    const databaseName =
      matched?.resourceName ?? getResourceDisplayName({ resourceId: r.resourceName ?? r.resourceId });
    return {
      resourceId: r.resourceId,
      databaseType: matched?.databaseType ?? null,
      region: matched?.region ?? GCP_DEFAULT_REGION,
      databaseName,
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
