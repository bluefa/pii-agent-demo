import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/bff/client', () => ({
  bff: {
    targetSources: {
      get: vi.fn(),
    },
  },
}));

import { GET } from '@/app/integration/api/v1/target-sources/[targetSourceId]/route';
import { bff } from '@/lib/bff/client';
import { BffError } from '@/lib/bff/errors';

const mockedGet = vi.mocked(bff.targetSources.get);

describe('GET /integration/api/v1/target-sources/[targetSourceId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('TargetSource detail을 snake wire 그대로 반환한다 (ADR-019)', async () => {
    // ADR-019: bff.targetSources.get returns raw snake TargetSourceDetail.
    // Route validates with schemas.TargetSourceDetail.parse and returns snake wire to CSR.
    mockedGet.mockResolvedValue({
      target_source_id: 1001,
      cloud_provider: 'AWS',
      created_at: '2026-04-01T00:00:00Z',
      process_status: 'PENDING',
      service_code: 'SERVICE-A',
    } as unknown as Awaited<ReturnType<typeof bff.targetSources.get>>);

    const response = await GET(
      new Request('http://localhost/integration/api/v1/target-sources/1001'),
      { params: Promise.resolve({ targetSourceId: '1001' }) },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      target_source_id: 1001,
      service_code: 'SERVICE-A',
    });
    expect(mockedGet).toHaveBeenCalledWith(1001);
  });

  it('잘못된 targetSourceId면 INVALID_PARAMETER problem을 반환한다', async () => {
    const response = await GET(
      new Request('http://localhost/integration/api/v1/target-sources/abc'),
      { params: Promise.resolve({ targetSourceId: 'abc' }) },
    );

    expect(response.status).toBe(400);
    expect(response.headers.get('content-type')).toContain('application/problem+json');
    await expect(response.json()).resolves.toMatchObject({
      code: 'INVALID_PARAMETER',
    });
    expect(mockedGet).not.toHaveBeenCalled();
  });

  it('BffError가 throw되면 ProblemDetails로 변환한다', async () => {
    mockedGet.mockRejectedValueOnce(
      new BffError(404, 'NOT_FOUND', '과제를 찾을 수 없습니다.'),
    );

    const response = await GET(
      new Request('http://localhost/integration/api/v1/target-sources/9999'),
      { params: Promise.resolve({ targetSourceId: '9999' }) },
    );

    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('application/problem+json');
    await expect(response.json()).resolves.toMatchObject({
      code: 'TARGET_SOURCE_NOT_FOUND',
      detail: '과제를 찾을 수 없습니다.',
    });
  });
});
