import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/bff/client', () => ({
  bff: {
    users: {
      me: vi.fn(),
    },
  },
}));

import { GET } from '@/app/integration/api/v1/user/me/route';
import { bff } from '@/lib/bff/client';
import { BffError } from '@/lib/bff/errors';
import type { z } from 'zod';
import type { schemas } from '@/lib/generated/install-v1';

type UserMeResponse = z.infer<typeof schemas.UserMeResponse>;

const mockedMe = vi.mocked(bff.users.me);

describe('GET /integration/api/v1/user/me', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the flat UserMeResponse validated by zod schema', async () => {
    mockedMe.mockResolvedValue({
      id: 'user-1',
      name: '홍길동',
      email: 'hong@company.com',
    } as UserMeResponse);

    const response = await GET(new Request('http://localhost/integration/api/v1/user/me'), {
      params: Promise.resolve({}),
    });

    await expect(response.json()).resolves.toMatchObject({
      id: 'user-1',
      name: '홍길동',
      email: 'hong@company.com',
    });
    expect(response.headers.get('x-expected-duration')).toBe('50ms ~ 200ms');
  });

  it('BffError가 throw되면 problem+json으로 변환한다', async () => {
    mockedMe.mockRejectedValueOnce(
      new BffError(401, 'UNAUTHORIZED', '로그인이 필요합니다.'),
    );

    const response = await GET(new Request('http://localhost/integration/api/v1/user/me'), {
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
