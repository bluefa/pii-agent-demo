import type { GcpInstallationStatusValue } from '@/app/api/_lib/v1-types';
import type { InstallResourceRow } from '@/app/components/features/process-status/install-task-pipeline/join-installation-resources';
import type { ConfirmedResource } from '@/lib/types/resources';
import type { AwsInstallationStatus, InstallationDisplayStatus } from '@/lib/types';

// AWS has no GCP-style per-step breakdown. Each resource carries an
// `installationDisplayStatus` inside its owning service script — COMPLETED maps
// to the shared COMPLETED status; anything else is still in flight (IN_PROGRESS).
// AWS install status surfaces FAIL only at the aggregate pipeline level, so no
// per-row FAIL is produced here.
const awsStatusFromDisplay = (
  display: InstallationDisplayStatus | undefined,
): GcpInstallationStatusValue =>
  display === 'COMPLETED' ? 'COMPLETED' : 'IN_PROGRESS';

// Flatten `serviceScripts[].resources` into a per-resource install-status map.
const buildDisplayStatusMap = (
  status: AwsInstallationStatus,
): Map<string, InstallationDisplayStatus> => {
  const map = new Map<string, InstallationDisplayStatus>();
  for (const script of status.serviceScripts) {
    for (const resource of script.resources) {
      if (resource.installationDisplayStatus) {
        map.set(resource.resourceId, resource.installationDisplayStatus);
      }
    }
  }
  return map;
};

// Drive rows from the confirmed integration (Azure pattern); look up each
// resource's install status from the AWS service-script resource list.
export const joinAwsResources = (
  status: AwsInstallationStatus,
  confirmed: readonly ConfirmedResource[],
): InstallResourceRow[] => {
  const displayStatusById = buildDisplayStatusMap(status);

  return confirmed.map((resource) => ({
    resourceId: resource.resourceId,
    databaseType: resource.databaseType,
    region: resource.region,
    databaseName: resource.resourceName,
    installationStatus: awsStatusFromDisplay(displayStatusById.get(resource.resourceId)),
    source: null,
  }));
};
