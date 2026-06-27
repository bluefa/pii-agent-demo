import { beforeEach, describe, expect, it } from 'vitest';
import { mockConfirm, _resetApprovedIntegrationStore } from '@/lib/bff/mock/confirm';
import { setCurrentUser } from '@/lib/mock-data';
import { getStore } from '@/lib/mock-store';
import { createInitialProjectStatus } from '@/lib/process/calculator';
import { ProcessStatus } from '@/lib/types';
import type { Project, MockResource } from '@/lib/types';

// ADR-019: mock emits raw snake CloudResourceResponse wire (TargetSourceResourceItemDto items).
interface MockResourceCatalogResponse {
  resources: Array<{
    resource_id: string;
    resource_name: string;
    resource_type: string;
    database_type: string;
    integration_category: string;
    scan_status: string | null;
    metadata: Record<string, unknown>;
  }>;
  total_count: number;
}

const TEST_PROJECT_ID = 'test-resource-catalog-project';
const TEST_TARGET_SOURCE_ID = 3001;
const TEST_TARGET_SOURCE_ID_STR = String(TEST_TARGET_SOURCE_ID);

const parseResponse = async <T>(response: Response): Promise<T> => {
  return response.json() as Promise<T>;
};

const createTestResource = (id: string, overrides: Partial<MockResource> = {}): MockResource => ({
  id,
  type: 'AZURE_POSTGRESQL',
  resourceId: `resource-${id}`,
  databaseType: 'POSTGRESQL',
  connectionStatus: 'PENDING',
  isSelected: false,
  integrationCategory: 'TARGET',
  ...overrides,
});

const createTestProject = (overrides: Partial<Project> = {}): Project => ({
  id: TEST_PROJECT_ID,
  targetSourceId: TEST_TARGET_SOURCE_ID,
  projectCode: 'AZURE-RESOURCE-CATALOG',
  serviceCode: 'SERVICE-A',
  cloudProvider: 'Azure',
  processStatus: ProcessStatus.WAITING_TARGET_CONFIRMATION,
  status: createInitialProjectStatus(),
  resources: [
    createTestResource('vm-1', {
      type: 'AZURE_VM',
      resourceId: 'vm-db-001',
      databaseType: 'MYSQL',
      integrationCategory: 'NO_INSTALL_NEEDED',
      vmDatabaseConfig: {
        databaseType: 'ORACLE',
        host: 'db.internal',
        port: 1521,
        oracleServiceId: 'ORCL',
        selectedNicId: 'nic-1',
      },
      nics: [{ nicId: 'nic-1', name: 'nic-primary', privateIp: '10.0.0.5' }],
      selectedCredentialId: 'cred-should-not-leak',
    }),
    createTestResource('db-1', {
      type: 'AZURE_POSTGRESQL',
      resourceId: 'pg-flex-001',
      databaseType: 'POSTGRESQL',
      integrationCategory: 'TARGET',
    }),
  ],
  terraformState: { bdcTf: 'PENDING' },
  createdAt: '2026-03-01T00:00:00Z',
  updatedAt: '2026-03-01T00:00:00Z',
  name: 'Azure MockResource Catalog Test',
  description: 'Expanded /resources contract test',
  isRejected: false,
  ...overrides,
});

describe('mockConfirm.getResources', () => {
  beforeEach(() => {
    const store = getStore();
    store.projects = store.projects.filter((project) => project.id !== TEST_PROJECT_ID);
    store.currentUserId = 'admin-1';
    setCurrentUser('admin-1');
    _resetApprovedIntegrationStore();
  });

  it('ADR-019: returns raw snake CloudResourceResponse wire (TargetSourceResourceItemDto)', async () => {
    // ADR-019: mock emits snake wire directly; route validates with
    // schemas.CloudResourceResponse.parse; CSR toConfirmResourceItem reshapes to camel.
    const store = getStore();
    store.projects.push(createTestProject());

    const response = await mockConfirm.getResources(TEST_TARGET_SOURCE_ID_STR);
    const body = await parseResponse<MockResourceCatalogResponse>(response);

    expect(body.total_count).toBe(2);

    // vm-db-001 (AZURE_VM with vmDatabaseConfig)
    expect(body.resources[0]).toMatchObject({
      resource_id: 'vm-db-001',
      resource_type: 'AZURE_VM',
      database_type: 'ORACLE',
      integration_category: 'NO_INSTALL_NEEDED',
      scan_status: expect.any(String),
      metadata: expect.objectContaining({
        provider: 'AZURE',
        resource_type: 'AZURE_VM',
        region: 'ap-northeast-1',
        host: 'db.internal',
        port: 1521,
        oracle_service_id: 'ORCL',
        network_interface_id: 'nic-1',
      }),
    });
    // no legacy top-level fields (from extractResourceCatalog)
    expect(body.resources[0]).not.toHaveProperty('id');
    expect(body.resources[0]).not.toHaveProperty('name');
    expect(body.resources[0]).not.toHaveProperty('host');
    expect(body.resources[0]).not.toHaveProperty('selected_credential_id');

    // pg-flex-001 (AZURE_POSTGRESQL, no vmDatabaseConfig)
    expect(body.resources[1]).toMatchObject({
      resource_id: 'pg-flex-001',
      resource_type: 'AZURE_POSTGRESQL',
      database_type: 'POSTGRESQL',
      integration_category: 'TARGET',
      metadata: expect.objectContaining({
        provider: 'AZURE',
        resource_type: 'AZURE_POSTGRESQL',
        region: 'ap-northeast-1',
      }),
    });
  });
});
