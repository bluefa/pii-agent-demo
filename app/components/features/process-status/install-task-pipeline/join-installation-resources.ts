import type {
  GcpInstallationStatusValue,
  GcpResourceStatus,
} from '@/app/api/_lib/v1-types';
import type { ConfirmedResource } from '@/lib/types/resources';
import type { DatabaseType } from '@/lib/types';

export interface InstallResourceRow {
  resourceId: string;
  databaseType: DatabaseType | null;
  region: string | null;
  databaseName: string | null;
  installationStatus: GcpInstallationStatusValue;
  source: GcpResourceStatus;
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
