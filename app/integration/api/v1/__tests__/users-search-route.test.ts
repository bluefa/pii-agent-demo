import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/bff/client', () => ({
  bff: {
    users: {
      search: vi.fn(),
    },
  },
}));

import { GET } from '@/app/integration/api/v1/users/search/route';
import { bff } from '@/lib/bff/client';
import { BffError } from '@/lib/bff/errors';

const mockedSearch = vi.mocked(bff.users.search);

describe('GET /integration/api/v1/users/search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedSearch.mockResolvedValue({ users: [] });
  });

  it('excludeIds 반복 쿼리를 배열로 파싱한다', async () => {
    const request = new Request(
      'http://localhost/integration/api/v1/users/search?q=alice&excludeIds=u1&excludeIds=u2',
    );

    const response = await GET(request, { params: Promise.resolve({}) });

    expect(response.status).toBe(200);
    expect(mockedSearch).toHaveBeenCalledWith('alice', ['u1', 'u2']);
  });

  it('q와 excludeIds가 없으면 기본값으로 전달한다', async () => {
    const request = new Request('http://localhost/integration/api/v1/users/search');

    const response = await GET(request, { params: Promise.resolve({}) });

    expect(response.status).toBe(200);
    expect(mockedSearch).toHaveBeenCalledWith('', []);
  });

  it('BffError가 throw되면 ProblemDetails로 변환한다', async () => {
    mockedSearch.mockRejectedValueOnce(
      new BffError(401, 'UNAUTHORIZED', '로그인이 필요합니다.'),
    );

    const response = await GET(
      new Request('http://localhost/integration/api/v1/users/search'),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(401);
    expect(response.headers.get('content-type')).toContain('application/problem+json');
    await expect(response.json()).resolves.toMatchObject({
      code: 'UNAUTHORIZED',
      detail: '로그인이 필요합니다.',
    });
  });
});
