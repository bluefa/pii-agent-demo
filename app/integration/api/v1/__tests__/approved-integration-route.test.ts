import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';

vi.mock('@/lib/api-client', () => ({
  client: {
    confirm: {
      getApprovedIntegration: vi.fn(),
    },
  },
}));

import { GET } from '@/app/integration/api/v1/target-sources/[targetSourceId]/approved-integration/route';
import { client } from '@/lib/api-client';

const mockedGetApprovedIntegration = vi.mocked(client.confirm.getApprovedIntegration);

describe('GET /integration/api/v1/target-sources/[targetSourceId]/approved-integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('approved integration이 없으면 snapshot-specific 404 problem을 반환한다', async () => {
    mockedGetApprovedIntegration.mockResolvedValue(
      NextResponse.json(
        { error: 'NOT_FOUND', message: '승인된 연동 정보가 없습니다.' },
        { status: 404 },
      ),
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
    expect(mockedGetApprovedIntegration).toHaveBeenCalledWith('1005');
  });

  it('approved integration 응답을 Issue #222 dto shape로 반환한다', async () => {
    mockedGetApprovedIntegration.mockResolvedValue(NextResponse.json({
      approved_integration: {
        id: 'ai-1',
        request_id: 'req-1',
        approved_at: '2026-03-29T10:00:00Z',
        resource_infos: [
          {
            resource_id: 'res-1',
            resource_type: 'AZURE_MYSQL',
            credential_id: 'cred-1',
          },
        ],
        excluded_resource_ids: ['res-2'],
        exclusion_reason: 'manual exclude',
      },
    }));

    const response = await GET(
      new Request('http://localhost/integration/api/v1/target-sources/1005/approved-integration'),
      { params: Promise.resolve({ targetSourceId: '1005' }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      id: 1,
      request_id: 1,
      approved_at: '2026-03-29T10:00:00Z',
      resource_infos: [
        {
          resource_id: 'res-1',
          resource_type: 'AZURE_MYSQL',
          credential_id: 'cred-1',
        },
      ],
      excluded_resource_infos: [
        {
          resource_id: 'res-2',
          exclusion_reason: 'manual exclude',
        },
      ],
    });
  });
});
