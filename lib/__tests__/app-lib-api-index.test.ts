import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getConfirmResources,
  getConfirmedIntegration,
  getProjects,
  getServices,
  searchUsers,
} from '@/app/lib/api';
import { ProcessStatus } from '@/lib/types';

describe('app/lib/api/index', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('searchUsers는 excludeIds를 반복 쿼리로 직렬화한다', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          users: [],
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );

    await searchUsers('alice', ['u1', 'u2']);

    expect(fetchSpy.mock.calls[0]?.[0]).toBe(
      '/api/integration/v1/users/search?q=alice&excludeIds=u1&excludeIds=u2',
    );
  });

  it('searchUsers는 빈 파라미터일 때 base endpoint를 호출한다', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          users: [],
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );

    await searchUsers('');

    expect(fetchSpy.mock.calls[0]?.[0]).toBe('/api/integration/v1/users/search');
  });

  it('getServices는 v1 응답을 ServiceCode[] 형태로 매핑한다', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          services: [
            { service_code: 'SERVICE-A', service_name: 'Service Alpha' },
            { service_code: 'SERVICE-B', service_name: 'Service Beta' },
          ],
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );

    const services = await getServices();

    expect(services).toEqual([
      { code: 'SERVICE-A', name: 'Service Alpha' },
      { code: 'SERVICE-B', name: 'Service Beta' },
    ]);
  });

  it('getConfirmedIntegration은 flat confirmed integration 응답을 그대로 사용한다', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          resource_infos: [
            {
              resource_id: 'res-1',
              resource_type: 'ORACLE_DB',
              database_type: 'ORACLE',
              host: 'db.internal',
              port: 1521,
              oracle_service_id: 'ORCL',
              network_interface_id: 'nic-1',
              ip_configuration_name: 'ipconfig-1',
              credential_id: 'cred-1',
            },
          ],
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );

    const confirmedIntegration = await getConfirmedIntegration(1001);

    expect(confirmedIntegration).toEqual({
      resource_infos: [
        {
          resource_id: 'res-1',
          resource_type: 'ORACLE_DB',
          database_type: 'ORACLE',
          host: 'db.internal',
          port: 1521,
          oracle_service_id: 'ORCL',
          network_interface_id: 'nic-1',
          ip_configuration_name: 'ipconfig-1',
          credential_id: 'cred-1',
        },
      ],
    });
  });

  it('getConfirmResources는 확장된 resource catalog 응답을 camelCase로 변환한다', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
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
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );

    const resources = await getConfirmResources(1001);

    expect(resources).toEqual({
      resources: [
        {
          id: 'res-1',
          resourceId: 'vm-db-001',
          name: 'vm-db-001',
          resourceType: 'AZURE_VM',
          databaseType: 'ORACLE',
          integrationCategory: 'NO_INSTALL_NEEDED',
          host: 'db.internal',
          port: 1521,
          oracleServiceId: 'ORCL',
          networkInterfaceId: 'nic-1',
          ipConfigurationName: null,
          metadata: {
            provider: 'Azure',
            resourceType: 'AZURE_VM',
            region: '',
          },
        },
      ],
      totalCount: 1,
    });
  });

  it('getProjects는 Issue #222 process_status를 기존 UI 상태로 보존해 매핑한다', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            description: '승인 반영 중',
            target_source_id: 1011,
            process_status: 'CONFIRMING',
            cloud_provider: 'AZURE',
            created_at: '2026-03-29T00:00:00Z',
          },
          {
            description: '설치 진행 중',
            target_source_id: 1012,
            process_status: 'CONFIRMED',
            cloud_provider: 'AWS',
            created_at: '2026-03-29T00:00:00Z',
          },
        ]),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );

    const projects = await getProjects('SERVICE-A');

    expect(projects).toEqual([
      expect.objectContaining({
        targetSourceId: 1011,
        processStatus: ProcessStatus.APPLYING_APPROVED,
        cloudProvider: 'Azure',
      }),
      expect.objectContaining({
        targetSourceId: 1012,
        processStatus: ProcessStatus.INSTALLING,
        cloudProvider: 'AWS',
      }),
    ]);
  });
});
