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
import type { UserServicesPageResponse } from '@/lib/bff/types/users';

const mockedGetServicesPage = vi.mocked(bff.users.getServicesPage);

describe('GET /integration/api/v1/user/services/page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns content normalized through resolveUserService', async () => {
    mockedGetServicesPage.mockResolvedValue({
      content: [
        { service_code: 'SERVICE-A', service_name: '서비스 A' },
        { code: 'SERVICE-B', name: '서비스 B' } as unknown as { service_code: string; service_name: string },
      ],
      page: { size: 10, total_elements: 2, total_pages: 1 },
    });

    const response = await GET(
      new Request('http://localhost/integration/api/v1/user/services/page?page=0&size=10'),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      content: [
        { serviceCode: 'SERVICE-A', serviceName: '서비스 A' },
        { serviceCode: 'SERVICE-B', serviceName: '서비스 B' },
      ],
    });
    expect(mockedGetServicesPage).toHaveBeenCalledWith(0, 10, undefined);
  });

  it('preserves flat top-level page metadata access for I-3 compatibility', async () => {
    // Upstream that exposes flat top-level pagination — pre-ADR-011 wire shape.
    mockedGetServicesPage.mockResolvedValue({
      content: [{ serviceCode: 'SERVICE-A', serviceName: '서비스 A' }],
      totalElements: 42,
      totalPages: 5,
      number: 1,
      size: 10,
    } as unknown as UserServicesPageResponse);

    const response = await GET(
      new Request('http://localhost/integration/api/v1/user/services/page?page=1&size=10'),
      { params: Promise.resolve({}) },
    );

    await expect(response.json()).resolves.toMatchObject({
      page: { totalElements: 42, totalPages: 5, number: 1, size: 10 },
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
