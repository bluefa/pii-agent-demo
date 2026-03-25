import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';

vi.mock('@/lib/api-client', () => ({
  client: {
    azure: {
      getSettings: vi.fn(),
    },
  },
}));

import { GET } from '@/app/api/v1/azure/target-sources/[targetSourceId]/settings/route';
import { client } from '@/lib/api-client';

const mockedGetSettings = vi.mocked(client.azure.getSettings);

describe('GET /api/v1/azure/target-sources/[targetSourceId]/settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('client.azure.getSettings 응답을 그대로 전달한다', async () => {
    mockedGetSettings.mockResolvedValue(NextResponse.json({
      tenant_id: 'tenant-from-settings',
      subscription_id: 'subscription-from-settings',
      scan_app: {
        app_id: 'scan-app-123',
        status: 'VALID',
        last_verified_at: '2026-03-24T00:00:00Z',
      },
    }));

    const response = await GET(
      new Request('http://localhost/api/v1/azure/target-sources/1003/settings'),
      { params: Promise.resolve({ targetSourceId: '1003' }) },
    );

    expect(response.status).toBe(200);
    expect(mockedGetSettings).toHaveBeenCalledWith('azure-proj-1');
    await expect(response.json()).resolves.toEqual({
      tenant_id: 'tenant-from-settings',
      subscription_id: 'subscription-from-settings',
      scan_app: {
        app_id: 'scan-app-123',
        status: 'VALID',
        last_verified_at: '2026-03-24T00:00:00Z',
      },
    });
  });

  it('client 에러 응답도 그대로 전달한다', async () => {
    mockedGetSettings.mockResolvedValue(
      NextResponse.json(
        { error: 'TARGET_SOURCE_NOT_FOUND', message: 'not found' },
        { status: 404 },
      ),
    );

    const response = await GET(
      new Request('http://localhost/api/v1/azure/target-sources/1003/settings'),
      { params: Promise.resolve({ targetSourceId: '1003' }) },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      code: 'TARGET_SOURCE_NOT_FOUND',
      title: 'Target Source Not Found',
      status: 404,
      detail: 'not found',
      retriable: false,
    });
  });
});
