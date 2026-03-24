import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAzureSettings } from '@/app/lib/api/azure';

describe('app/lib/api/azure', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('getAzureSettings는 settings 응답의 식별자를 camelCase로 변환한다', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          tenant_id: 'tenant-from-settings',
          subscription_id: 'subscription-from-settings',
          scan_app: {
            app_id: 'scan-app-123',
            status: 'VALID',
            last_verified_at: '2026-03-24T00:00:00Z',
          },
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );

    const settings = await getAzureSettings(1003);

    expect(fetchSpy.mock.calls[0]?.[0]).toBe('/api/infra/v1/azure/target-sources/1003/settings');
    expect(settings).toEqual({
      tenantId: 'tenant-from-settings',
      subscriptionId: 'subscription-from-settings',
      scanApp: {
        appId: 'scan-app-123',
        status: 'VALID',
        lastVerifiedAt: '2026-03-24T00:00:00Z',
      },
    });
  });
});
