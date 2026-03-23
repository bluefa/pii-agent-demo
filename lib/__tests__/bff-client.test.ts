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
      'https://bff.example.com/infra/v1/target-sources/1001/resources',
    );
    await expect(response.json()).resolves.toEqual({
      resources: [
        {
          id: 'res-1',
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
            region: '',
          },
        },
      ],
      total_count: 1,
    });
  });
});
