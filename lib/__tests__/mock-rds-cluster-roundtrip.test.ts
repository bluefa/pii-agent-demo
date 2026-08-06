import { beforeEach, describe, expect, it } from 'vitest';
import { mockConfirm, _resetApprovedIntegrationStore } from '@/lib/bff/mock/confirm';
import { setCurrentUser } from '@/lib/mock-data';
import { getStore } from '@/lib/mock-store';
import { createInitialProjectStatus } from '@/lib/process/calculator';
import { ProcessStatus } from '@/lib/types';
import type { Project } from '@/lib/types';
import type { RdsInstanceWire } from '@/lib/rds-instances';

// Steps 2·3 read the instance list and the chosen ARN back out of the approval request. That
// only works if the mock ECHOES what step 1 posted — a store that drops the choice would show
// the reviewer a different instance from the one the requester picked.
const TEST_PROJECT_ID = 'test-rds-cluster-roundtrip';
const TARGET_SOURCE_ID = 3101;
const TARGET_SOURCE_ID_STR = String(TARGET_SOURCE_ID);

const CLUSTER_ARN = 'arn:aws:rds:ap-northeast-2:acct:cluster:demo';
const WRITER: RdsInstanceWire = {
  rds_instance_arn: 'arn:aws:rds:ap-northeast-2:acct:db:demo-1',
  rds_instance_identifier: 'demo-1',
  region: 'ap-northeast-2',
  member: 'Writer',
};
const READER: RdsInstanceWire = {
  rds_instance_arn: 'arn:aws:rds:ap-northeast-2:acct:db:demo-2',
  rds_instance_identifier: 'demo-2',
  region: 'ap-northeast-2',
  member: 'Reader',
};
// Wire order is Writer-first on purpose — nothing in the round trip may reorder it.
const WIRE_ORDER = [WRITER, READER];

const createTestProject = (): Project => ({
  id: TEST_PROJECT_ID,
  targetSourceId: TARGET_SOURCE_ID,
  projectCode: 'AWS-RDS-CLUSTER',
  serviceCode: 'SERVICE-A',
  cloudProvider: 'AWS',
  processStatus: ProcessStatus.WAITING_TARGET_CONFIRMATION,
  status: createInitialProjectStatus(),
  resources: [
    {
      id: CLUSTER_ARN,
      type: 'AWS_DB_CLUSTER',
      awsType: 'RDS_CLUSTER',
      resourceId: CLUSTER_ARN,
      resourceName: 'demo-cluster',
      databaseType: 'MYSQL',
      connectionStatus: 'PENDING',
      isSelected: false,
      integrationCategory: 'TARGET',
      rdsInstanceList: WIRE_ORDER,
    },
  ],
  terraformState: { serviceTf: 'PENDING', bdcTf: 'PENDING' },
  createdAt: '2026-03-01T00:00:00Z',
  updatedAt: '2026-03-01T00:00:00Z',
  name: 'RDS cluster round trip',
  description: 'step 1 → step 2·3 echo',
  isRejected: false,
});

interface WireItem {
  resource_id?: string;
  selected?: boolean;
  metadata?: Record<string, unknown>;
}

const postApproval = (selectedArn: string | undefined) =>
  mockConfirm.createApprovalRequest(TARGET_SOURCE_ID_STR, {
    resources: [
      {
        resource_id: CLUSTER_ARN,
        resource_name: 'demo-cluster',
        resource_type: 'AWS_DB_CLUSTER',
        selected: true,
        integration_category: 'TARGET',
        metadata: {
          provider: 'AWS',
          region: 'ap-northeast-2',
          database_type: 'mysql',
          rds_instance_list: WIRE_ORDER,
          ...(selectedArn ? { selected_rds_instance_arn: selectedArn } : {}),
        },
      },
    ],
  });

const latestClusterItem = async (): Promise<WireItem | undefined> => {
  const response = await mockConfirm.getApprovalRequestLatest(TARGET_SOURCE_ID_STR);
  const body = (await response.json()) as { resources?: WireItem[] };
  return body.resources?.find((item) => item.resource_id === CLUSTER_ARN);
};

