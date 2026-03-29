import { describe, expect, it } from 'vitest';
import {
  extractResourceCatalog,
  type ResourceCatalogResponse,
} from '@/lib/resource-catalog-response';

const normalizedCatalog: ResourceCatalogResponse = {
  resources: [
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
        rawResourceType: 'AZURE_VM',
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
              rawResourceType: 'AZURE_VM',
            },
          },
        ],
        totalCount: 1,
      }),
    ).toEqual(normalizedCatalog);
  });

  it('maps Issue #222 Azure resource enums and metadata to the client-safe schema', () => {
    expect(
      extractResourceCatalog({
        resources: [
          {
            resource_id: 'sql-1',
            resource_type: 'AZURE_SQL_SERVER_MANAGED_INSTANCE',
            name: 'sql-managed-1',
            integration_category: 'TARGET',
            metadata: {
              provider: 'AZURE',
              resource_type: 'AZURE_SQL_SERVER_MANAGED_INSTANCE',
              subscription_id: 'sub-1',
              resource_group: 'rg-1',
              region: 'koreacentral',
              server_name: 'sql-managed-1',
            },
          },
        ],
        total_count: 1,
      }),
    ).toEqual({
      resources: [
        {
          id: 'sql-1',
          resource_id: 'sql-1',
          name: 'sql-managed-1',
          resource_type: 'AZURE_MSSQL',
          database_type: 'MSSQL',
          integration_category: 'TARGET',
          host: null,
          port: null,
          oracle_service_id: null,
          network_interface_id: null,
          ip_configuration_name: null,
          metadata: {
            provider: 'Azure',
            resourceType: 'AZURE_MSSQL',
            rawResourceType: 'AZURE_SQL_SERVER_MANAGED_INSTANCE',
            subscriptionId: 'sub-1',
            resourceGroup: 'rg-1',
            region: 'koreacentral',
            serverName: 'sql-managed-1',
          },
        },
      ],
      total_count: 1,
    });
  });
});
