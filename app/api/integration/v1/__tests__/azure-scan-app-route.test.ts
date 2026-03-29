import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';

vi.mock('@/lib/api-client', () => ({
  client: {
    azure: {
      getSettings: vi.fn(),
    },
  },
}));

import { GET } from '@/app/api/integration/v1/target-sources/[targetSourceId]/azure/scan-app/route';
import { client } from '@/lib/api-client';

const mockedGetSettings = vi.mocked(client.azure.getSettings);

describe('GET /api/integration/v1/target-sources/[targetSourceId]/azure/scan-app', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('snake_case scan app payload를 issue #222 응답으로 정규화한다', async () => {
    mockedGetSettings.mockResolvedValue(NextResponse.json({
      scan_app: {
        app_id: 'scan-app-999',
        status: 'INVALID',
        fail_reason: 'APP_REGISTRATION_MISSING',
        fail_message: 'Scan app registration is missing.',
        last_verified_at: '2026-03-25T00:00:00Z',
      },
    }));

    const response = await GET(
      new Request('http://localhost/api/integration/v1/target-sources/1003/azure/scan-app'),
      { params: Promise.resolve({ targetSourceId: '1003' }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      app_id: 'scan-app-999',
      status: 'INVALID',
      fail_reason: 'APP_REGISTRATION_MISSING',
      fail_message: 'Scan app registration is missing.',
      last_verified_at: '2026-03-25T00:00:00Z',
    });
  });

  it('등록되지 않은 scan app은 UNVERIFIED와 빈 app_id로 응답한다', async () => {
    mockedGetSettings.mockResolvedValue(NextResponse.json({
      scanApp: {
        registered: false,
      },
    }));

    const response = await GET(
      new Request('http://localhost/api/integration/v1/target-sources/1003/azure/scan-app'),
      { params: Promise.resolve({ targetSourceId: '1003' }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      app_id: '',
      status: 'UNVERIFIED',
    });
  });
});
