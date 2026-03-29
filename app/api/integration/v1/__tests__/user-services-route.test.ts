import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';

vi.mock('@/lib/api-client', () => ({
  client: {
    users: {
      getServices: vi.fn(),
    },
  },
}));

import { GET } from '@/app/api/integration/v1/user/services/route';
import { client } from '@/lib/api-client';

const mockedGetServices = vi.mocked(client.users.getServices);

describe('GET /api/integration/v1/user/services', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the Issue #222 camelCase service list as-is', async () => {
    mockedGetServices.mockResolvedValue(
      NextResponse.json({
        services: [
          { serviceCode: 'SERVICE-A', serviceName: '서비스 A' },
          { serviceCode: 'SERVICE-B', serviceName: '서비스 B' },
        ],
      }),
    );

    const response = await GET(new Request('http://localhost/api/integration/v1/user/services'), {
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
    mockedGetServices.mockResolvedValue(
      NextResponse.json({
        services: [
          { code: 'SERVICE-A', name: '서비스 A' },
          { service_code: 'SERVICE-B', service_name: '서비스 B' },
        ],
      }),
    );

    const response = await GET(new Request('http://localhost/api/integration/v1/user/services'), {
      params: Promise.resolve({}),
    });

    await expect(response.json()).resolves.toEqual({
      services: [
        { serviceCode: 'SERVICE-A', serviceName: '서비스 A' },
        { serviceCode: 'SERVICE-B', serviceName: '서비스 B' },
      ],
    });
  });

  it('normalizes legacy error payloads into problem+json', async () => {
    mockedGetServices.mockResolvedValue(
      NextResponse.json(
        { error: 'UNAUTHORIZED', message: '로그인이 필요합니다.' },
        { status: 401 },
      ),
    );

    const response = await GET(new Request('http://localhost/api/integration/v1/user/services'), {
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
