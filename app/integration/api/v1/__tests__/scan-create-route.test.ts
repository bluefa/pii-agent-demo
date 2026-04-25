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

  it('snake_case BFF 응답을 camelCase로 변환해 모든 필드를 보존한다', async () => {
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
      scan_error: null,
    });

    const response = await POST(
      new Request('http://localhost', { method: 'POST', body: '{}' }),
      { params: Promise.resolve({ targetSourceId: '1001' }) },
    );

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      id: 42,
      scanStatus: 'SCANNING',
      targetSourceId: 1001,
      createdAt: '2026-04-25T00:00:00Z',
      updatedAt: '2026-04-25T00:00:01Z',
      scanVersion: 3,
      scanProgress: 25,
      durationSeconds: 12,
      resourceCountByResourceType: { RDS: 4 },
      scanError: null,
    });
    expect(mockedCreate).toHaveBeenCalledWith(1001, {});
  });

  it('null scanVersion에 1을 채우고 null resourceCountByResourceType은 빈 객체로 변환한다', async () => {
    mockedCreate.mockResolvedValue({
      id: 1,
      scan_status: 'SCANNING',
      target_source_id: 1001,
      created_at: '2026-04-25T00:00:00Z',
      updated_at: '2026-04-25T00:00:00Z',
      scan_version: null,
      scan_progress: null,
      duration_seconds: 0,
      resource_count_by_resource_type: null,
      scan_error: null,
    });

    const response = await POST(
      new Request('http://localhost', { method: 'POST', body: '{}' }),
      { params: Promise.resolve({ targetSourceId: '1001' }) },
    );

    const body = await response.json();
    expect(body.scanVersion).toBe(1);
    expect(body.resourceCountByResourceType).toEqual({});
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
