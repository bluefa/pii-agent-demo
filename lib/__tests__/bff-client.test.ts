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

describe('bffClient.azure.getSettings', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    delete process.env.BFF_API_URL;
  });

  it('legacy upstream settings 응답을 정규화하고 식별자가 없으면 target-source detail로 보강한다', async () => {
    process.env.BFF_API_URL = 'https://bff.example.com';

    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            scanApp: {
              registered: true,
              appId: 'scan-app-123',
              status: 'NOT_VERIFIED',
              lastVerifiedAt: '2026-03-24T00:00:00Z',
            },
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            target_source: {
              tenant_id: 'tenant-from-detail',
              subscription_id: 'subscription-from-detail',
            },
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        ),
      );

    const { bffClient } = await import('@/lib/api-client/bff-client');

    const response = await bffClient.azure.getSettings('1003');

    expect(fetchSpy.mock.calls).toEqual([
      ['https://bff.example.com/infra/v1/azure/projects/1003/settings'],
      ['https://bff.example.com/infra/v1/target-sources/1003'],
    ]);
    await expect(response.json()).resolves.toEqual({
      tenant_id: 'tenant-from-detail',
      subscription_id: 'subscription-from-detail',
      scan_app: {
        app_id: 'scan-app-123',
        status: 'UNVERIFIED',
        last_verified_at: '2026-03-24T00:00:00Z',
      },
    });
  });
});
