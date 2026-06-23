import { describe, expect, it } from 'vitest';
import {
  extractResourceCatalog,
  type ResourceCatalogResponse,
} from '@/lib/resource-catalog-response';
import type { ResourceScanStatus } from '@/lib/types';

// host/port/oracle_service_id/network_interface_id live under `metadata.*` on the
// swagger wire (TargetSourceResourceItemDto); extractResourceCatalog surfaces them
// flat. oracleServiceId/networkInterfaceId are not retained in the normalized
// metadata (not in the metadata whitelist), only on the flat item.
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
      scan_status: null,
      metadata: {
        provider: 'Azure',
        resourceType: 'AZURE_VM',
        rawResourceType: 'AZURE_VM',
        host: 'db.internal',
        port: 1521,
      },
    },
  ],
  total_count: 1,
};

describe('extractResourceCatalog', () => {
  it('surfaces metadata.* host/port/ids flat from a snake_case wire payload', () => {
    expect(
      extractResourceCatalog({
        resources: [
          {
            resource_id: 'vm-db-001',
            name: 'vm-db-001',
            resource_type: 'AZURE_VM',
            database_type: 'ORACLE',
            integration_category: 'NO_INSTALL_NEEDED',
            metadata: {
              provider: 'AZURE',
              resource_type: 'AZURE_VM',
              host: 'db.internal',
              port: 1521,
              oracle_service_id: 'ORCL',
              network_interface_id: 'nic-1',
            },
          },
        ],
        total_count: 1,
      }),
    ).toEqual(normalizedCatalog);
  });

  it('reads metadata.* ids from a camelCase metadata payload', () => {
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
            selectedCredentialId: 'cred-1',
            metadata: {
              provider: 'Azure',
              resourceType: 'AZURE_VM',
              host: 'db.internal',
              port: 1521,
              oracleServiceId: 'ORCL',
              networkInterfaceId: 'nic-1',
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
          scan_status: null,
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

  it('passes a documented scan_status through and coerces unknown values to null', () => {
    const result = extractResourceCatalog({
      resources: [
        { resource_id: 'a', resource_type: 'RDS', name: 'a', scan_status: 'UNCHANGED' },
        { resource_id: 'b', resource_type: 'RDS', name: 'b', scanStatus: 'NEW_SCAN' },
        { resource_id: 'c', resource_type: 'RDS', name: 'c' },
        // Off-contract value (e.g. the legacy invented enum) must coerce to null.
        { resource_id: 'd', resource_type: 'RDS', name: 'd', scan_status: 'CHANGED' as unknown as ResourceScanStatus },
      ],
      total_count: 4,
    });
    expect(result.resources.map((resource) => resource.scan_status)).toEqual([
      'UNCHANGED',
      'NEW_SCAN',
      null,
      null,
    ]);
  });
});
