import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createApprovalRequest,
  createTargetSource,
  getApprovalHistory,
  getApprovedIntegration,
  getConfirmResources,
  getConfirmedIntegration,
  getCreationCandidates,
  getProcessStatus,
  getCurrentUser,
  getProject,
  getProjects,
  searchUsers,
  updateResourceCredential,
} from '@/app/lib/api';
import type { TargetSourceCreationCandidateResponse } from '@/app/lib/api';
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
      '/integration/api/v1/users/search?q=alice&excludeIds=u1&excludeIds=u2',
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

    expect(fetchSpy.mock.calls[0]?.[0]).toBe('/integration/api/v1/users/search');
  });

  it('getCurrentUser는 flat user/me 응답을 그대로 읽는다', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'user-1',
          name: '홍길동',
          email: 'hong@company.com',
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );

    const user = await getCurrentUser();

    expect(user).toEqual({
      id: 'user-1',
      name: '홍길동',
      email: 'hong@company.com',
    });
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
          database_region: null,
          resource_name: null,
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
          id: 'vm-db-001',
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
            rawResourceType: 'AZURE_VM',
            region: '',
          },
        },
      ],
      totalCount: 1,
    });
  });

  it('updateResourceCredential은 Issue #222 PUT 계약으로 호출한다', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ success: true }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );

    const response = await updateResourceCredential(1001, 'res-1', 'cred-1');

    expect(response).toEqual({ success: true });
    expect(fetchSpy).toHaveBeenCalledWith(
      '/integration/api/v1/target-sources/1001/resources/credential',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({
          resourceId: 'res-1',
          credentialId: 'cred-1',
        }),
      }),
    );
  });

  it('getProject는 Issue #222 상세 응답을 Project read model로 복원한다', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          description: 'Azure read model',
          target_source_id: 1013,
          process_status: 'CONNECTED',
          cloud_provider: 'AZURE',
          created_at: '2026-03-29T00:00:00Z',
          metadata: {
            tenant_id: 'tenant-1',
            subscription_id: 'subscription-1',
          },
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );

    const project = await getProject(1013);

    expect(project).toEqual(expect.objectContaining({
      targetSourceId: 1013,
      projectCode: '',
      serviceCode: '',
      cloudProvider: 'Azure',
      processStatus: ProcessStatus.CONNECTION_VERIFIED,
      tenantId: 'tenant-1',
      subscriptionId: 'subscription-1',
    }));
    expect(project).not.toHaveProperty('resources');
    expect(project).not.toHaveProperty('status');
    expect(project).not.toHaveProperty('terraformState');
  });

  it('createApprovalRequest는 camel ApprovalRequestSummary 응답을 매핑한다 (요청 본문은 라우트가 정규화)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 44,
          targetSourceId: 1001,
          status: 'PENDING',
          requestedBy: { userId: 'alice' },
          requestedAt: '2026-03-29T00:00:00Z',
          resourceTotalCount: 2,
          resourceSelectedCount: 1,
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );

    const input = {
      resource_inputs: [
        { resource_id: 'vm-1', selected: true as const },
        { resource_id: 'sql-2', selected: false as const, exclusion_reason: 'skip' },
      ],
    };

    const result = await createApprovalRequest(1001, input);

    expect(fetchSpy.mock.calls[0]?.[0]).toBe('/integration/api/v1/target-sources/1001/approval-requests');
    // ADR-019: client posts the raw selection input; the route normalizes the
    // (out-of-contract) request body before forwarding to the BFF.
    expect(fetchSpy.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST',
      body: JSON.stringify(input),
    });
    expect(result).toEqual({
      id: '44',
      targetSourceId: 1001,
      status: 'PENDING',
      requestedAt: '2026-03-29T00:00:00Z',
      requestedBy: 'alice',
      resourceTotalCount: 2,
      resourceSelectedCount: 1,
    });
  });

  it('getApprovedIntegration은 Issue #222 응답을 기존 UI 스냅샷으로 감싼다', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 17,
          request_id: 22,
          approved_at: '2026-03-29T00:00:00Z',
          resource_infos: [
            {
              resource_id: 'vm-1',
              resource_type: 'AZURE_VM',
              database_type: 'POSTGRESQL',
              port: 5432,
              host: '10.0.0.9',
              network_interface_id: 'nic-9',
            },
          ],
          excluded_resource_infos: [
            {
              resource_id: 'sql-2',
              exclusion_reason: 'skip',
            },
          ],
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );

    const approvedIntegration = await getApprovedIntegration(1001);

    expect(approvedIntegration).toEqual({
      approved_integration: {
        id: '17',
        request_id: '22',
        approved_at: '2026-03-29T00:00:00Z',
        approved_by: null,
        resource_infos: [
          {
            resource_id: 'vm-1',
            resource_type: 'AZURE_VM',
            endpoint_config: {
              resource_id: 'vm-1',
              db_type: 'POSTGRESQL',
              port: 5432,
              host: '10.0.0.9',
              selectedNicId: 'nic-9',
            },
            credential_id: null,
            database_region: null,
            resource_name: null,
            scan_status: null,
            integration_status: null,
          },
        ],
        excluded_resource_ids: ['sql-2'],
        excluded_resource_infos: [
          {
            resource_id: 'sql-2',
            exclusion_reason: 'skip',
          },
        ],
        exclusion_reason: 'skip',
      },
    });
  });

  it('getApprovalHistory는 Issue #222 page 응답을 기존 UI 요약 구조로 변환한다', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          content: [
            {
              request: {
                id: 11,
                targetSourceId: 1001,
                status: 'PENDING',
                requestedBy: { userId: 'alice' },
                requestedAt: '2026-03-29T00:00:00Z',
                resourceTotalCount: 3,
                resourceSelectedCount: 2,
              },
            },
          ],
          totalElements: 1,
          totalPages: 1,
          number: 0,
          size: 10,
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );

    const history = await getApprovalHistory(1001);

    expect(history).toEqual({
      content: [
        {
          request: {
            id: '11',
            requested_at: '2026-03-29T00:00:00Z',
            requested_by: 'alice',
            status: 'PENDING',
            resource_total_count: 3,
            resource_selected_count: 2,
            input_data: {
              resource_inputs: [],
            },
          },
        },
      ],
      page: {
        totalElements: 1,
        totalPages: 1,
        number: 0,
        size: 10,
      },
    });
  });

  it('getProcessStatus는 Issue #222 process-status 응답을 그대로 사용한다', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          target_source_id: 1001,
          process_status: 'CONFIRMING',
          healthy: 'DEGRADED',
          evaluated_at: '2026-03-29T00:00:00Z',
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );

    await expect(getProcessStatus(1001)).resolves.toEqual({
      target_source_id: 1001,
      process_status: 'CONFIRMING',
      healthy: 'DEGRADED',
      evaluated_at: '2026-03-29T00:00:00Z',
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

  it('getCreationCandidates는 snake cloud_type/metadata 요청 본문을 직렬화한다 (35, D3)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await getCreationCandidates('SERVICE-A', {
      cloudProvider: 'AWS',
      awsAccountId: '123456789012',
      isChinaRegion: true,
      isTerraformExecutionGranted: true,
      dbTypes: ['MYSQL', 'OTHERS'],
    });

    const [url, init] = fetchSpy.mock.calls[0] ?? [];
    expect(url).toBe('/integration/api/v1/services/SERVICE-A/creation-candidates');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({
      cloud_type: 'aws',
      is_china_region: true,
      database_types: ['MYSQL', 'OTHERS'],
      grant_service_terraform_execution_permission: true,
      metadata: { aws_account_id: '123456789012' },
    });
  });

  it('getCreationCandidates는 GCP project_id 를 metadata 에 매핑한다 (35)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await getCreationCandidates('SERVICE-A', {
      cloudProvider: 'GCP',
      gcpProjectId: 'gcp-proj-12345',
      dbTypes: ['BIGQUERY'],
    });

    const body = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body));
    expect(body.cloud_type).toBe('gcp');
    expect(body.is_china_region).toBe(false);
    expect(body.metadata).toEqual({ project_id: 'gcp-proj-12345' });
  });

  it('createTargetSource는 선택된 candidate 를 snake 로 재직렬화해 그대로 POST 한다 (36 round-trip)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ targetSourceId: 9001, cloudProvider: 'AWS' }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      }),
    );

    // ADR-019 D3: candidate is already snake wire; createTargetSource posts verbatim.
    const candidate: TargetSourceCreationCandidateResponse = {
      status: 'ADD',
      cloud_type: 'AWS',
      is_sdu_type: false,
      is_china_region: true,
      metadata: { aws_account_id: '123456789012' },
      grant_service_terraform_execution_permission: true,
    };

    const result = await createTargetSource('SERVICE-A', candidate);

    const [url, init] = fetchSpy.mock.calls[0] ?? [];
    expect(url).toBe('/integration/api/v1/services/SERVICE-A/target-sources');
    expect(init?.method).toBe('POST');
    // Round-trip: snake wire candidate posted back verbatim (no conversion).
    expect(JSON.parse(String(init?.body))).toEqual({
      status: 'ADD',
      cloud_type: 'AWS',
      is_sdu_type: false,
      is_china_region: true,
      metadata: { aws_account_id: '123456789012' },
      grant_service_terraform_execution_permission: true,
    });
    expect(result.targetSourceId).toBe(9001);
  });
});
