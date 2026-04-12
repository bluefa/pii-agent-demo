import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';

vi.mock('@/lib/api-client', () => ({
  client: {
    azure: {
      getInstallationStatus: vi.fn(),
    },
  },
}));

import { GET } from '@/app/integration/api/v1/azure/target-sources/[targetSourceId]/installation-status/route';
import { client } from '@/lib/api-client';

const mockedGetInstallationStatus = vi.mocked(client.azure.getInstallationStatus);

describe('GET /integration/api/v1/azure/target-sources/[targetSourceId]/installation-status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Issue #222 계약에 맞게 snake_case Azure 설치 상태를 반환한다', async () => {
    mockedGetInstallationStatus.mockResolvedValue(NextResponse.json({
      provider: 'Azure',
      installed: false,
      lastCheckedAt: '2026-03-30T00:00:00Z',
      resources: [
        {
          resourceId: 'vm-001',
          resourceName: 'vm-001',
          resourceType: 'AZURE_VM',
          privateEndpoint: {
            id: 'pe-vm-001',
            name: 'pe-vm-001',
            status: 'APPROVED',
          },
        },
        {
          resourceId: 'mysql-001',
          resourceName: 'mysql-001',
          resourceType: 'AZURE_MYSQL',
          privateEndpoint: {
            id: 'pe-mysql-001',
            name: 'pe-mysql-001',
            status: 'NOT_REQUESTED',
          },
        },
      ],
    }));

    const response = await GET(
      new Request('http://localhost/integration/api/v1/azure/target-sources/1003/installation-status'),
      { params: Promise.resolve({ targetSourceId: '1003' }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      lastCheck: {
        status: 'IN_PROGRESS',
        checkedAt: '2026-03-30T00:00:00Z',
        failReason: null,
      },
      resources: [
        {
          resourceId: 'vm-001',
          resourceName: 'vm-001',
          resourceType: 'AZURE_VM',
          privateEndpoint: {
            id: 'pe-vm-001',
            name: 'pe-vm-001',
            status: 'APPROVED',
          },
          vmInstallation: null,
        },
        {
          resourceId: 'mysql-001',
          resourceName: 'mysql-001',
          resourceType: 'AZURE_MYSQL',
          privateEndpoint: {
            id: 'pe-mysql-001',
            name: 'pe-mysql-001',
            status: 'NOT_REQUESTED',
          },
          vmInstallation: null,
        },
      ],
    });
  });
});
