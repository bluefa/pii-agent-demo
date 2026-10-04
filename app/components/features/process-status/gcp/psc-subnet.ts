import type { ConfirmedIntegrationResourceInfo } from '@/lib/types';
import {
  isSettledInstallStatus,
  type InstallDetailResource,
} from '@/app/components/features/process-status/install-status-detail/model';

/**
 * One Regional Managed Proxy Subnet the service side has to create — one per
 * (host network, region), never per resource: that is GCP's own rule for
 * `--purpose=REGIONAL_MANAGED_PROXY`, and it is why the step's description says
 * 「Region마다 하나」.
 */
export interface PscSubnetTarget {
  hostProject: string;
  hostNetwork: string;
  region: string;
  subnetName: string;
  /** Approved rows this subnet serves — printed on the accordion head. */
  resourceCount: number;
  /** The gcloud command with everything but the CIDR filled in. */
  command: string;
}

/** Stands in for the CIDR the screen must not invent (a wrong range opens a wrong firewall). */
export const CIDR_PLACEHOLDER = '{CIDR /24}';

/**
 * `asia-northeast3` → `an3`, `europe-west2` → `ew2`, `us-central1` → `uc1`: first letter
 * of each word plus the trailing number. A region that does not fit the two-word shape
 * falls back to the bare region so the name is still unique.
 */
export const regionAbbr = (region: string): string => {
  const m = /^([a-z])[a-z]*-([a-z])[a-z]*?(\d+)$/.exec(region);
  return m ? `${m[1]}${m[2]}${m[3]}` : region.replace(/[^a-z0-9]/g, '');
};

export const pscSubnetCommand = (t: Pick<PscSubnetTarget, 'hostProject' | 'hostNetwork' | 'region' | 'subnetName'>): string =>
  [
    `gcloud compute networks subnets create ${t.subnetName} \\`,
    `  --project=${t.hostProject} \\`,
    `  --network=${t.hostNetwork} \\`,
    `  --region=${t.region} \\`,
    `  --range=${CIDR_PLACEHOLDER} \\`,
    '  --purpose=REGIONAL_MANAGED_PROXY \\',
    '  --role=ACTIVE \\',
    '  --enable-flow-logs \\',
    '  --enable-private-ip-google-access',
  ].join('\n');

/**
 * Resource ids whose 「PSC용 Subnet 생성」 cell is still open (not COMPLETED / SKIP) —
 * the rows the guide is for. Read off installation-status on either surface.
 */
export const pendingSubnetResourceIds = (resources: readonly InstallDetailResource[]): ReadonlySet<string> =>
  new Set(
    resources
      .filter((r) => r.cells.subnet !== undefined && !isSettledInstallStatus(r.cells.subnet.status))
      .map((r) => r.resourceId),
  );

/**
 * Groups confirmed rows into the subnets they need. A row missing any of the three
 * facts is skipped rather than guessed: the guide draws nothing it cannot fill in.
 *
 * `pending` narrows the guide to what is still to do: a Region whose rows all have
 * the subnet cell settled is left out (오너 09-16: 수행해야 하는 것만 보여준다).
 * Undefined means installation-status has not answered yet, so nothing is hidden.
 */
export const pscSubnetTargets = (
  rows: ConfirmedIntegrationResourceInfo[],
  pending?: ReadonlySet<string>,
): PscSubnetTarget[] => {
  const byKey = new Map<string, PscSubnetTarget>();
  const rowIds = new Map<string, string[]>();
  for (const row of rows) {
    // PSC is a Cloud SQL thing — a BigQuery dataset needs no proxy subnet, whatever
    // host facts its row happens to carry.
    if (row.resource_type !== 'GCP_SQL') continue;
    const hostProject = row.host_project?.trim();
    const hostNetwork = row.host_network?.trim();
    const region = row.database_region?.trim();
    if (!hostProject || !hostNetwork || !region) continue;
    const key = `${hostProject}|${hostNetwork}|${region}`;
    rowIds.set(key, [...(rowIds.get(key) ?? []), row.resource_id]);
    const hit = byKey.get(key);
    if (hit) {
      hit.resourceCount += 1;
      continue;
    }
    const subnetName = `pii-agent-proxy-subnet-${regionAbbr(region)}`;
    byKey.set(key, {
      hostProject,
      hostNetwork,
      region,
      subnetName,
      resourceCount: 1,
      command: pscSubnetCommand({ hostProject, hostNetwork, region, subnetName }),
    });
  }
  return [...byKey.entries()]
    .filter(([key]) => pending === undefined || (rowIds.get(key) ?? []).some((id) => pending.has(id)))
    .map(([, t]) => t);
};
