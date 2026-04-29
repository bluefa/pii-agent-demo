import { beforeEach, describe, expect, it } from 'vitest';
import { mockConfirm, _resetApprovedIntegrationStore, _setApprovedIntegration } from '@/lib/bff/mock/confirm';
import { setCurrentUser } from '@/lib/mock-data';
import { getStore } from '@/lib/mock-store';
import { ProcessStatus, type Project, type MockResource } from '@/lib/types';
import { createInitialProjectStatus } from '@/lib/process/calculator';

const TEST_PROJECT_ID = 'test-confirm-credential-sync';
const TEST_TARGET_SOURCE_ID = 9999;
const TEST_TARGET_SOURCE_ID_STR = String(TEST_TARGET_SOURCE_ID);

const createTestResource = (overrides?: Partial<MockResource>): MockResource => ({
  id: 'res-1',
  type: 'AZURE_MSSQL',
  resourceId: 'azure-sql-1',
  databaseType: 'MSSQL',
  connectionStatus: 'CONNECTED',
  isSelected: true,
  integrationCategory: 'TARGET',
  selectedCredentialId: 'cred-old',
  ...overrides,
});

const createTestProject = (): Project => ({
  id: TEST_PROJECT_ID,
  targetSourceId: TEST_TARGET_SOURCE_ID,
  projectCode: 'AZ-001',
  name: 'Azure Test Project',
  description: 'Azure Test',
  serviceCode: 'SERVICE-A',
  cloudProvider: 'Azure',
  processStatus: ProcessStatus.WAITING_CONNECTION_TEST,
  status: {
    ...createInitialProjectStatus(),
    targets: {
      confirmed: true,
      selectedCount: 1,
      excludedCount: 0,
    },
    approval: {
      status: 'APPROVED',
      approvedAt: '2026-03-23T00:00:00Z',
    },
    installation: {
      status: 'COMPLETED',
      completedAt: '2026-03-23T00:00:00Z',
    },
    connectionTest: {
      status: 'NOT_TESTED',
    },
  },
  resources: [createTestResource()],
  terraformState: { bdcTf: 'COMPLETED' },
  createdAt: '2026-03-23T00:00:00Z',
  updatedAt: '2026-03-23T00:00:00Z',
  isRejected: false,
});

describe('mockConfirm.updateResourceCredential', () => {
  beforeEach(() => {
    const store = getStore();
    store.projects = store.projects.filter((project) => project.id !== TEST_PROJECT_ID);
    store.projectHistory = [];
    store.currentUserId = 'admin-1';
    setCurrentUser('admin-1');
    _resetApprovedIntegrationStore();
    store.projects.push(createTestProject());
  });

  it('keeps approved-integration snapshot credentials in sync', async () => {
    _setApprovedIntegration(TEST_TARGET_SOURCE_ID_STR);

    const updateResponse = await mockConfirm.updateResourceCredential(TEST_TARGET_SOURCE_ID_STR, {
      resourceId: 'azure-sql-1',
      credentialId: 'cred-new',
    });

    expect(updateResponse.status).toBe(200);

    const approvedResponse = await mockConfirm.getApprovedIntegration(TEST_TARGET_SOURCE_ID_STR);
    const approvedBody = await approvedResponse.json();

    expect(approvedBody.approved_integration.resource_infos).toEqual([
      {
        resource_id: 'azure-sql-1',
        resource_type: 'AZURE_MSSQL',
        endpoint_config: null,
        credential_id: 'cred-new',
        database_region: null,
        resource_name: 'azure-sql-1',
        scan_status: 'UNCHANGED',
        integration_status: 'INTEGRATED',
      },
    ]);
  });
});
