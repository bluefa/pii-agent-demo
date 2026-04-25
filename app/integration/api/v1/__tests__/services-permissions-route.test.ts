import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/bff/client', () => ({
  bff: {
    services: {
      permissions: {
        list: vi.fn(),
        add: vi.fn(),
        remove: vi.fn(),
      },
    },
  },
}));

import { GET, POST } from '@/app/integration/api/v1/services/[serviceCode]/authorized-users/route';
import { DELETE } from '@/app/integration/api/v1/services/[serviceCode]/authorized-users/[userId]/route';
import { bff } from '@/lib/bff/client';
import { BffError } from '@/lib/bff/errors';

const mockedList = vi.mocked(bff.services.permissions.list);
const mockedAdd = vi.mocked(bff.services.permissions.add);
const mockedRemove = vi.mocked(bff.services.permissions.remove);

describe('services permissions routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET authorized-users는 user 목록을 반환한다', async () => {
    mockedList.mockResolvedValue({
      users: [{ id: 'u-1', name: 'Alice', email: 'alice@example.com' }],
    } as never);

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

  it('POST authorized-users는 body를 그대로 전달한다', async () => {
    mockedAdd.mockResolvedValue({ success: true });

    const response = await POST(
      new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({ userId: 'u-2' }),
      }),
      { params: Promise.resolve({ serviceCode: 'SERVICE-A' }) },
    );

    expect(response.status).toBe(200);
    expect(mockedAdd).toHaveBeenCalledWith('SERVICE-A', { userId: 'u-2' });
  });

  it('DELETE authorized-users는 BffError를 ProblemDetails로 변환한다', async () => {
    mockedRemove.mockRejectedValueOnce(
      new BffError(403, 'FORBIDDEN', '권한이 없습니다.'),
    );

    const response = await DELETE(
      new Request('http://localhost'),
      { params: Promise.resolve({ serviceCode: 'SERVICE-A', userId: 'u-2' }) },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});
