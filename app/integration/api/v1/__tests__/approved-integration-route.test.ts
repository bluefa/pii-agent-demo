import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BffError } from '@/lib/bff/errors';

vi.mock('@/lib/bff/client', () => ({
  bff: {
    confirm: {
      getApprovedIntegration: vi.fn(),
    },
  },
}));

import { GET } from '@/app/integration/api/v1/target-sources/[targetSourceId]/approved-integration/route';
import { bff } from '@/lib/bff/client';

const mockedGetApprovedIntegration = vi.mocked(bff.confirm.getApprovedIntegration);

describe('GET /integration/api/v1/target-sources/[targetSourceId]/approved-integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('approved integration이 없으면 snapshot-specific 404 problem을 반환한다', async () => {
    mockedGetApprovedIntegration.mockRejectedValue(
      new BffError(404, 'NOT_FOUND', '승인된 연동 정보가 없습니다.'),
    );

    const response = await GET(
      new Request('http://localhost/integration/api/v1/target-sources/1005/approved-integration'),
      { params: Promise.resolve({ targetSourceId: '1005' }) },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      title: 'Not Found',
      status: 404,
      code: 'APPROVED_INTEGRATION_NOT_FOUND',
    });
    expect(mockedGetApprovedIntegration).toHaveBeenCalledWith(1005);
  });

  it('ADR-019: flat ApprovedIntegrationResponseDto(resources) snake wire를 그대로 반환한다', async () => {
    // ADR-019: route validates with schemas.ApprovedIntegrationResponseDto.parse
    // and returns the flat snake wire directly. CSR getApprovedIntegration reshapes.
    const wireResponse = {
      id: 7,
      request_id: 9,
      approved_at: '2026-04-01T10:00:00Z',
      approved_by: { user_id: 'kim.security' },
      resources: [
        {
          selected: true,
          resource_id: 'res-1',
          resource_name: 'prod-db',
          resource_type: 'AWS_DB_INSTANCE',
          integration_category: 'TARGET',
          metadata: {
            region: 'ap-northeast-2',
            host: 'db.example.com',
            port: 3306,
            database_type: 'MYSQL',
            credential_id: 'cred-1',
          },
        },
        {
          selected: false,
          resource_id: 'res-2',
          resource_name: 'legacy-db',
          resource_type: 'AWS_DB_INSTANCE',
          integration_category: 'NO_INSTALL_NEEDED',
          exclusion_reason: '설치 불필요',
          metadata: { region: 'ap-northeast-2', database_type: 'POSTGRESQL' },
        },
      ],
    };
    mockedGetApprovedIntegration.mockResolvedValue(wireResponse as never);

    const response = await GET(
      new Request('http://localhost/integration/api/v1/target-sources/1005/approved-integration'),
      { params: Promise.resolve({ targetSourceId: '1005' }) },
    );

    expect(response.status).toBe(200);
    // Route returns the flat wire as-is (schema parse + passthrough).
    await expect(response.json()).resolves.toMatchObject({
      id: 7,
      request_id: 9,
      approved_at: '2026-04-01T10:00:00Z',
      approved_by: { user_id: 'kim.security' },
      resources: wireResponse.resources,
    });
  });

  it('ADR-019: flat approved integration snake wire를 그대로 반환한다 (no envelope)', async () => {
    // ADR-019: BFF returns flat snake ApprovedIntegrationResponseDto (no wrapper).
    // Route validates and returns flat wire; CSR reshapes to UI domain.
    const wireResponse = {
      id: 1,
      request_id: 1,
      approved_at: '2026-03-29T10:00:00Z',
      approved_by: { user_id: 'alice' },
      resources: [
        {
          resource_id: 'res-1',
          resource_type: 'AZURE_MYSQL',
          integration_category: 'TARGET',
          // metadata is required in TargetSourceResourceItemDto schema.
          metadata: {},
        },
      ],
    };
    mockedGetApprovedIntegration.mockResolvedValue(wireResponse as never);

    const response = await GET(
      new Request('http://localhost/integration/api/v1/target-sources/1005/approved-integration'),
      { params: Promise.resolve({ targetSourceId: '1005' }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      id: 1,
      request_id: 1,
      approved_at: '2026-03-29T10:00:00Z',
      resources: wireResponse.resources,
    });
  });
});
