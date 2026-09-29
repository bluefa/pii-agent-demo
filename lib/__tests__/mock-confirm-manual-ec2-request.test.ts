import { beforeEach, describe, expect, it } from 'vitest';
import { mockConfirm, _resetApprovedIntegrationStore } from '@/lib/bff/mock/confirm';
import { setCurrentUser } from '@/lib/mock-data';
import { getStore } from '@/lib/mock-store';
import { ProcessStatus, type Project } from '@/lib/types';
import { createInitialProjectStatus } from '@/lib/process/calculator';

const TEST_PROJECT_ID = 'test-manual-ec2-request';
const TEST_TARGET_SOURCE_ID = 9997;
const TEST_TARGET_SOURCE_ID_STR = String(TEST_TARGET_SOURCE_ID);
const INSTANCE_ID = 'i-0a1b2c3d4e5f67890';

/** An AWS account whose scan proposed nothing — the EC2 row comes from the search-add flow. */
const createTestProject = (): Project => ({
  id: TEST_PROJECT_ID,
  targetSourceId: TEST_TARGET_SOURCE_ID,
  projectCode: 'AWS-997',
  name: 'AWS manual EC2',
  description: 'AWS',
  serviceCode: 'SERVICE-A',
  cloudProvider: 'AWS',
  processStatus: ProcessStatus.WAITING_TARGET_CONFIRMATION,
  status: createInitialProjectStatus(),
  resources: [],
  terraformState: { serviceTf: 'PENDING', bdcTf: 'PENDING' },
  createdAt: '2026-03-23T00:00:00Z',
  updatedAt: '2026-03-23T00:00:00Z',
  isRejected: false,
});

/** What `toApprovalRequestInput` submits for a manually added EC2 row (Oracle). */
const request = {
  resources: [
    {
      resource_id: INSTANCE_ID,
      resource_name: 'ip-10-10-1-24.ap-northeast-2.compute.internal',
      resource_type: 'AWS_EC2_INSTANCE',
      integration_category: 'NO_INSTALL_NEEDED',
      selected: true,
      metadata: {
        provider: 'AWS',
        database_type: 'oracle',
        host: '10.10.1.24',
        port: 1522,
        oracle_service_id: 'ORCL',
      },
    },
  ],
};

const ENDPOINT = { host: '10.10.1.24', port: 1522, oracle_service_id: 'ORCL' };

/**
 * A manually added EC2 instance is unknown to `project.resources`, so the approval request is
 * the first time the mock hears about it. The row was persisted through the IDC-shaped branch,
 * which kept the port and dropped the rest of the connection info the user typed.
 */
describe('mockConfirm.createApprovalRequest — manually added EC2 row', () => {
  beforeEach(async () => {
    const store = getStore();
    store.projects = store.projects.filter((project) => project.id !== TEST_PROJECT_ID);
    store.projectHistory = [];
    store.currentUserId = 'admin-1';
    setCurrentUser('admin-1');
    _resetApprovedIntegrationStore();
    store.projects.push(createTestProject());

    const response = await mockConfirm.createApprovalRequest(TEST_TARGET_SOURCE_ID_STR, request);
    expect(response.status).toBe(200);
  });

  it('keeps the connection info on the stored row', () => {
    const project = getStore().projects.find((p) => p.id === TEST_PROJECT_ID);
    expect(project?.resources).toMatchObject([
      {
        resourceId: INSTANCE_ID,
        integrationCategory: 'NO_INSTALL_NEEDED',
        vmDatabaseConfig: { host: '10.10.1.24', port: 1522, oracleServiceId: 'ORCL' },
      },
    ]);
  });

  it('reads the connection info back on the pending request (step 2)', async () => {
    const latest = await mockConfirm.getApprovalRequestLatest(TEST_TARGET_SOURCE_ID_STR);
    expect(await latest.json()).toMatchObject({
      resources: [
        {
          resource_id: INSTANCE_ID,
          // The name step 1 showed, not a synthesised demo name.
          resource_name: 'ip-10-10-1-24.ap-northeast-2.compute.internal',
          integration_category: 'NO_INSTALL_NEEDED',
          metadata: ENDPOINT,
        },
      ],
    });
  });
});