/** The step-1 catalog read — where a rejected target lands when the user is sent back. */
const catalogClusterItem = async (): Promise<WireItem | undefined> => {
  const response = await mockConfirm.getResources(TARGET_SOURCE_ID_STR);
  const body = (await response.json()) as { resources?: WireItem[] };
  return body.resources?.find((item) => item.resource_id === CLUSTER_ARN);
};

describe('RDS cluster metadata round trip (step 1 → steps 2·3)', () => {
  beforeEach(() => {
    const store = getStore();
    store.projects = store.projects.filter((project) => project.id !== TEST_PROJECT_ID);
    store.currentUserId = 'admin-1';
    setCurrentUser('admin-1');
    _resetApprovedIntegrationStore();
    store.projects.push(createTestProject());
  });

  it('echoes the posted instance choice back on approval-requests/latest', async () => {
    await postApproval(READER.rds_instance_arn);

    const item = await latestClusterItem();
    expect(item?.selected).toBe(true);
    expect(item?.metadata?.selected_rds_instance_arn).toBe(READER.rds_instance_arn);
    // Verbatim and unsorted — the display layer sorts, the wire does not.
    expect(item?.metadata?.rds_instance_list).toEqual(WIRE_ORDER);
  });

  it('echoes the WRITER when that is what was picked, not the Reader default', async () => {
    await postApproval(WRITER.rds_instance_arn);

    const item = await latestClusterItem();
    expect(item?.metadata?.selected_rds_instance_arn).toBe(WRITER.rds_instance_arn);
  });

  it('carries the list through approved-integration (step 3) with the choice', async () => {
    await postApproval(READER.rds_instance_arn);

    const response = await mockConfirm.getApprovedIntegration(TARGET_SOURCE_ID_STR);
    const body = (await response.json()) as { resources?: WireItem[] };
    const item = body.resources?.find((resource) => resource.resource_id === CLUSTER_ARN);

    expect(item?.metadata?.rds_instance_list).toEqual(WIRE_ORDER);
    expect(item?.metadata?.selected_rds_instance_arn).toBe(READER.rds_instance_arn);
  });

  it('keeps the member list but no choice on an excluded cluster', async () => {
    await mockConfirm.createApprovalRequest(TARGET_SOURCE_ID_STR, {
      resources: [
        {
          resource_id: CLUSTER_ARN,
          resource_name: 'demo-cluster',
          resource_type: 'AWS_DB_CLUSTER',
          selected: false,
          integration_category: 'TARGET',
          exclusion_reason: '미사용 클러스터',
          metadata: { rds_instance_list: WIRE_ORDER },
        },
      ],
    });

    const item = await latestClusterItem();
    expect(item?.selected).toBe(false);
    expect(item?.metadata?.rds_instance_list).toEqual(WIRE_ORDER);
    expect(item?.metadata?.selected_rds_instance_arn).toBeUndefined();
  });

  // Reject → back to step 1. The catalog read has to hand the choice back, or the user's pick
  // silently reverts to the client default and they re-submit something they never chose.
  // This is also the only path on which defaultRdsInstanceArn's server-wins branch runs.
  it('hands the recorded choice back on the step-1 /resources read', async () => {
    // Before any request the server knows nothing — the client default is what applies.
    expect((await catalogClusterItem())?.metadata?.selected_rds_instance_arn).toBeUndefined();

    await postApproval(WRITER.rds_instance_arn);

    const item = await catalogClusterItem();
    expect(item?.metadata?.selected_rds_instance_arn).toBe(WRITER.rds_instance_arn);
    expect(item?.metadata?.rds_instance_list).toEqual(WIRE_ORDER);
  });

  // An excluded cluster recorded no choice, so step 1 must not resurrect one.
  it('hands back no choice when the cluster was excluded', async () => {
    await mockConfirm.createApprovalRequest(TARGET_SOURCE_ID_STR, {
      resources: [
        {
          resource_id: CLUSTER_ARN,
          resource_name: 'demo-cluster',
          resource_type: 'AWS_DB_CLUSTER',
          selected: false,
          integration_category: 'TARGET',
          exclusion_reason: '미사용 클러스터',
          metadata: { rds_instance_list: WIRE_ORDER },
        },
      ],
    });

    expect((await catalogClusterItem())?.metadata?.selected_rds_instance_arn).toBeUndefined();
  });
});
