import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/bff/client', () => ({
  bff: {
    users: {
      getServicesPage: vi.fn(),
    },
  },
}));

import { GET } from '@/app/integration/api/v1/user/services/page/route';
import { bff } from '@/lib/bff/client';
import { BffError } from '@/lib/bff/errors';
import type { z } from 'zod';
import type { schemas } from '@/lib/generated/install-v1';

type PageServiceItem = z.infer<typeof schemas.PageServiceItem>;

const mockedGetServicesPage = vi.mocked(bff.users.getServicesPage);

describe('GET /integration/api/v1/user/services/page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns snake wire PageServiceItem validated by zod schema', async () => {
    mockedGetServicesPage.mockResolvedValue({
      content: [
        { service_code: 'SERVICE-A', service_name: '서비스 A' },
        { service_code: 'SERVICE-B', service_name: '서비스 B' },
      ],
      totalElements: 2,
      totalPages: 1,
      number: 0,
      size: 10,
    } as PageServiceItem);

    const response = await GET(
      new Request('http://localhost/integration/api/v1/user/services/page?page=0&size=10'),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      content: [
        { service_code: 'SERVICE-A', service_name: '서비스 A' },
        { service_code: 'SERVICE-B', service_name: '서비스 B' },
      ],
    });
    expect(mockedGetServicesPage).toHaveBeenCalledWith(0, 10, undefined);
  });

  it('reads Spring Page envelope metadata', async () => {
    mockedGetServicesPage.mockResolvedValue({
      content: [{ service_code: 'SERVICE-A', service_name: '서비스 A' }],
      totalElements: 42,
      totalPages: 5,
      number: 1,
      size: 10,
    } as PageServiceItem);

    const response = await GET(
      new Request('http://localhost/integration/api/v1/user/services/page?page=1&size=10'),
      { params: Promise.resolve({}) },
    );

    await expect(response.json()).resolves.toMatchObject({
      totalElements: 42,
      totalPages: 5,
      number: 1,
      size: 10,
    });
  });

  it('passes query string and forwards BffError as ProblemDetails', async () => {
    mockedGetServicesPage.mockRejectedValueOnce(
      new BffError(401, 'UNAUTHORIZED', '로그인이 필요합니다.'),
    );

    const response = await GET(
      new Request('http://localhost/integration/api/v1/user/services/page?page=0&size=10&query=foo'),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(401);
    expect(response.headers.get('content-type')).toContain('application/problem+json');
    await expect(response.json()).resolves.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(mockedGetServicesPage).toHaveBeenCalledWith(0, 10, 'foo');
  });
});
