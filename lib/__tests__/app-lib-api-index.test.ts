import { afterEach, describe, expect, it, vi } from 'vitest';
import { getServices, searchUsers } from '@/app/lib/api';

describe('app/lib/api/index', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('searchUsers는 excludeIds를 반복 쿼리로 직렬화한다', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          users: [],
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );

    await searchUsers('alice', ['u1', 'u2']);

    expect(fetchSpy.mock.calls[0]?.[0]).toBe(
      '/integration/api/infra/v1/users/search?q=alice&excludeIds=u1&excludeIds=u2',
    );
  });

  it('searchUsers는 빈 파라미터일 때 base endpoint를 호출한다', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          users: [],
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );

    await searchUsers('');

    expect(fetchSpy.mock.calls[0]?.[0]).toBe('/integration/api/infra/v1/users/search');
  });

  it('getServices는 v1 응답을 ServiceCode[] 형태로 매핑한다', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          services: [
            { service_code: 'SERVICE-A', service_name: 'Service Alpha' },
            { service_code: 'SERVICE-B', service_name: 'Service Beta' },
          ],
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );

    const services = await getServices();

    expect(services).toEqual([
      { code: 'SERVICE-A', name: 'Service Alpha' },
      { code: 'SERVICE-B', name: 'Service Beta' },
    ]);
  });
});
