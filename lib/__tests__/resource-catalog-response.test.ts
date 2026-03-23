import { describe, expect, it } from 'vitest';
import {
  extractResourceCatalog,
  type ResourceCatalogResponse,
} from '@/lib/resource-catalog-response';

const normalizedCatalog: ResourceCatalogResponse = {
  resources: [
    {
      id: 'res-1',
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
  ],
  total_count: 1,
};

describe('extractResourceCatalog', () => {
  it('returns the normalized resource catalog payload as-is', () => {
    expect(extractResourceCatalog(normalizedCatalog)).toEqual(normalizedCatalog);
  });

  it('normalizes a legacy camelCase catalog payload to the new snake_case contract', () => {
    expect(
      extractResourceCatalog({
        resources: [
          {
            id: 'res-1',
            resourceId: 'vm-db-001',
            resourceType: 'AZURE_VM',
            name: 'vm-db-001',
            databaseType: 'ORACLE',
            integrationCategory: 'NO_INSTALL_NEEDED',
            host: 'db.internal',
            port: 1521,
            oracleServiceId: 'ORCL',
            networkInterfaceId: 'nic-1',
            ipConfigurationName: null,
            selectedCredentialId: 'cred-1',
            metadata: {
              provider: 'Azure',
              resourceType: 'AZURE_VM',
              region: '',
            },
          },
        ],
        totalCount: 1,
      }),
    ).toEqual(normalizedCatalog);
  });
});
