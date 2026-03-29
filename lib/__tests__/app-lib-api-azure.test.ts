import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAzureSettings, resolveAzureProjectIdentifiers } from '@/app/lib/api/azure';

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

    expect(fetchSpy.mock.calls[0]?.[0]).toBe(
      '/api/integration/v1/azure/target-sources/1003/settings',
    );
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

  it('resolveAzureProjectIdentifiers는 project 식별자가 비어 있으면 settings fallback을 사용한다', () => {
    expect(resolveAzureProjectIdentifiers(
      {
        tenantId: undefined,
        subscriptionId: 'subscription-from-project',
      },
      {
        tenantId: 'tenant-from-settings',
        subscriptionId: 'subscription-from-settings',
        scanApp: {
          appId: 'scan-app-123',
          status: 'VALID',
        },
      },
    )).toEqual({
      tenantId: 'tenant-from-settings',
      subscriptionId: 'subscription-from-project',
    });
  });
});
