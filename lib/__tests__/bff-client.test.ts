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

  it('users.getMe는 Issue #222 singular path를 호출한다', async () => {
    process.env.BFF_API_URL = 'https://bff.example.com';

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 'user-1', name: '홍길동', email: 'hong@company.com' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const { bffClient } = await import('@/lib/api-client/bff-client');

    await bffClient.users.getMe();

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://bff.example.com/install/v1/user/me',
    );
  });

  it('users.getServices는 Issue #222 singular path를 호출한다', async () => {
    process.env.BFF_API_URL = 'https://bff.example.com';

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ services: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const { bffClient } = await import('@/lib/api-client/bff-client');

    await bffClient.users.getServices();

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://bff.example.com/install/v1/user/services',
    );
  });
});
