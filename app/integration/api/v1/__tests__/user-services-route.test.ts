import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/bff/client', () => ({
  bff: {
    users: {
      getServices: vi.fn(),
    },
  },
}));

import { GET } from '@/app/integration/api/v1/user/services/route';
import { bff } from '@/lib/bff/client';
import { BffError } from '@/lib/bff/errors';

const mockedGetServices = vi.mocked(bff.users.getServices);

describe('GET /integration/api/v1/user/services', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the Issue #222 camelCase service list as-is', async () => {
    mockedGetServices.mockResolvedValue({
      services: [
        { serviceCode: 'SERVICE-A', serviceName: '서비스 A' },
        { serviceCode: 'SERVICE-B', serviceName: '서비스 B' },
      ],
    });

    const response = await GET(new Request('http://localhost/integration/api/v1/user/services'), {
      params: Promise.resolve({}),
    });

    await expect(response.json()).resolves.toEqual({
      services: [
        { serviceCode: 'SERVICE-A', serviceName: '서비스 A' },
        { serviceCode: 'SERVICE-B', serviceName: '서비스 B' },
      ],
    });
    expect(response.headers.get('x-expected-duration')).toBe('50ms ~ 200ms');
  });

  it('normalizes legacy code/name items into the Issue #222 schema', async () => {
    mockedGetServices.mockResolvedValue({
      services: [
        { code: 'SERVICE-A', name: '서비스 A' },
        { service_code: 'SERVICE-B', service_name: '서비스 B' },
      ],
    } as never);

    const response = await GET(new Request('http://localhost/integration/api/v1/user/services'), {
      params: Promise.resolve({}),
    });

    await expect(response.json()).resolves.toEqual({
      services: [
        { serviceCode: 'SERVICE-A', serviceName: '서비스 A' },
        { serviceCode: 'SERVICE-B', serviceName: '서비스 B' },
      ],
    });
  });

  it('BffError가 throw되면 problem+json으로 변환한다', async () => {
    mockedGetServices.mockRejectedValueOnce(
      new BffError(401, 'UNAUTHORIZED', '로그인이 필요합니다.'),
    );

    const response = await GET(new Request('http://localhost/integration/api/v1/user/services'), {
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
