import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/bff/client', () => ({
  bff: {
    services: {
      permissions: {
        list: vi.fn(),
      },
    },
  },
}));

import { GET } from '@/app/integration/api/v1/services/[serviceCode]/authorized-users/route';
import { bff } from '@/lib/bff/client';
import { BffError } from '@/lib/bff/errors';

const mockedList = vi.mocked(bff.services.permissions.list);

describe('services permissions routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET authorized-users는 user 목록을 반환한다', async () => {
    mockedList.mockResolvedValue({
      users: [{ id: 'u-1', name: 'Alice', email: 'alice@example.com' }],
    } as unknown as Awaited<ReturnType<typeof bff.services.permissions.list>>);

    const response = await GET(
      new Request('http://localhost'),
      { params: Promise.resolve({ serviceCode: 'SERVICE-A' }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      users: [{ id: 'u-1' }],
    });
    expect(mockedList).toHaveBeenCalledWith('SERVICE-A');
  });

  it('GET authorized-users는 BffError를 ProblemDetails로 변환한다', async () => {
    mockedList.mockRejectedValueOnce(
      new BffError(403, 'FORBIDDEN', '권한이 없습니다.'),
    );

    const response = await GET(
      new Request('http://localhost'),
      { params: Promise.resolve({ serviceCode: 'SERVICE-A' }) },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});
