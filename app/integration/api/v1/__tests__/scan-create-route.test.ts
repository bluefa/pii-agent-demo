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

  it('snake_case BFF 응답을 camelCase로 변환해 202를 반환한다', async () => {
    mockedCreate.mockResolvedValue({
      id: 42,
      scan_status: 'SCANNING',
      target_source_id: 1001,
      created_at: '2026-04-25T00:00:00Z',
    });

    const response = await POST(
      new Request('http://localhost', { method: 'POST', body: '{}' }),
      { params: Promise.resolve({ targetSourceId: '1001' }) },
    );

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({
      id: 42,
      scanStatus: 'SCANNING',
      targetSourceId: 1001,
      createdAt: '2026-04-25T00:00:00Z',
    });
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
