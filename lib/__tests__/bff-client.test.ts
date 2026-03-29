import { afterEach, describe, expect, it, vi } from 'vitest';

describe('bffClient.confirm.getResources', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    delete process.env.BFF_API_URL;
  });

  it('normalizes a legacy upstream resource catalog response before proxying it', async () => {
    process.env.BFF_API_URL = 'https://bff.example.com';

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
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
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );

    const { bffClient } = await import('@/lib/api-client/bff-client');

    const response = await bffClient.confirm.getResources('1001');

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://bff.example.com/install/v1/target-sources/1001/resources',
    );
    await expect(response.json()).resolves.toEqual({
      resources: [
        {
          id: 'vm-db-001',
          resource_id: 'vm-db-001',
          resource_type: 'AZURE_VM',
          name: 'vm-db-001',
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
    });
  });

  it('Issue #222 Azure resource enum을 client-safe schema로 normalize해서 proxy한다', async () => {
    process.env.BFF_API_URL = 'https://bff.example.com';

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          resources: [
            {
              resource_id: 'sql-1',
              resource_type: 'AZURE_SQL_SERVER',
              name: 'sql-1',
              integration_category: 'TARGET',
              metadata: {
                provider: 'AZURE',
                resource_type: 'AZURE_SQL_SERVER',
                subscription_id: 'sub-1',
                resource_group: 'rg-1',
              },
            },
          ],
          total_count: 1,
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );

    const { bffClient } = await import('@/lib/api-client/bff-client');

    const response = await bffClient.confirm.getResources('1001');

    await expect(response.json()).resolves.toEqual({
      resources: [
        {
          id: 'sql-1',
          resource_id: 'sql-1',
          resource_type: 'AZURE_MSSQL',
          name: 'sql-1',
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
            rawResourceType: 'AZURE_SQL_SERVER',
            subscriptionId: 'sub-1',
            resourceGroup: 'rg-1',
          },
        },
      ],
      total_count: 1,
    });
  });

  it('targetSources.list는 Issue #222 service-scoped list path를 호출한다', async () => {
    process.env.BFF_API_URL = 'https://bff.example.com';

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const { bffClient } = await import('@/lib/api-client/bff-client');

    await bffClient.targetSources.list('SERVICE-A');

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://bff.example.com/install/v1/target-sources/services/SERVICE-A',
    );
  });

  it('targetSources.create는 serviceCode를 path로 승격하고 request body에서는 제거한다', async () => {
    process.env.BFF_API_URL = 'https://bff.example.com';

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ targetSourceId: 1012 }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const { bffClient } = await import('@/lib/api-client/bff-client');

    await bffClient.targetSources.create({
      serviceCode: 'SERVICE-A',
      description: 'Issue 222 create test',
      cloudProvider: 'AZURE',
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://bff.example.com/install/v1/target-sources/services/SERVICE-A/target-sources',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: 'Issue 222 create test',
          cloudProvider: 'AZURE',
        }),
      },
    );
  });
});
