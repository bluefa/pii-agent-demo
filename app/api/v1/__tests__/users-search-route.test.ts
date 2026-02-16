import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';

vi.mock('@/lib/api-client', () => ({
  client: {
    users: {
      search: vi.fn(),
    },
  },
}));

import { GET } from '@/app/api/v1/users/search/route';
import { client } from '@/lib/api-client';

const mockedSearch = vi.mocked(client.users.search);

describe('GET /api/v1/users/search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedSearch.mockResolvedValue(NextResponse.json({ users: [] }));
  });

  it('excludeIds 반복 쿼리를 배열로 파싱한다', async () => {
    const request = new Request(
      'http://localhost/api/v1/users/search?q=alice&excludeIds=u1&excludeIds=u2',
    );

    const response = await GET(request, { params: Promise.resolve({}) });

    expect(response.status).toBe(200);
    expect(mockedSearch).toHaveBeenCalledWith('alice', ['u1', 'u2']);
  });

  it('q와 excludeIds가 없으면 기본값으로 전달한다', async () => {
    const request = new Request('http://localhost/api/v1/users/search');

    const response = await GET(request, { params: Promise.resolve({}) });

    expect(response.status).toBe(200);
    expect(mockedSearch).toHaveBeenCalledWith('', []);
  });
});
