import { beforeEach, describe, expect, it } from 'vitest';
import { mockConfirm, _resetApprovedIntegrationStore } from '@/lib/api-client/mock/confirm';
import { setCurrentUser } from '@/lib/mock-data';
import { getStore } from '@/lib/mock-store';
import { createInitialProjectStatus } from '@/lib/process/calculator';
import { ProcessStatus } from '@/lib/types';
import type { Project, Resource } from '@/lib/types';

interface MockResourceCatalogResponse {
  resources: Array<{
    id: string;
    resource_id: string;
    name: string;
    resource_type: string;
    database_type: string;
    integration_category: string;
    host: string | null;
    port: number | null;
    oracle_service_id: string | null;
    network_interface_id: string | null;
    ip_configuration_name: string | null;
    metadata: {
      provider: string;
      resourceType: string;
      region?: string;
    };
  }>;
  total_count: number;
}

const TEST_PROJECT_ID = 'test-resource-catalog-project';

const parseResponse = async <T>(response: Response): Promise<T> => {
  return response.json() as Promise<T>;
};

const createTestResource = (id: string, overrides: Partial<Resource> = {}): Resource => ({
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
  targetSourceId: 3001,
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
  name: 'Azure Resource Catalog Test',
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

  it('returns the expanded /resources catalog shape without selection-only fields', async () => {
    const store = getStore();
    store.projects.push(createTestProject());

    const response = await mockConfirm.getResources(TEST_PROJECT_ID);
    const body = await parseResponse<MockResourceCatalogResponse>(response);

    expect(body.total_count).toBe(2);
    expect(body.resources).toEqual([
      {
        id: 'vm-db-001',
        resource_id: 'vm-db-001',
        name: 'vm-db-001',
        resource_type: 'AZURE_VM',
        database_type: 'ORACLE',
        integration_category: 'NO_INSTALL_NEEDED',
        host: 'db.internal',
        port: 1521,
        oracle_service_id: 'ORCL',
        network_interface_id: 'nic-1',
        ip_configuration_name: null,
        metadata: {
          provider: 'Azure',
          resourceType: 'AZURE_VM',
          region: '',
        },
      },
      {
        id: 'pg-flex-001',
        resource_id: 'pg-flex-001',
        name: 'pg-flex-001',
        resource_type: 'AZURE_POSTGRESQL',
        database_type: 'POSTGRESQL',
        integration_category: 'TARGET',
        host: null,
        port: null,
        oracle_service_id: null,
        network_interface_id: null,
        ip_configuration_name: null,
        metadata: {
          provider: 'Azure',
          resourceType: 'AZURE_POSTGRESQL',
          region: '',
        },
      },
    ]);
    expect(body.resources[0]).not.toHaveProperty('selected_credential_id');
  });
});
