import { beforeEach, describe, expect, it } from 'vitest';
import { mockAws } from '@/lib/bff/mock/aws';
import { mockConfirm } from '@/lib/bff/mock/confirm';
import { setCurrentUser } from '@/lib/mock-data';
import { getStore } from '@/lib/mock-store';
import { isRdsCluster } from '@/lib/rds-instances';

/**
 * Steps 4~7 already list RDS clusters: the real-BFF captures behind the AWS demo targets hold
 * three `AWS_DB_CLUSTER` resources, so no synthetic cluster seed was added. What these guard is
 * that the TYPE survives each step's own read path — it is the only field the RDS Cluster tag
 * can key off, since a cluster's `database_type` says MySQL exactly like a single instance.
 */
const STEP_4 = '1008'; // INSTALLING — aws/installation-status, joined to confirmed on resource_id
const STEP_5 = '1010'; // WAITING_CONNECTION_TEST — confirmed-integration
const STEP_6 = '1011'; // CONNECTION_VERIFIED — confirmed-integration
const STEP_7 = '1012'; // INSTALLATION_COMPLETE — confirmed-integration

interface ConfirmedBody {
  resource_infos?: Array<{ resource_id: string; resource_type?: string | null }>;
}
interface InstallBody {
  resources?: Array<{ resource_id?: string }>;
}

const confirmedRows = async (targetSourceId: string) => {
  const response = await mockConfirm.getConfirmedIntegration(targetSourceId);
  const body = (await response.json()) as ConfirmedBody;
  return body.resource_infos ?? [];
};

describe('steps 4~7 RDS cluster rows', () => {
  beforeEach(() => {
    getStore().currentUserId = 'admin-1';
    setCurrentUser('admin-1');
  });

  it.each([
    ['step 4', STEP_4],
    ['step 5', STEP_5],
    ['step 6', STEP_6],
    ['step 7', STEP_7],
  ])('%s confirmed-integration carries cluster rows with resource_type', async (_label, id) => {
    const clusters = (await confirmedRows(id)).filter((row) =>
      isRdsCluster(row.resource_type ?? ''),
    );

    expect(clusters.length).toBeGreaterThan(0);
    for (const cluster of clusters) {
      expect(cluster.resource_type).toBe('AWS_DB_CLUSTER');
      expect(cluster.resource_id).toContain(':cluster:');
    }
  });

  // Step 4 reads install status, not the confirmed integration — it joins the two on
  // resource_id to fill name / region / type. A cluster in one and not the other renders a
  // row the tag cannot recognise.
  it('step 4 install rows join the confirmed integration, so cluster rows resolve their type', async () => {
    const response = await mockAws.getInstallationStatus(STEP_4);
    const body = (await response.json()) as InstallBody;
    const installIds = new Set((body.resources ?? []).map((row) => row.resource_id));

    const clusters = (await confirmedRows(STEP_4)).filter((row) =>
      isRdsCluster(row.resource_type ?? ''),
    );

    expect(clusters.length).toBeGreaterThan(0);
    for (const cluster of clusters) {
      expect(installIds.has(cluster.resource_id)).toBe(true);
    }
  });

  // The engine cannot stand in for the type: every one of these clusters reports a plain
  // engine name, which is why the row model needed a separate declared-type field.
  it('does not leak the cluster fact into database_type', async () => {
    const rows = await confirmedRows(STEP_6);
    const cluster = rows.find((row) => isRdsCluster(row.resource_type ?? ''));
    expect(cluster).toBeDefined();
    expect(isRdsCluster(String((cluster as { database_type?: string }).database_type ?? ''))).toBe(
      false,
    );
  });
});
