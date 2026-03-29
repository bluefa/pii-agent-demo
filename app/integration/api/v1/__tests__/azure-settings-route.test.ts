import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';

vi.mock('@/lib/api-client', () => ({
  client: {
    azure: {
      getSettings: vi.fn(),
    },
  },
}));

import { GET } from '@/app/integration/api/v1/azure/target-sources/[targetSourceId]/settings/route';
import { client } from '@/lib/api-client';

const mockedGetSettings = vi.mocked(client.azure.getSettings);

describe('GET /integration/api/v1/azure/target-sources/[targetSourceId]/settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.__piiAgentMockStore = undefined;
  });

  it('mock store의 Azure 식별자를 settings 응답으로 합성한다', async () => {
    mockedGetSettings.mockResolvedValue(NextResponse.json({
      scanApp: {
        registered: true,
        appId: 'scan-app-123',
        status: 'VALID',
        lastVerifiedAt: '2026-03-24T00:00:00Z',
      },
    }));

    const response = await GET(
      new Request('http://localhost/integration/api/v1/azure/target-sources/1003/settings'),
      { params: Promise.resolve({ targetSourceId: '1003' }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      tenantId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      subscriptionId: '12345678-abcd-ef01-2345-6789abcdef01',
      scanApp: {
        appId: 'scan-app-123',
        status: 'VALID',
        lastVerifiedAt: '2026-03-24T00:00:00Z',
      },
    });
  });

  it('snake_case settings payload를 camelCase 응답으로 정규화한다', async () => {
    mockedGetSettings.mockResolvedValue(NextResponse.json({
      tenant_id: 'tenant-from-settings',
      subscription_id: 'subscription-from-settings',
      scan_app: {
        app_id: 'scan-app-999',
        status: 'INVALID',
        last_verified_at: '2026-03-25T00:00:00Z',
      },
    }));

    const response = await GET(
      new Request('http://localhost/integration/api/v1/azure/target-sources/1003/settings'),
      { params: Promise.resolve({ targetSourceId: '1003' }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      tenantId: 'tenant-from-settings',
      subscriptionId: 'subscription-from-settings',
      scanApp: {
        appId: 'scan-app-999',
        status: 'INVALID',
        lastVerifiedAt: '2026-03-25T00:00:00Z',
      },
    });
  });
});
