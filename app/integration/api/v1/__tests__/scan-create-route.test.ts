import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/bff/client', () => ({
  bff: {
    scan: {
      create: vi.fn(),
    },
  },
}));

import { POST } from '@/app/integration/api/v1/target-sources/[targetSourceId]/scan/route';
import { bff } from '@/lib/bff/client';
import { BffError } from '@/lib/bff/errors';

const mockedCreate = vi.mocked(bff.scan.create);

describe('POST /integration/api/v1/target-sources/[id]/scan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('BFF 응답을 schemas.ScanJobResponse.parse() 결과 그대로 반환한다 (snake_case)', async () => {
    mockedCreate.mockResolvedValue({
      id: 42,
      scan_status: 'SCANNING',
      target_source_id: 1001,
      created_at: '2026-04-25T00:00:00Z',
      updated_at: '2026-04-25T00:00:01Z',
      scan_version: 3,
      scan_progress: 25,
      duration_seconds: 12,
      resource_count_by_resource_type: { RDS: 4 },
    });

    const response = await POST(
      new Request('http://localhost', { method: 'POST', body: '{}' }),
      { params: Promise.resolve({ targetSourceId: '1001' }) },
    );

    expect(response.status).toBe(202);
    const body = await response.json();
    expect(body.id).toBe(42);
    expect(body.scan_status).toBe('SCANNING');
    expect(body.target_source_id).toBe(1001);
    expect(body.created_at).toBe('2026-04-25T00:00:00Z');
    expect(body.updated_at).toBe('2026-04-25T00:00:01Z');
    expect(body.scan_version).toBe(3);
    expect(body.scan_progress).toBe(25);
    expect(body.duration_seconds).toBe(12);
    expect(body.resource_count_by_resource_type).toEqual({ RDS: 4 });
    expect(mockedCreate).toHaveBeenCalledWith(1001, {});
  });

  it('BffError가 throw되면 ProblemDetails로 변환한다', async () => {
    mockedCreate.mockRejectedValueOnce(
      new BffError(409, 'CONFLICT_IN_PROGRESS', '이미 진행 중입니다.'),
    );

    const response = await POST(
      new Request('http://localhost', { method: 'POST', body: '{}' }),
      { params: Promise.resolve({ targetSourceId: '1001' }) },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: 'CONFLICT_IN_PROGRESS',
    });
  });
});
