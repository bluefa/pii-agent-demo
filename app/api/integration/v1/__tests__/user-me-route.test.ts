import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';

vi.mock('@/lib/api-client', () => ({
  client: {
    users: {
      getMe: vi.fn(),
    },
  },
}));

import { GET } from '@/app/api/integration/v1/user/me/route';
import { client } from '@/lib/api-client';

const mockedGetMe = vi.mocked(client.users.getMe);

describe('GET /api/integration/v1/user/me', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the flat Issue #222 payload as-is', async () => {
    mockedGetMe.mockResolvedValue(
      NextResponse.json({
        id: 'user-1',
        name: '홍길동',
        email: 'hong@company.com',
      }),
    );

    const response = await GET(new Request('http://localhost/api/integration/v1/user/me'), {
      params: Promise.resolve({}),
    });

    await expect(response.json()).resolves.toEqual({
      id: 'user-1',
      name: '홍길동',
      email: 'hong@company.com',
    });
    expect(response.headers.get('x-expected-duration')).toBe('50ms ~ 200ms');
  });

  it('unwraps legacy nested payloads and trims extra fields', async () => {
    mockedGetMe.mockResolvedValue(
      NextResponse.json({
        user: {
          id: 'user-1',
          name: '홍길동',
          email: 'hong@company.com',
          role: 'ADMIN',
          serviceCodePermissions: ['SERVICE-A'],
        },
      }),
    );

    const response = await GET(new Request('http://localhost/api/integration/v1/user/me'), {
      params: Promise.resolve({}),
    });

    await expect(response.json()).resolves.toEqual({
      id: 'user-1',
      name: '홍길동',
      email: 'hong@company.com',
    });
  });

  it('normalizes legacy error payloads into problem+json', async () => {
    mockedGetMe.mockResolvedValue(
      NextResponse.json(
        { error: 'UNAUTHORIZED', message: '로그인이 필요합니다.' },
        { status: 401 },
      ),
    );

    const response = await GET(new Request('http://localhost/api/integration/v1/user/me'), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(401);
    expect(response.headers.get('content-type')).toContain('application/problem+json');
    await expect(response.json()).resolves.toMatchObject({
      code: 'UNAUTHORIZED',
      detail: '로그인이 필요합니다.',
      status: 401,
      retriable: false,
    });
  });
});
